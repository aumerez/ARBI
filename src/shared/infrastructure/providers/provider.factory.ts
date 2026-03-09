import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider, LLMProvider } from '../../types/providers.interface';
import { OpenAIEmbeddingProvider } from './openai-embedding.provider';
import { LocalEmbeddingProvider } from './local-embedding.provider';
import { ClaudeLLMProvider } from './claude-llm.provider';
import { LocalLLMProvider } from './local-llm.provider';

@Injectable()
export class ProviderFactory implements OnModuleInit, OnModuleDestroy {
  protected readonly logger = new Logger(ProviderFactory.name);
  private embeddingProvider: EmbeddingProvider;
  private llmProvider: LLMProvider;

  constructor(
    private readonly config: ConfigService,
    private readonly openaiEmbeddingProvider: OpenAIEmbeddingProvider,
    private readonly localEmbeddingProvider: LocalEmbeddingProvider,
    private readonly claudeLLMProvider: ClaudeLLMProvider,
    private readonly localLLMProvider: LocalLLMProvider,
  ) {
    const embeddingProviderType = this.config.get<string>('EMBEDDING_PROVIDER', 'openai');
    const llmProviderType = this.config.get<string>('LLM_PROVIDER', 'anthropic');

    this.logger.log(`ProviderFactory: EMBEDDING_PROVIDER=${embeddingProviderType}, LLM_PROVIDER=${llmProviderType}`);

    // Initialize embedding provider based on config
    switch (embeddingProviderType.toLowerCase()) {
      case 'openai':
        this.embeddingProvider = this.openaiEmbeddingProvider;
        this.logger.log('OpenAIEmbeddingProvider selected');
        break;
      case 'local':
        this.embeddingProvider = this.localEmbeddingProvider;
        this.logger.log('LocalEmbeddingProvider selected');
        break;
      default:
        throw new Error(`Unknown EMBEDDING_PROVIDER: ${embeddingProviderType}. Use 'openai' or 'local'`);
    }

    // Initialize LLM provider based on config
    switch (llmProviderType.toLowerCase()) {
      case 'anthropic':
        this.llmProvider = this.claudeLLMProvider;
        this.logger.log('ClaudeLLMProvider selected');
        break;
      case 'local':
        this.llmProvider = this.localLLMProvider;
        this.logger.log('LocalLLMProvider selected');
        break;
      default:
        throw new Error(`Unknown LLM_PROVIDER: ${llmProviderType}. Use 'anthropic' or 'local'`);
    }
  }

  getEmbeddingProvider(): EmbeddingProvider {
    return this.embeddingProvider;
  }

  getLLMProvider(): LLMProvider {
    return this.llmProvider;
  }

  onModuleInit() {
    this.logger.log('ProviderFactory initialized');
  }

  onModuleDestroy() {
    this.logger.log('ProviderFactory destroyed');
  }
}
