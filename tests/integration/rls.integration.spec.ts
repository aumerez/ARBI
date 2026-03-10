import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app/app.module';
import { PostgresService } from '../../src/shared/database/database.service';

describe('RLS Enforcement (TEN-01)', () => {
  let app: INestApplication;
  let db: PostgresService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    db = module.get<PostgresService>('PostgresService');
  });

  it('should verify RLS policies are enabled on tenant-scoped tables', async () => {
    // TEN-01: RLS policies defined and enforced
    // Query: SELECT relrowsecurity FROM pg_class WHERE relname = 'users'
    const result = await db.$executeRaw`
      SELECT relrowsecurity FROM pg_class WHERE relname = 'users'
    `;
    // Expect: relrowsecurity = true (1)
    // RED: Write test that asserts RLS enabled
  });

  it('should verify RLS policies exist for documents table', async () => {
    // TEN-01: Check documents table has RLS enabled
    const result = await db.$executeRaw`
      SELECT relrowsecurity FROM pg_class WHERE relname = 'documents'
    `;
    // Expect: relrowsecurity = true
  });

  afterAll(async () => {
    await app.close();
  });
});
