import { readFile } from 'fs/promises';
import { TXTProcessor } from './txt.processor';

jest.mock('fs/promises');

describe('TXTProcessor', () => {
  let processor: TXTProcessor;

  beforeEach(() => {
    processor = new TXTProcessor();
    jest.clearAllMocks();
  });

  it('should read text from TXT file with UTF-8 encoding', async () => {
    const content = 'Hello World from TXT';
    (readFile as jest.Mock).mockResolvedValue(content);

    const result = await processor.extractText('/any.txt');

    expect(readFile).toHaveBeenCalledWith('/any.txt', 'utf8');
    expect(result).toBe(content);
  });

  it('should throw when file does not exist', async () => {
    (readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));

    await expect(processor.extractText('/missing.txt'))
      .rejects.toThrow('Failed to read TXT file: ENOENT');
  });

  it('should handle empty file', async () => {
    (readFile as jest.Mock).mockResolvedValue('');

    const result = await processor.extractText('/empty.txt');

    expect(result).toBe('');
  });

  it('should preserve line breaks and content', async () => {
    const content = 'Line1\nLine2\nLine3';
    (readFile as jest.Mock).mockResolvedValue(content);

    const result = await processor.extractText('/any.txt');

    expect(result).toContain('\n');
    expect(result).toBe(content);
  });
});
