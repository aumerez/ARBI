import { readFile } from 'fs/promises';
import * as mammoth from 'mammoth';
import { DOCXProcessor } from './docx.processor';

jest.mock('fs/promises');
jest.mock('mammoth');

describe('DOCXProcessor', () => {
  let processor: DOCXProcessor;

  beforeEach(() => {
    processor = new DOCXProcessor();
    jest.clearAllMocks();
  });

  it('should extract raw text from DOCX', async () => {
    const mockBuffer = Buffer.from('fake docx data');
    (readFile as jest.Mock).mockResolvedValue(mockBuffer);
    (mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: 'Hello World from DOCX' });

    const result = await processor.extractText('/any.docx');

    expect(readFile).toHaveBeenCalledWith('/any.docx');
    expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer: mockBuffer });
    expect(result).toBe('Hello World from DOCX');
  });

  it('should throw when file read fails', async () => {
    (readFile as jest.Mock).mockRejectedValue(new Error('No such file'));

    await expect(processor.extractText('/missing.docx'))
      .rejects.toThrow('Failed to extract text from DOCX: No such file');
  });

  it('should throw when mammoth fails', async () => {
    (readFile as jest.Mock).mockResolvedValue(Buffer.from('data'));
    (mammoth.extractRawText as jest.Mock).mockRejectedValue(new Error('Corrupt DOCX'));

    await expect(processor.extractText('/corrupt.docx'))
      .rejects.toThrow('Failed to extract text from DOCX: Corrupt DOCX');
  });
});
