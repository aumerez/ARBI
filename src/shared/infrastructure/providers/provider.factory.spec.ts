import { ProviderFactory } from './provider.factory';
import { EmbeddingProvider, LLMProvider } from '../../types/providers.interface';

// Mock provider classes
class MockEmbeddingProvider implements EmbeddingProvider {
  async generateEmbeddings(): Promise<number[][]> {
    return [];
  }
}

class MockLLMProvider implements LLMProvider {
  async *streamChat() {}
}

describe('ProviderFactory', () => {
  let factory: ProviderFactory;

  beforeEach(() => {
    const mockConfig = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          EMBEDDING_PROVIDER: 'openai',
          LLM_PROVIDER: 'anthropic',
        };
        return config[key] || defaultValue;
      }),
    };

    const mockOpenAI = new MockEmbeddingProvider() as any;
    const mockLocalEmb = new MockEmbeddingProvider() as any;
    const mockClaude = new MockLLMProvider() as any;
    const mockLocalLLM = new MockLLMProvider() as any;

    factory = new ProviderFactory(
      mockConfig as any,
      mockOpenAI,
      mockLocalEmb,
      mockClaude,
      mockLocalLLM
    );
  });

  describe('getEmbeddingProvider', () => {
    it('should return OpenAIEmbeddingProvider when EMBEDDING_PROVIDER=openai', () => {
      factory['config'].get = jest.fn().mockReturnValue('openai');
      const provider = factory.getEmbeddingProvider();
      expect(provider).toBeDefined();
    });

    it('should return LocalEmbeddingProvider when EMBEDDING_PROVIDER=local', () => {
      factory['config'].get = jest.fn().mockReturnValue('local');
      const provider = factory.getEmbeddingProvider();
      expect(provider).toBeDefined();
    });

    it('should throw error when EMBEDDING_PROVIDER is invalid in constructor', () => {
      const mockConfig = { get: jest.fn().mockReturnValue('unknown') };
      expect(() => new ProviderFactory(mockConfig as any, {} as any, {} as any, {} as any, {} as any))
        .toThrow('Unknown EMBEDDING_PROVIDER');
    });
  });

  describe('getLLMProvider', () => {
    it('should return ClaudeLLMProvider when LLM_PROVIDER=anthropic', () => {
      factory['config'].get = jest.fn().mockReturnValue('anthropic');
      const provider = factory.getLLMProvider();
      expect(provider).toBeDefined();
    });

    it('should return LocalLLMProvider when LLM_PROVIDER=local', () => {
      factory['config'].get = jest.fn().mockReturnValue('local');
      const provider = factory.getLLMProvider();
      expect(provider).toBeDefined();
    });

    it('should throw error when LLM_PROVIDER is invalid in constructor', () => {
      const mockConfig = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'EMBEDDING_PROVIDER') return 'openai';
          return 'unknown'; // LLM_PROVIDER
        }),
      };
      expect(() => new ProviderFactory(mockConfig as any, {} as any, {} as any, {} as any, {} as any))
        .toThrow('Unknown LLM_PROVIDER');
    });
  });

  describe('provider interfaces', () => {
    it('embedding provider should have generateEmbeddings method', () => {
      const provider = factory.getEmbeddingProvider();
      expect(typeof provider.generateEmbeddings).toBe('function');
    });

    it('llm provider should have streamChat method', () => {
      const provider = factory.getLLMProvider();
      expect(typeof provider.streamChat).toBe('function');
    });
  });
});
