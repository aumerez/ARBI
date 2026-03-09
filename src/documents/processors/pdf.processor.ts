import { getDocument } from 'pdfjs-dist';
import { readFile } from 'fs/promises';

export class PDFProcessor {
  async extractText(filePath: string): Promise<string> {
    try {
      const data = await readFile(filePath);
      const pdf = await getDocument({ data }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      return fullText.trim();
    } catch (error: any) {
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }
}
