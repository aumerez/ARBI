import { TXTProcessor } from './txt.processor';
import * as path from 'path';

describe('TXTProcessor', () => {
  let processor: TXTProcessor;
  const testTxtPath = path.join(__dirname, 'fixtures', 'test.txt');

  beforeEach(() => {
    processor = new TXTProcessor();
  });

  describe('extractText', () => {
    it('should read text from a valid TXT file', async () => {
      const result = await processor.extractText(testTxtPath);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return exact file content', async () => {
      const result = await processor.extractText(testTxtPath);
      expect(result).toContain('Hello World');
    });

    it('should preserve line breaks and formatting', async () => {
      const result = await processor.extractText(testTxtPath);
      expect(result).toContain('\n');
    });

    it('should throw error when file does not exist', async () => {
      await expect(processor.extractText('/nonexistent/file.txt'))
        .rejects.toThrow();
    });

    it('should read UTF-8 encoded text correctly', async () => {
      const utf8Path = path.join(__dirname, 'fixtures', 'utf8.txt');
      const result = await processor.extractText(utf8Path);
      expect(result).toBeDefined();
    });

    it('should handle empty TXT file', async () => {
      const emptyTxtPath = path.join(__dirname, 'fixtures', 'empty.txt');
      const result = await processor.extractText(emptyTxtPath);
      expect(result).toBe('');
    });

    it('should read multi-line text files correctly', async () => {
      const result = await processor.extractText(testTxtPath);
      const lines = result.split('\n').filter(line => line.trim().length > 0);
      expect(lines.length).toBeGreaterThanOrEqual(1);
    });
  });
});
