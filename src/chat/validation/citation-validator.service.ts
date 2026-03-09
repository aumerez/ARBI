import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CitationValidatorService {
  private readonly logger = new Logger(CitationValidatorService.name);
  private readonly citationRegex = /\[(\d+)\]/g;

  validate(text: string, retrievedChunkCount: number): { valid: boolean; errors: string[] } {
    if (retrievedChunkCount === 0) {
      // No chunks, any citation is invalid
      const citations = this.extractCitations(text);
      if (citations.length > 0) {
        return { valid: false, errors: ['Citations present but no retrieved chunks'] };
      }
      return { valid: true, errors: [] };
    }

    const errors: string[] = [];
    const citations = this.extractCitations(text);
    for (const num of citations) {
      if (num < 1 || num > retrievedChunkCount) {
        errors.push(`Invalid citation [${num}]: expected 1-${retrievedChunkCount}`);
      }
    }

    const valid = errors.length === 0;
    return { valid, errors };
  }

  private extractCitations(text: string): number[] {
    const matches = text.matchAll(this.citationRegex);
    const numbers: number[] = [];
    for (const match of Array.from(matches)) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
    return numbers;
  }
}
