import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { EmbeddingProvider } from '../../types/providers.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LocalEmbeddingProvider implements EmbeddingProvider {
  private readonly logger = new Logger(LocalEmbeddingProvider.name);
  private readonly ollamaHost: string;
  private readonly model = 'nomic-embed-text';

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService
  ) {
    this.ollamaHost = this.config.get<string>('OLLAMA_HOST', 'http://localhost:11434');
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const url = `${this.ollamaHost}/api/embed`;
    const payload = {
      model: this.model,
      input: texts,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<{ embeddings: number[][] }>(url, payload, {
          timeout: 30000, // 30s timeout
        })
      );

      const embeddings = response.data.embeddings;
      if (!embeddings || embeddings.length !== texts.length) {
        throw new Error(`Embedding count mismatch: expected ${texts.length}, got ${embeddings?.length || 0}`);
      }

      this.logger.log(`Generated ${embeddings.length} embeddings via Ollama (${embeddings[0]?.length || 0} dims)`);
      return embeddings;
    } catch (error: any) {
      this.logger.error(`Ollama embedding request failed: ${error.message}`);
      throw new Error(`Local embedding provider error: ${error.message}`);
    }
  }
}
