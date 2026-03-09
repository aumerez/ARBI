import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { Transform } from 'stream';
import { LLMProvider, StreamChunk, RetrievedChunk } from '../../types/providers.interface';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
}

interface OllamaGenerateResponse {
  response: string;
  done: boolean;
  error?: string;
}

@Injectable()
export class LocalLLMProvider implements LLMProvider, OnModuleInit, OnModuleDestroy {
  protected readonly logger = new Logger(LocalLLMProvider.name);
  private readonly ollamaHost: string;
  private readonly model: string;
  private readonly timeout: number;

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService
  ) {
    this.ollamaHost = this.config.get<string>('OLLAMA_HOST', 'http://localhost:11434');
    this.model = this.config.get<string>('LOCAL_LLM_MODEL', 'llama2');
    this.timeout = this.config.get<number>('LOCAL_LLM_TIMEOUT', 60000);
  }

  async *streamChat(
    messages: { role: 'user' | 'assistant'; content: string }[],
    context: RetrievedChunk[]
  ): AsyncIterable<StreamChunk> {
    const prompt = this.buildPrompt(messages, context);

    try {
      const response = await firstValueFrom(
        this.httpService.post<OllamaGenerateResponse>(
          `${this.ollamaHost}/api/generate`,
          {
            model: this.model,
            prompt: prompt,
            stream: true,
          } as OllamaGenerateRequest,
          {
            params: {
              format: 'json',
            },
            timeout: this.timeout,
            responseType: 'stream',
          }
        )
      );

      // Handle stream response
      const stream = response.data as unknown as NodeJS.ReadableStream;
      const self = this; // Capture this for callback
      const reader = stream.pipe(new Transform({ objectMode: true, transform(chunk, _, callback) {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as OllamaGenerateResponse;
            if (parsed.error) {
              self.logger.error(`Ollama error: ${parsed.error}`);
              callback(null, { type: 'error', error: parsed.error });
              return;
            }
            if (parsed.response) {
              callback(null, { type: 'text', text: parsed.response });
            }
            if (parsed.done) {
              callback(null, { type: 'done' });
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
        callback();
      } })) as unknown as AsyncIterable<StreamChunk>;

      for await (const chunk of reader) {
        yield chunk;
      }

    } catch (error: any) {
      this.logger.error(`Local LLM request failed: ${error.message}`, error.stack);
      yield {
        type: 'error',
        error: `Local LLM provider error: ${error.message}`,
      };
      throw error;
    }
  }

  private buildPrompt(
    messages: { role: 'user' | 'assistant'; content: string }[],
    context: RetrievedChunk[]
  ): string {
    const systemPrompt = this.buildSystemPrompt(context);
    const conversation = this.formatConversation(messages);
    return `${systemPrompt}\n\n${conversation}`;
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

  private formatConversation(messages: { role: 'user' | 'assistant'; content: string }[]): string {
    return messages.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n\n');
  }

  onModuleInit() {
    this.logger.log(`LocalLLMProvider initialized - model: ${this.model}, host: ${this.ollamaHost}`);
    this.logger.warn(`Ensure Ollama server is running with model '${this.model}' pulled`);
  }

  onModuleDestroy() {
    this.logger.log('LocalLLMProvider destroyed');
  }
}
