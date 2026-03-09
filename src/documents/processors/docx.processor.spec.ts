import { DOCXProcessor } from './docx.processor';
import * as fs from 'fs';
import { promisify } from 'util';
import * as path from 'path';

const readFile = promisify(fs.readFile);

describe('DOCXProcessor', () => {
  let processor: DOCXProcessor;
  const testDocxPath = path.join(__dirname, 'fixtures', 'test.docx');

  beforeEach(() => {
    processor = new DOCXProcessor();
  });

  describe('extractText', () => {
    it('should extract raw text from a valid DOCX file', async () => {
      const result = await processor.extractText(testDocxPath);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should extract text content without markup', async () => {
      const result = await processor.extractText(testDocxPath);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should preserve paragraph structure with line breaks', async () => {
      const result = await processor.extractText(testDocxPath);
      expect(result).toContain('\n');
    });

    it('should throw error when file does not exist', async () => {
      await expect(processor.extractText('/nonexistent/file.docx'))
        .rejects.toThrow();
    });

    it('should throw error when file is not a valid DOCX', async () => {
      const invalidDocxPath = path.join(__dirname, 'fixtures', 'invalid.docx');
      await expect(processor.extractText(invalidDocxPath))
        .rejects.toThrow();
    });

    it('should handle empty DOCX file', async () => {
      const emptyDocxPath = path.join(__dirname, 'fixtures', 'empty.docx');
      const result = await processor.extractText(emptyDocxPath);
      expect(result).toBe('');
    });

    it('should extract text from DOCX with multiple paragraphs', async () => {
      const result = await processor.extractText(testDocxPath);
      const paragraphs = result.split('\n').filter(p => p.trim().length > 0);
      expect(paragraphs.length).toBeGreaterThan(1);
    });
  });
});
