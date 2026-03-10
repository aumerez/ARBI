import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, StreamChunk, RetrievedChunk } from '../../types/providers.interface';

@Injectable()
export class ClaudeLLMProvider implements LLMProvider, OnModuleInit, OnModuleDestroy {
  protected readonly logger = new Logger(ClaudeLLMProvider.name);
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for ClaudeLLMProvider');
    }
    this.client = new Anthropic({ apiKey });
    this.model = this.config.get<string>('CLAUDE_MODEL', 'claude-sonnet-4-6');
    this.maxTokens = this.config.get<number>('CLAUDE_MAX_TOKENS', 4096);
    this.temperature = this.config.get<number>('CLAUDE_TEMPERATURE', 0.3);
  }

  async *streamChat(
    messages: { role: 'user' | 'assistant'; content: string }[],
    context: RetrievedChunk[],
    systemPrompt?: string
  ): AsyncIterable<StreamChunk> {
    // Use custom systemPrompt if provided; otherwise build default from context
    const finalSystemPrompt = systemPrompt || this.buildSystemPrompt(context);
    const formattedMessages = this.formatMessages(messages);

    try {
      const stream = await this.client.messages.stream(
        {
          model: this.model,
          max_tokens: this.maxTokens,
          system: finalSystemPrompt,
          messages: formattedMessages,
          temperature: this.temperature,
        },
        {
          headers: {
            'anthropic-dangerous-direct-browser-access': 'true',
          },
        }
      );

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield {
            type: 'text',
            text: event.delta.text,
          };
        } else if (event.type === 'message_stop') {
          yield {
            type: 'done',
          };
        }
      }
    } catch (error: any) {
      this.logger.error(`Claude LLM streaming error: ${error.message}`, error.stack);
      yield {
        type: 'error',
        error: `Claude LLM provider error: ${error.message}`,
      };
      throw error;
    }
  }

  private buildSystemPrompt(context: RetrievedChunk[]): string {
    const basePrompt = `You are a helpful assistant that answers questions based on the provided context.

IMPORTANT: When answering, if the information comes from the retrieved context, you must include citations in the format [N] where N is the source number. For example, if you use information from the first retrieved document, cite it as [1].

BE PRECISE: Only cite sources that directly support the specific statement you're making. Do not cite if the context doesn't contain the information.`;

    if (context.length === 0) {
      return basePrompt + '\n\nNo retrieved context is available for this question. Answer based on your general knowledge, but note that you may not have access to company-specific information.';
    }

    const contextSection = context.map((chunk, index) => `[${index + 1}] Document: ${chunk.documentName}${chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : ''}\nContent: ${chunk.content}`).join('\n\n');

    return `${basePrompt}

Retrieved context (cite using [N]):

${contextSection}`;
  }

  private formatMessages(messages: { role: 'user' | 'assistant'; content: string }[]) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  onModuleInit() {
    this.logger.log(`ClaudeLLMProvider initialized - model: ${this.model}, maxTokens: ${this.maxTokens}`);
  }

  onModuleDestroy() {
    this.logger.log('ClaudeLLMProvider destroyed');
  }
}
