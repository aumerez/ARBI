export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: number;
  chat_id: number;
  role: ChatRole;
  content: string;
  retrieved_chunk_ids?: number[]; // array of DocumentChunk IDs
  created_at: Date;
}

export interface RetrievedChunk {
  id: number;
  content: string;
  document_id: number;
  documentName?: string; // from payload
  score: number;
  embedding?: number[]; // optional for reranker
}

export interface Citation {
  number: number;
  chunkId: number;
  documentId: number;
  page?: number;
}

export interface StreamChunk {
  type: 'text' | 'done' | 'error';
  text?: string;
  citations?: Citation[];
  error?: string;
}
