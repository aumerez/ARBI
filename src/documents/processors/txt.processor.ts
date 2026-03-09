import { readFile } from 'fs/promises';

export class TXTProcessor {
  async extractText(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, 'utf8');
    } catch (error: any) {
      throw new Error(`Failed to read TXT file: ${error.message}`);
    }
  }
}
