// Mock the processor imports before they're loaded
jest.mock('../processors/pdf.processor', () => ({
  PDFProcessor: class MockPDFProcessor {
    async extractText(filePath: string): Promise<string> {
      return 'mock text';
    }
  },
}));

jest.mock('../processors/docx.processor', () => ({
  DOCXProcessor: class MockDOCXProcessor {
    async extractText(filePath: string): Promise<string> {
      return 'mock text';
    }
  },
}));

jest.mock('../processors/txt.processor', () => ({
  TXTProcessor: class MockTXTProcessor {
    async extractText(filePath: string): Promise<string> {
      return 'mock text';
    }
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

describe('DocumentUploadWorker', () => {
  let mockDatabase: jest.Mocked<DatabaseService>;
  let mockRedis: any;

  beforeEach(() => {
    mockQueueAdd.mockClear();

    mockDatabase = {
      getPrismaClient: () => ({
        document: {
          update: jest.fn(),
          findUnique: jest.fn(),
        },
        documentChunk: {
          create: jest.fn(),
          findMany: jest.fn(),
        },
      }),
    } as any;

    mockRedis = {};
  });

  it('should be defined', () => {
    expect(DocumentUploadWorker).toBeDefined();
  });

  it('should be instantiable with dependencies', () => {
    const worker = new DocumentUploadWorker(mockDatabase, mockRedis);
    expect(worker).toBeDefined();
  });

  it('should set correct queue name', () => {
    const worker = new DocumentUploadWorker(mockDatabase, mockRedis);
    expect((worker as any).queueName).toBe('document-upload');
  });

  it('should have concurrency of 2', () => {
    const worker = new DocumentUploadWorker(mockDatabase, mockRedis);
    expect((worker as any).options.concurrency).toBe(2);
  });
});
