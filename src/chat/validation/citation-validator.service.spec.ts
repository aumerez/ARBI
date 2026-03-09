import { Test, TestingModule } from '@nestjs/testing';
import { CitationValidatorService } from './citation-validator.service';

describe('CitationValidatorService', () => {
  let service: CitationValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CitationValidatorService],
    }).compile();

    service = module.get<CitationValidatorService>(CitationValidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validate', () => {
    it('should return valid when no citations and no chunks', () => {
      const result = service.validate('No citations here', 0);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return invalid when citations present but no chunks', () => {
      const result = service.validate('See [1] and [2]', 0);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Citations present but no retrieved chunks');
    });

    it('should return valid when all citations within range', () => {
      const result = service.validate('See [1] and [2]', 2);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return invalid when citation exceeds chunk count', () => {
      const result = service.validate('See [1] and [3]', 2);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid citation [3]: expected 1-2');
    });

    it('should return invalid when citation is zero', () => {
      const result = service.validate('See [0]', 2);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid citation [0]: expected 1-2');
    });

    it('should handle multiple invalid citations', () => {
      const result = service.validate('See [0] [3] [5]', 2);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain('Invalid citation [0]: expected 1-2');
      expect(result.errors).toContain('Invalid citation [3]: expected 1-2');
      expect(result.errors).toContain('Invalid citation [5]: expected 1-2');
    });

    it('should extract citations with regex pattern', () => {
      const result = service.validate('See [1], [2], and [10]', 10);
      expect(result.valid).toBe(true);
    });

    it('should ignore non-numeric brackets', () => {
      const result = service.validate('See [abc] and [1]', 1);
      expect(result.valid).toBe(true);
    });

    it('should ignore negative numbers (regex only captures \\d+)', () => {
      // Regex \[(\d+)\] only matches positive digits, so -1 is not extracted
      const result = service.validate('See [-1]', 2);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle empty text', () => {
      const result = service.validate('', 2);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle large chunk counts', () => {
      const result = service.validate('See [100]', 100);
      expect(result.valid).toBe(true);
    });

    it('should validate edge case: citation at exact upper bound', () => {
      const result = service.validate('See [5]', 5);
      expect(result.valid).toBe(true);
    });

    it('should validate edge case: citation at exact lower bound', () => {
      const result = service.validate('See [1]', 5);
      expect(result.valid).toBe(true);
    });

    it('should invalidate citation just above upper bound', () => {
      const result = service.validate('See [6]', 5);
      expect(result.valid).toBe(false);
    });
  });
});
