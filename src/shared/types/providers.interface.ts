export interface EmbeddingProvider {
  /**
   * Generate embeddings for multiple text inputs
   * @param texts Array of text strings to embed
   * @returns Promise resolving to array of embedding vectors (number[])
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

export interface LLMProvider {
  /**
   * Stream chat completions from LLM
   * @param messages Chat history with role and content
   * @param context Retrieved document chunks for grounding
   * @param systemPrompt Optional custom system prompt (overrides provider's default)
   * @returns AsyncIterable yielding StreamChunk events
   */
  streamChat(
    messages: { role: 'user' | 'assistant'; content: string }[],
    context: RetrievedChunk[],
    systemPrompt?: string
  ): AsyncIterable<StreamChunk>;
}

export interface StreamChunk {
  type: 'text' | 'done' | 'error';
  text?: string;
  citations?: Citation[];
  error?: string;
  confidence?: {
    score: number;
    level: 'high' | 'medium' | 'low';
  };
}

export interface RetrievedChunk {
  id: string;
  content: string;
  documentName: string;
  pageNumber?: number;
  score: number;
  embedding?: number[];
}

export interface Citation {
  number: number;
  documentId: number;
  page?: number;
}

// Configuration types
export interface ProviderConfig {
  embeddingProvider: 'openai' | 'local';
  llmProvider: 'anthropic' | 'local';
}
