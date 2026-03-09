import { TextSplitterService } from './text-splitter.service';

export class SemanticChunker {
  constructor(private readonly textSplitter: TextSplitterService) {}

  async chunk(text: string): Promise<string[]> {
    // For MVP, just delegate to TextSplitterService
    return this.textSplitter.splitText(text);
  }
}
