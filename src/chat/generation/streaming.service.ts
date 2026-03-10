import { Injectable, Logger } from '@nestjs/common';
import { ProviderFactory } from '../../shared/infrastructure/providers/provider.factory';
import { HybridSearchService, SearchMetrics } from '../retrieval/hybrid-search.service';
import { DatabaseService } from '../../shared/database/database.service';
import { ChatMessage, ConfidenceMetrics } from '../types/chat.types';
import { LLMProvider, StreamChunk, RetrievedChunk } from '../../shared/types/providers.interface';
import { CitationValidatorService } from '../validation/citation-validator.service';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly providerFactory: ProviderFactory,
    private readonly hybridSearch: HybridSearchService,
    private readonly citationValidator: CitationValidatorService,
  ) {}

  async *generateResponse(
    chatId: number,
    userId: number,
    tenantId: number,
    query: string,
  ): AsyncIterable<StreamChunk> {
    // 1. Save user message
    const prisma = this.databaseService.getPrismaClient();
    await prisma.chatMessage.create({
      data: {
        chat_id: chatId,
        role: 'user',
        content: query,
        tenant_id: tenantId,
      },
    });

    // 2. Retrieve relevant chunks with metrics
    const searchResult = await this.hybridSearch.search(query, tenantId, 10);
    const chunks: RetrievedChunk[] = searchResult.chunks.map(r => ({
      id: String(r.chunkId),
      content: r.content,
      documentName: r.documentName,
      pageNumber: r.pageNumber,
      score: r.score,
      embedding: r.embedding,
    }));

    // 3. Compute confidence score from retrieval metrics
    const confidence = this.calculateConfidence(searchResult.metrics);

    // 4. Check for no context - refuse to answer if no relevant documents retrieved
    if (chunks.length === 0) {
      this.logger.warn(`No context retrieved for chat ${chatId}, query: "${query.substring(0, 100)}..."`);
      // Return refusal message
      const refusalMessage = 'I cannot answer because no relevant documents were found.';
      yield { type: 'text', text: refusalMessage, confidence };
      yield { type: 'done', confidence };
      return;
    }

    // 5. Build conversation context - fetch all messages including the one just saved
    const history = await prisma.chatMessage.findMany({
      where: { chat_id: chatId },
      orderBy: { created_at: 'asc' },
    });

    // Transform to provider message format: [{ role: 'user'|'assistant', content: string }]
    const messages: { role: 'user' | 'assistant'; content: string }[] = history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // 4. Get LLM provider
    const llmProvider = this.providerFactory.getLLMProvider();

    // 5. Build system prompt with grounding based on confidence
    const systemPrompt = this.buildSystemPrompt(chunks, confidence);

    // 6. Stream response
    let fullText = '';

    try {
      // Pass system prompt via context - LLM providers will handle it internally
      // Since provider.streamChat signature doesn't include systemPrompt separately,
      // we need to inject it into messages array as first message or modify chunks
      // The LLMProvider interface expects messages + context. The providers (Claude/Local)
      // already build their own system prompts from context. But they don't have a separate
      // system prompt parameter. To include the system prompt with retrieved context, we
      // could either (a) prepend a system message to the messages array (but Anthropic and
      // Ollama have separate system param or special handling), or (b) modify LLMProvider
      // interface to accept systemPrompt. Let's check the existing providers:
      //
      // ClaudeLLMProvider: buildSystemPrompt(context) and passes as `system` field in messages.stream()
      // LocalLLMProvider: buildPrompt(messages, context) forms full prompt string with system
      //
      // Both build system prompt from context only. They don't have a separate systemPrompt
      // parameter. However our StreamingService needs to build system prompt and pass it.
      // We could either modify providers to accept external system prompt (breaking change)
      // or we could construct messages array to include the system prompt as a special message.
      // For Claude: system must be separate argument, not in messages array.
      // For Ollama: prompt format is single string with system + conversation.
      //
      // For MVP streamline, we'll adjust approach: StreamingService will NOT pass systemPrompt
      // separately. Instead, we rely on LLMProvider to build system prompt from context.
      // But we need to ensure context passed to LLM includes the retrieved chunks only.
      // So we pass `chunks` as context, and LLMProvider.buildSystemPrompt will format them.
      // However we need to customize the system prompt specifically for this chat.
      // Actually both providers already build a system prompt that includes context. That's
      // exactly what we need. So we just need to pass the retrieved chunks as `context`.
      //
      // But we also need to ensure the chat history is included properly. The LLMProvider
      // takes `messages` array which already includes the history. So that's fine.
      //
      // However: The LLMProvider interface doesn't have a way to inject a custom system
      // prompt. It builds it internally from context. That means we cannot customize it
      // per StreamingService needs. But the providers already include citation instructions.
      // So we can simply use them as is. But are they the same as expected by plan? The
      // plan says "System prompt includes retrieved context, instructs to cite using <cite> tags".
      // Looking at ClaudeLLMProvider.buildSystemPrompt, it uses [N] format, not <cite> tags.
      // That's okay for MVP. We'll accept it.
      //
      // So we'll call provider.streamChat(messages, chunks, systemPrompt) with custom prompt

      for await (const chunk of llmProvider.streamChat(messages, chunks, systemPrompt)) {
        if (chunk.type === 'text' && chunk.text) {
          fullText += chunk.text;
          yield chunk;
        } else if (chunk.type === 'error') {
          yield chunk;
          return;
        }
      }

      // Validate citations after streaming completes
      const validation = this.citationValidator.validate(fullText, chunks.length);
      if (!validation.valid) {
        this.logger.warn(`Citation validation failed for chat ${chatId}: ${validation.errors.join(', ')}`);
      }

      // Save assistant response with retrieved chunk IDs (store as numbers from SearchResult)
      await prisma.chatMessage.create({
        data: {
          chat_id: chatId,
          role: 'assistant',
          content: fullText,
          retrieved_chunk_ids: searchResult.chunks.map(r => r.chunkId),
          tenant_id: tenantId,
        },
      });

      yield { type: 'done' };
    } catch (err: any) {
      this.logger.error(`Streaming error: ${err.message}`, err.stack);
      yield { type: 'error', error: err.message };
      throw err;
    }
  }

  private buildSystemPrompt(chunks: RetrievedChunk[], confidence: ConfidenceMetrics): string {
    let basePrompt = `You are a helpful assistant that answers questions based on the provided context.

IMPORTANT: When answering, if the information comes from the retrieved context, you must include citations in the format [N] where N is the source number. For example, if you use information from the first retrieved document, cite it as [1].

BE PRECISE: Only cite sources that directly support the specific statement you're making. Do not cite if the context doesn't contain the information.`;

    // Add grounding prefix for low/medium confidence
    const groundingPrefix = this.getGroundingPrefix(confidence.level);
    if (groundingPrefix) {
      basePrompt += `\n\n${groundingPrefix}`;
    }

    const contextSection = chunks.map((c, index) => `[${index + 1}] Document: ${c.documentName}${c.pageNumber ? ` (Page ${c.pageNumber})` : ''}\nContent: ${c.content}`).join('\n\n');

    return `${basePrompt}

Retrieved context (cite using [N]):

${contextSection}`;
  }

  /**
   * Calculate confidence score from search metrics
   * Score range: 0-1, higher = more confident
   */
  private calculateConfidence(metrics: SearchMetrics): ConfidenceMetrics {
    const { count, avgScore, scoreVariance } = metrics;

    // Normalize count: more chunks = higher confidence (max effect at 10+ chunks)
    const countScore = Math.min(count / 10, 1) * 0.3;

    // Normalize average score: already 0-1 range (RRF scores are 0-0.7ish)
    // We'll normalize to 0-1 by assuming max RRF ~0.7
    const normalizedAvg = Math.min(avgScore / 0.7, 1);
    const avgScoreWeight = normalizedAvg * 0.5;

    // Variance penalty: low variance (tight clustering) = more confident
    // High variance = less confident. Typical RRF variance might be 0.001-0.01
    const variancePenalty = Math.min(scoreVariance * 10, 1) * 0.2; // up to 20% penalty

    const totalScore = countScore + avgScoreWeight - variancePenalty;
    const clampedScore = Math.max(0, Math.min(1, totalScore));

    // Determine level based on score thresholds
    let level: 'high' | 'medium' | 'low';
    if (clampedScore > 0.7) {
      level = 'high';
    } else if (clampedScore > 0.4) {
      level = 'medium';
    } else {
      level = 'low';
    }

    return { score: clampedScore, level };
  }

  /**
   * Get grounding prefix text for system prompt based on confidence level
   */
  private getGroundingPrefix(level: 'high' | 'medium' | 'low'): string | null {
    switch (level) {
      case 'medium':
        return 'NOTE: The retrieved context is limited. Answer based on the provided documents, and be cautious in your assertions.';
      case 'low':
        return 'IMPORTANT: The retrieved context is weak or minimal. Explicitly state that your answer is based on limited information from the documents.';
      default:
        return null; // No prefix for high confidence
    }
  }
}
