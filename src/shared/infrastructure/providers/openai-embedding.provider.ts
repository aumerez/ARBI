import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { encodingForModel } from 'js-tiktoken';
import { EmbeddingProvider } from '../../types/providers.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  protected readonly logger = new Logger(OpenAIEmbeddingProvider.name);
  private readonly client: OpenAI;
  private readonly encoding = encodingForModel('text-embedding-3-large');
  private readonly BATCH_SIZE = 100;
  private readonly MAX_TOKENS = 8192;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }
    this.client = new OpenAI({ apiKey: apiKey! });
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Truncate each text to MAX_TOKENS
    const truncated = texts.map(text => this.truncateToTokenLimit(text, this.MAX_TOKENS));

    const embeddings: number[][] = [];

    // Batch processing
    for (let i = 0; i < truncated.length; i += this.BATCH_SIZE) {
      const batch = truncated.slice(i, i + this.BATCH_SIZE);

      try {
        const response = await this.client.embeddings.create({
          model: 'text-embedding-3-large',
          input: batch,
        });

        embeddings.push(...response.data.map(d => d.embedding));

        // Rate limit delay between batches
        if (i + this.BATCH_SIZE < truncated.length) {
          await this.delay(100);
        }
      } catch (error: any) {
        this.logger.error(`OpenAI embedding batch failed (${i}-${i+batch.length})`, error.message);
        throw error;
      }
    }

    this.logger.log(`Generated ${embeddings.length} embeddings (${embeddings[0]?.length || 0} dims)`);
    return embeddings;
  }

  private truncateToTokenLimit(text: string, maxTokens: number): string {
    const tokens = this.encoding.encode(text);
    if (tokens.length <= maxTokens) {
      return text;
    }
    const truncatedTokens = tokens.slice(0, maxTokens);
    return this.encoding.decode(truncatedTokens);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
