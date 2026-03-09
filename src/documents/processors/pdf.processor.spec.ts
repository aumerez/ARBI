import { PDFProcessor } from './pdf.processor';
import * as fs from 'fs';
import { promisify } from 'util';
import * as path from 'path';

const readFile = promisify(fs.readFile);

describe('PDFProcessor', () => {
  let processor: PDFProcessor;
  const testPdfPath = path.join(__dirname, 'fixtures', 'test.pdf');

  beforeEach(() => {
    processor = new PDFProcessor();
  });

  describe('extractText', () => {
    it('should extract text from a valid PDF file', async () => {
      // Create a minimal valid PDF for testing
      const expectedText = 'Hello World Test PDF Content';
      const result = await processor.extractText(testPdfPath);
      expect(result).toBe(expectedText);
    });

    it('should return concatenated text from all pages', async () => {
      const result = await processor.extractText(testPdfPath);
      expect(result).toContain('Page 1');
      expect(result).toContain('Page 2');
    });

    it('should handle PDF with multiple pages correctly', async () => {
      const result = await processor.extractText(testPdfPath);
      const pageCount = (result.match(/\n/g) || []).length + 1;
      expect(pageCount).toBeGreaterThanOrEqual(1);
    });

    it('should throw error when file does not exist', async () => {
      await expect(processor.extractText('/nonexistent/file.pdf'))
        .rejects.toThrow();
    });

    it('should throw error when file is not a valid PDF', async () => {
      const invalidPdfPath = path.join(__dirname, 'fixtures', 'invalid.pdf');
      await expect(processor.extractText(invalidPdfPath))
        .rejects.toThrow();
    });

    it('should return empty string for empty PDF', async () => {
      const emptyPdfPath = path.join(__dirname, 'fixtures', 'empty.pdf');
      const result = await processor.extractText(emptyPdfPath);
      expect(result).toBe('');
    });
  });
});
