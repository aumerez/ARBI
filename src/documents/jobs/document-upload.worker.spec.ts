// Mock the processor imports before they're loaded
jest.mock('../processors/pdf.processor', () => ({
  PDFProcessor: class MockPDFProcessor {
    async extractText(filePath: string): Promise<string> {
      return 'mock text content for testing';
    }
  },
}));

jest.mock('../processors/docx.processor', () => ({
  DOCXProcessor: class MockDOCXProcessor {
    async extractText(filePath: string): Promise<string> {
      return 'mock text content for testing';
    }
  },
}));

jest.mock('../processors/txt.processor', () => ({
  TXTProcessor: class MockTXTProcessor {
    async extractText(filePath: string): Promise<string> {
      return 'mock text content for testing';
    }
  },
}));

// Mock TextSplitterService
const mockSplitText = jest.fn().mockResolvedValue(['chunk 1', 'chunk 2', 'chunk 3']);

jest.mock('../chunking/text-splitter.service', () => ({
  TextSplitterService: class MockTextSplitterService {
    splitText = mockSplitText;
  },
}));

// Mock BullMQ dependencies
const mockQueueAdd = jest.fn();

jest.mock('bullmq', () => ({
  Worker: class MockWorker {
    queueName: string;
    processor: Function;
    options: any;
    constructor(
      name: string,
      processor: Function,
      options: any
    ) {
      this.queueName = name;
      this.processor = processor;
      this.options = options;
    }
  },
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
  })),
}));

import { DocumentUploadWorker } from './document-upload.worker';
import { DatabaseService } from '../../shared/database/database.service';
import { Redis } from 'ioredis';
import { TextSplitterService } from '../chunking/text-splitter.service';

describe('DocumentUploadWorker', () => {
  let mockDatabase: any;
  let mockRedis: any;
  let mockEmbeddingQueue: any;
  let mockTextSplitter: jest.Mocked<TextSplitterService>;
  let mockPrisma: any;

  beforeEach(() => {
    mockQueueAdd.mockClear();
    mockSplitText.mockClear();

    mockEmbeddingQueue = { add: mockQueueAdd };

    // Create a single mockPrisma instance that persists across getPrismaClient calls
    mockPrisma = {
      document: {
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          tenant_id: 1,
        }),
      },
      documentChunk: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          { id: 101 },
          { id: 102 },
          { id: 103 },
        ]),
      },
    };

    mockDatabase = {
      getPrismaClient: jest.fn().mockReturnValue(mockPrisma),
    };

    mockTextSplitter = {
      splitText: mockSplitText,
    } as any;

    mockRedis = {};
  });

  // Helper to create a mock Job with updateProgress
  const createMockJob = () => ({
    data: {
      documentId: 1,
      filePath: '/path/to/file.pdf',
      mimetype: 'application/pdf',
    },
    updateProgress: jest.fn(),
  });

  it('should be defined', () => {
    expect(DocumentUploadWorker).toBeDefined();
  });

  it('should be instantiable with dependencies (database, embeddingQueue, textSplitter, redis)', () => {
    const worker = new DocumentUploadWorker(mockDatabase, mockEmbeddingQueue, mockTextSplitter, mockRedis);
    expect(worker).toBeDefined();
  });

  it('should set correct queue name', () => {
    const worker = new DocumentUploadWorker(mockDatabase, mockEmbeddingQueue, mockTextSplitter, mockRedis);
    expect((worker as any).queueName).toBe('document-upload');
  });

  it('should have concurrency of 2', () => {
    const worker = new DocumentUploadWorker(mockDatabase, mockEmbeddingQueue, mockTextSplitter, mockRedis);
    expect((worker as any).options.concurrency).toBe(2);
  });

  it('should use TextSplitterService to split text instead of inline chunking', async () => {
    const worker = new DocumentUploadWorker(mockDatabase, mockEmbeddingQueue, mockTextSplitter, mockRedis);

    // Access the processor function from the worker
    const processor = (worker as any).processor;

    // Execute the processor with mock job
    const mockJob = createMockJob();
    await processor(mockJob);

    // Verify TextSplitterService.splitText was called with extracted text
    expect(mockSplitText).toHaveBeenCalledWith('mock text content for testing');
  });

  it('should enqueue embedding jobs for each chunk using injected embeddingQueue', async () => {
    const worker = new DocumentUploadWorker(mockDatabase, mockEmbeddingQueue, mockTextSplitter, mockRedis);

    const processor = (worker as any).processor;
    const mockJob = createMockJob();
    await processor(mockJob);

    // Verify embeddingQueue.add was called for each chunk
    expect(mockQueueAdd).toHaveBeenCalledTimes(3);
    expect(mockQueueAdd).toHaveBeenCalledWith('embedding-generation', { chunkId: 101 });
    expect(mockQueueAdd).toHaveBeenCalledWith('embedding-generation', { chunkId: 102 });
    expect(mockQueueAdd).toHaveBeenCalledWith('embedding-generation', { chunkId: 103 });
  });

  it('should update document status to indexed on success', async () => {
    const worker = new DocumentUploadWorker(mockDatabase, mockEmbeddingQueue, mockTextSplitter, mockRedis);

    const processor = (worker as any).processor;
    const mockJob = createMockJob();
    await processor(mockJob);

    const prisma = mockDatabase.getPrismaClient();
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'indexed' },
    });
  });

  it('should update document status to error on failure', async () => {
    // Make splitText throw
    mockSplitText.mockRejectedValueOnce(new Error('Split failed'));

    const worker = new DocumentUploadWorker(mockDatabase, mockEmbeddingQueue, mockTextSplitter, mockRedis);

    const processor = (worker as any).processor;
    const mockJob = createMockJob();

    await expect(processor(mockJob)).rejects.toThrow('Split failed');

    const prisma = mockDatabase.getPrismaClient();
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'error', error_message: 'Split failed' },
    });
  });
});
