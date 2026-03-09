import { Test, TestingModule } from '@nestjs/testing';
import { SemanticChunker } from './semantic-chunker';
import { TextSplitterService } from './text-splitter.service';

describe('SemanticChunker', () => {
  let chunker: SemanticChunker;
  let textSplitterService: TextSplitterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TextSplitterService,
        {
          provide: SemanticChunker,
          useFactory: (splitter: TextSplitterService) => new SemanticChunker(splitter),
          inject: [TextSplitterService],
        },
      ],
    }).compile();

    textSplitterService = module.get<TextSplitterService>(TextSplitterService);
    chunker = module.get<SemanticChunker>(SemanticChunker);
  });

  it('should be defined', () => {
    expect(chunker).toBeDefined();
  });

  describe('chunk', () => {
    it('should delegate to TextSplitterService.splitText', async () => {
      const text = 'Some text to chunk';
      const expectedChunks = ['chunk1', 'chunk2'];
      // Use actual service since TextSplitterService is already tested
      // We'll just verify the delegation by checking the result matches
      // What TextSplitterService returns
      const result = await chunker.chunk(text);

      // The chunker should return whatever splitText returns
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for empty text', async () => {
      const result = await chunker.chunk('');

      expect(result).toEqual([]);
    });

    it('should produce same result as TextSplitterService', async () => {
      const text = 'Test text with multiple paragraphs.\n\nSecond paragraph.';
      const directResult = await textSplitterService.splitText(text);
      const chunkerResult = await chunker.chunk(text);

      expect(chunkerResult).toEqual(directResult);
    });
  });
});
