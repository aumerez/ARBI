import * as mammoth from 'mammoth';
import { readFile } from 'fs/promises';

export class DOCXProcessor {
  async extractText(filePath: string): Promise<string> {
    try {
      const buffer = await readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error: any) {
      throw new Error(`Failed to extract text from DOCX: ${error.message}`);
    }
  }
}
