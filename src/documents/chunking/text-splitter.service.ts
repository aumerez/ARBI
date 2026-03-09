import { Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

@Injectable()
export class TextSplitterService {
  private splitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.splitter = new RecursiveCharacterTextSplitter({
      separators: ['\n\n', '\n', '. ', ' ', ''],
      chunkSize: 2000, // ~500-1500 tokens (roughly 4 chars/token)
      chunkOverlap: 400, // 20% overlap
      lengthFunction: (text) => text.length, // character count
    });
  }

  async splitText(text: string): Promise<string[]> {
    const docs = await this.splitter.splitText(text);
    // RecursiveCharacterTextSplitter.splitText returns string[], but type definition can be inconsistent
    return docs as unknown as string[];
  }

  // Optional: allow runtime config
  setChunkOptions(chunkSize: number, chunkOverlap: number): void {
    this.splitter = new RecursiveCharacterTextSplitter({
      separators: ['\n\n', '\n', '. ', ' ', ''],
      chunkSize,
      chunkOverlap,
      lengthFunction: (text) => text.length,
    });
  }
}
