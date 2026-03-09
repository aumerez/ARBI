import { Test, TestingModule } from '@nestjs/testing';
import { TextSplitterService } from '../../src/documents/chunking/text-splitter.service';

describe('TextSplitterService (DOC-07)', () => {
  let service: TextSplitterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TextSplitterService],
    }).compile();

    service = module.get<TextSplitterService>(TextSplitterService);
  });

  describe('splitText', () => {
    it('should split text into chunks of 500-1500 tokens', async () => {
      // RED: Test to be implemented
      const longText = ' '.repeat(3000); // Mock long text
      const chunks = await service.splitText(longText);
      chunks.forEach((chunk) => {
        const tokenCount = chunk.split(' ').length;
        expect(tokenCount).toBeGreaterThanOrEqual(500);
        expect(tokenCount).toBeLessThanOrEqual(1500);
      });
    });

    it('should apply 10-20% overlap between chunks', async () => {
      // RED: Test to be implemented
      // Verify that consecutive chunks share ~15% of content
    });

    it('should respect sentence boundaries', async () => {
      // RED: Test to be implemented - dont split mid-sentence
    });

    it('should handle text shorter than min chunk size', async () => {
      // RED: Test to be implemented - return single chunk
    });

    it('should preserve document structure with semantic splitting', async () => {
      // RED: Test to be implemented - split on paragraphs, not arbitrary points
    });
  });
});
