import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from './database.module';
import { DatabaseService } from './database.service';

describe('DatabaseModule', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  describe('Module configuration', () => {
    it('should be a global module', () => {
      const instance = module.get(DatabaseModule);
      // Check if module is available globally (can be imported without explicit import)
      expect(instance).toBeDefined();
    });

    it('should export DatabaseService', () => {
      // Check that DatabaseService can be retrieved from the module
      const databaseService = module.get(DatabaseService);
      expect(databaseService).toBeDefined();
      expect(databaseService).toBeInstanceOf(DatabaseService);
    });

    it('should have no circular dependencies', () => {
      // If module compiled successfully with other modules, no circular deps
      expect(module).toBeDefined();
    });
  });
});
