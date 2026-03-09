// Mock dependencies before importing processor
jest.mock('pdfjs-dist', () => ({
  getDocument: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

import { readFile } from 'fs/promises';
import { getDocument } from 'pdfjs-dist';
import { PDFProcessor } from './pdf.processor';

describe('PDFProcessor', () => {
  let processor: PDFProcessor;

  beforeEach(() => {
    processor = new PDFProcessor();
    jest.clearAllMocks();
  });

  it('should extract text from PDF by reading file and using pdfjs-dist', async () => {
    const mockBuffer = Buffer.from('fake pdf data');
    const mockPage = {
      getTextContent: jest.fn().mockResolvedValue({
        items: [{ str: 'Hello' }, { str: 'World' }],
      }),
    };
    const mockPdf = {
      numPages: 1,
      getPage: jest.fn().mockResolvedValue(mockPage),
    };
    (getDocument as jest.Mock).mockReturnValue({ promise: Promise.resolve(mockPdf) });
    (readFile as jest.Mock).mockResolvedValue(mockBuffer);

    const result = await processor.extractText('/any.pdf');

    expect(readFile).toHaveBeenCalledWith('/any.pdf');
    expect(getDocument).toHaveBeenCalledWith({ data: mockBuffer });
    expect(mockPdf.getPage).toHaveBeenCalledWith(1);
    expect(result).toBe('Hello World');
  });

  it('should concatenate text from multiple pages with newlines', async () => {
    const mockBuffer = Buffer.from('fake pdf data');
    const mockPage1 = { getTextContent: jest.fn().mockResolvedValue({ items: [{ str: 'Page1' }] }) };
    const mockPage2 = { getTextContent: jest.fn().mockResolvedValue({ items: [{ str: 'Page2' }] }) };
    const mockPdf = {
      numPages: 2,
      getPage: jest.fn()
        .mockResolvedValueOnce(mockPage1)
        .mockResolvedValueOnce(mockPage2),
    };
    (getDocument as jest.Mock).mockReturnValue({ promise: Promise.resolve(mockPdf) });
    (readFile as jest.Mock).mockResolvedValue(mockBuffer);

    const result = await processor.extractText('/any.pdf');

    expect(result).toBe('Page1\nPage2');
  });

  it('should throw error when file read fails', async () => {
    (readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

    await expect(processor.extractText('/nonexistent.pdf'))
      .rejects.toThrow('Failed to extract text from PDF: File not found');
  });

  it('should throw error when pdfjs-dist fails', async () => {
    (readFile as jest.Mock).mockResolvedValue(Buffer.from('data'));
    (getDocument as jest.Mock).mockReturnValue({ promise: Promise.reject(new Error('Invalid PDF')) });

    await expect(processor.extractText('/fake.pdf'))
      .rejects.toThrow('Failed to extract text from PDF: Invalid PDF');
  });
});
