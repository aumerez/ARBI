import { Worker, Job, Queue } from 'bullmq';
import { DatabaseService } from '../../shared/database/database.service';
import { Redis } from 'ioredis';
import { PDFProcessor } from '../processors/pdf.processor';
import { DOCXProcessor } from '../processors/docx.processor';
import { TXTProcessor } from '../processors/txt.processor';

export class DocumentUploadWorker extends Worker {
  constructor(
    private database: DatabaseService,
    private redisConn: Redis,
  ) {
    // Capture dependencies in local closure
    const databaseRef = database;
    const redisRef = redisConn;

    // Define processor function that uses closures
    const processor = async (job: Job) => {
      const { documentId, filePath, mimetype } = job.data;
      const prisma = databaseRef.getPrismaClient();

      try {
        // Update document status to processing
        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'processing' },
        });

        // Extract text based on mimetype
        let text: string;
        if (mimetype === 'application/pdf') {
          const processorImpl = new PDFProcessor();
          text = await processorImpl.extractText(filePath);
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const processorImpl = new DOCXProcessor();
          text = await processorImpl.extractText(filePath);
        } else if (mimetype === 'text/plain') {
          const processorImpl = new TXTProcessor();
          text = await processorImpl.extractText(filePath);
        } else {
          throw new Error(`Unsupported mimetype: ${mimetype}`);
        }

        // Basic inline chunking (will be replaced by TextSplitterService in 04b)
        const chunkSize = 1000;
        const chunkOverlap = 200;
        const chunks: string[] = [];
        let start = 0;

        while (start < text.length) {
          const end = Math.min(start + chunkSize, text.length);
          chunks.push(text.slice(start, end));
          start += chunkSize - chunkOverlap;
        }

        // Get document's tenant_id
        const document = await prisma.document.findUnique({
          where: { id: documentId },
        });

        if (!document) {
          throw new Error(`Document ${documentId} not found`);
        }

        // Create DocumentChunk records
        for (let i = 0; i < chunks.length; i++) {
          await prisma.documentChunk.create({
            data: {
              tenant_id: document.tenant_id,
              document_id: documentId,
              chunk_index: i,
              content: chunks[i],
              token_count: Math.ceil(chunks[i].length / 4), // rough estimate
            },
          });
        }

        // Fetch created chunks to get IDs
        const createdChunks = await prisma.documentChunk.findMany({
          where: { document_id: documentId },
          orderBy: { chunk_index: 'asc' },
        });
        const chunkIds = createdChunks.map(c => c.id);

        // Add jobs to embedding-generation queue
        const embeddingQueue = new Queue('embedding-generation', {
          connection: redisRef as any,
        });
        for (const chunkId of chunkIds) {
          await embeddingQueue.add('embedding-generation', { chunkId });
        }

        // Update document status to indexed
        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'indexed' },
        });

        job.updateProgress(100);
      } catch (error: any) {
        // Mark document as error
        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'error', error_message: error.message },
        });
        throw error; // BullMQ will handle retry
      }
    };

    super('document-upload', processor, {
      connection: redisConn as any,
      concurrency: 2,
    });
  }
}
