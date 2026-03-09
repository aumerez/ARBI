import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LLMProvider, StreamChunk, RetrievedChunk } from '../../types/providers.interface';

// Create mock instance
const mockMessagesStream = jest.fn();
const mockAnthropicInstance = {
  messages: {
    stream: mockMessagesStream,
  },
};

// Mock before importing the module under test
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockAnthropicInstance),
}));

import { ClaudeLLMProvider } from './claude-llm.provider';

describe('ClaudeLLMProvider', () => {
  let provider: ClaudeLLMProvider;

  beforeEach(async () => {
    mockMessagesStream.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaudeLLMProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
              if (key === 'ANTHROPIC_API_KEY') return 'test-api-key';
              if (key === 'CLAUDE_MODEL') return 'claude-sonnet-4-6';
              if (key === 'CLAUDE_MAX_TOKENS') return 4096;
              if (key === 'CLAUDE_TEMPERATURE') return 0.3;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<ClaudeLLMProvider>(ClaudeLLMProvider);
  });

  describe('streamChat', () => {
    it('should implement LLMProvider interface', () => {
      expect(provider).toBeInstanceOf(ClaudeLLMProvider);
      expect(typeof provider.streamChat).toBe('function');
    });

    it('should instantiate Anthropic with API key', () => {
      const { default: AnthropicMock } = require('@anthropic-ai/sdk');
      expect(AnthropicMock).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });

    it('should call Anthropic messages.stream with correct parameters', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: () => ({
          next: async () => ({ done: true, value: null }),
        }),
      };
      mockMessagesStream.mockReturnValue(mockStream);

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const context: RetrievedChunk[] = [];

      await provider.streamChat(messages, context);

      expect(mockMessagesStream).toHaveBeenCalledWith(
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: expect.stringContaining('citation format'),
          messages: [
            {
              role: 'user',
              content: 'Hello',
            },
          ],
          temperature: 0.3,
        },
        expect.any(Object)
      );
    });

    it('should yield text chunks from stream', async () => {
      // Mock Anthropic-style events
      const events = [
        { type: 'message_start' as const, message: { id: 'msg-123', type: 'message', role: 'assistant', content: [], model: 'claude-sonnet-4-6', stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 20 } } },
        { type: 'content_block_start' as const, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta' as const, delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'content_block_delta' as const, delta: { type: 'text_delta', text: ' world' } },
        { type: 'content_block_stop' as const },
        { type: 'message_stop' as const, message: { id: 'msg-123', type: 'message', role: 'assistant', content: [{ type: 'text', text: 'Hello world' }], model: 'claude-sonnet-4-6', stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 20 } } },
      ];

      const mockStream = {
        [Symbol.asyncIterator]: () => ({
          next: async function* () {
            for (const event of events) {
              yield { done: false, value: event };
            }
            yield { done: true, value: undefined };
          },
        }),
      };
      mockMessagesStream.mockReturnValue(mockStream);

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const context: RetrievedChunk[] = [];

      const result: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages, context)) {
        result.push(chunk);
      }

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: 'text', text: 'Hello' });
      expect(result[1]).toEqual({ type: 'text', text: ' world' });
      expect(result.filter(r => r.type === 'done').length).toBeGreaterThanOrEqual(1);
    });

    it('should include retrieved context in system prompt', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: () => ({
          next: async () => ({ done: true, value: null }),
        }),
      };
      mockMessagesStream.mockReturnValue(mockStream);

      const messages = [{ role: 'user' as const, content: 'What is the policy?' }];
      const context: RetrievedChunk[] = [
        {
          id: '1',
          content: 'The policy states...',
          documentName: 'Policy.pdf',
          pageNumber: 5,
          score: 0.95,
        },
      ];

      await provider.streamChat(messages, context);

      const callArgs = mockMessagesStream.mock.calls[0][0];
      expect(callArgs.system).toContain('Retrieved context');
      expect(callArgs.system).toContain('Policy.pdf');
      expect(callArgs.system).toContain('[1]');
      expect(callArgs.system).toContain('The policy states...');
    });

    it('should handle empty context', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: () => ({
          next: async () => ({ done: true, value: null }),
        }),
      };
      mockMessagesStream.mockReturnValue(mockStream);

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const context: RetrievedChunk[] = [];

      await provider.streamChat(messages, context);

      const callArgs = mockMessagesStream.mock.calls[0][0];
      expect(callArgs.system).toContain('No retrieved context is available');
    });

    it('should handle Anthropic API errors', async () => {
      mockMessagesStream.mockImplementation(() => {
        throw new Error('API Error from Anthropic');
      });

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const context: RetrievedChunk[] = [];

      await expect(provider.streamChat(messages, context)).rejects.toThrow('Claude LLM provider error');
    });
  });
});
