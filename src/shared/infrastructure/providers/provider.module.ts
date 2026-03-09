import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ProviderFactory } from './provider.factory';
import { OpenAIEmbeddingProvider } from './openai-embedding.provider';
import { LocalEmbeddingProvider } from './local-embedding.provider';
import { ClaudeLLMProvider } from './claude-llm.provider';
import { LocalLLMProvider } from './local-llm.provider';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [
    ProviderFactory,
    OpenAIEmbeddingProvider,
    LocalEmbeddingProvider,
    ClaudeLLMProvider,
    LocalLLMProvider,
  ],
  exports: [ProviderFactory],
})
export class ProviderModule {}
