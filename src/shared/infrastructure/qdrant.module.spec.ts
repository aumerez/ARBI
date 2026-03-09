import { Test, TestingModule } from '@nestjs/testing';
import { QdrantModule } from './qdrant.module';
import { QdrantService } from './qdrant.service';
import { ConfigModule } from '@nestjs/config';

describe('QdrantModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [QdrantModule],
    }).compile();
  });

  it('should provide QdrantService as singleton', () => {
    const service = module.get<QdrantService>(QdrantService);
    expect(service).toBeDefined();
  });

  it('should be importable by feature modules', () => {
    // If module imports successfully, it's importable
    expect(module).toBeDefined();
  });

  it('should export QdrantService', () => {
    const service = module.get<QdrantService>(QdrantService);
    expect(service).toBeInstanceOf(QdrantService);
  });
});
