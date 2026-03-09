import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Prisma Schema - Multi-tenancy', () => {
  const schemaPath = join(__dirname, '../../prisma/schema.prisma');
  let schemaContent: string;

  beforeAll(() => {
    expect(existsSync(schemaPath)).toBe(true);
    schemaContent = readFileSync(schemaPath, 'utf-8');
  });

  describe('Tenant model', () => {
    it('should define Tenant model with required fields', () => {
      expect(schemaContent).toContain('model Tenant {');
      expect(schemaContent).toContain('id           Int            @id @default(autoincrement())');
      expect(schemaContent).toContain('name         String');
      expect(schemaContent).toContain('plan         String?');
      expect(schemaContent).toContain('created_at   DateTime       @default(now())');
      expect(schemaContent).toContain('updated_at   DateTime       @updatedAt');
    });

    it('should have relations to all tenant-scoped tables', () => {
      expect(schemaContent).toContain('users        User[]');
      expect(schemaContent).toContain('documents    Document[]');
      expect(schemaContent).toContain('chats        Chat[]');
      expect(schemaContent).toContain('chatMessages ChatMessage[]');
      expect(schemaContent).toContain('documentChunks DocumentChunk[]');
      expect(schemaContent).toContain('refreshTokens RefreshToken[]');
      expect(schemaContent).toContain('passwordResetTokens PasswordResetToken[]');
      expect(schemaContent).toContain('auditLogs    AuditLog[]');
    });
  });

  describe('Tenant-scoped tables', () => {
    const tenantScopedTables = [
      'User',
      'Document',
      'DocumentChunk',
      'Chat',
      'ChatMessage',
      'RefreshToken',
      'PasswordResetToken',
      'AuditLog'
    ];

    tenantScopedTables.forEach((table) => {
      describe(`${table}`, () => {
        it(`should have tenant_id field as Int (not nullable)`, () => {
          const pattern = new RegExp(`model ${table} \\{[^}]*tenant_id\\s+Int`);
          expect(schemaContent).toMatch(pattern);
        });

        it(`should have @relation to tenants.id with onDelete Cascade`, () => {
          const pattern = new RegExp(
            `tenant\\s+Tenant\\s+@relation\\(fields: \\[tenant_id\\], references: \\[id\\], onDelete: Cascade\\)`
          );
          expect(schemaContent).toMatch(pattern);
        });

        it(`should have @@index on tenant_id`, () => {
          const pattern = new RegExp(`@@index\\(\\[tenant_id\\]\\)`);
          const tableMatch = schemaContent.match(new RegExp(`model ${table} \\{[\\s\\S]*?\\n\\}`));
          expect(tableMatch).not.toBeNull();
          expect(tableMatch![0]).toMatch(pattern);
        });
      });
    });
  });

  describe('User model constraints', () => {
    it('should maintain unique constraint on email', () => {
      expect(schemaContent).toContain('email            String         @unique');
    });
  });

  describe('Schema validation', () => {
    it('should be a valid Prisma schema (basic structure check)', () => {
      expect(schemaContent).toContain('generator client {');
      expect(schemaContent).toContain('provider = "prisma-client-js"');
      expect(schemaContent).toContain('datasource db {');
      expect(schemaContent).toContain('provider = "postgresql"');
      expect(schemaContent).toContain('url      = env("DATABASE_URL")');
    });
  });
});
