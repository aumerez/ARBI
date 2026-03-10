import { Test, TestingModule } from '@nestjs/testing';
import { StatusService } from '../../src/documents/status.service';
import { MockPostgresService } from '../mocks/postgres.service';
import { DocumentBuilder } from '../conftest';

describe('StatusService (DOC-03, DOC-04)', () => {
  let service: StatusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatusService,
        { provide: 'PostgresService', useClass: MockPostgresService },
      ],
    }).compile();

    service = module.get<StatusService>(StatusService);
  });

  describe('trackStatus', () => {
    it('should track job status (queued -> processing -> indexed)', async () => {
      // RED: Test to be implemented
    });

    it('should allow status transitions only in valid order', async () => {
      // RED: Test to be implemented - state machine validation
    });

    it('should record error_message when status is error', async () => {
      // RED: Test to be implemented
    });
  });

  describe('getStatus', () => {
    it('should return current status with timestamp', async () => {
      // RED: Test to be implemented
    });

    it('should return 404 for unknown document', async () => {
      // RED: Test to be implemented
    });
  });
});
