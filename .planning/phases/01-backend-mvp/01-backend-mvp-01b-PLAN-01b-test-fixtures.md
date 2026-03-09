---
phase: 01-backend-mvp
plan: 01b
type: execute
wave: 1
depends_on:
  - 01a
files_modified:
  - tests/conftest.ts
  - tests/fixtures/sample.pdf
  - tests/fixtures/sample.docx
  - tests/fixtures/sample.txt
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - DOC-01
  - DOC-02
  - DOC-03
  - DOC-04
  - DOC-05
  - DOC-06
  - DOC-07
  - DOC-08
  - CHAT-01
  - CHAT-02
  - CHAT-03
  - CHAT-04
  - CHAT-10
  - CHAT-11
  - CHAT-12
  - QUAL-03
user_setup: []
must_haves:
  truths:
    - "Shared test fixtures provide mocks for database, Redis, Qdrant"
    - "Test data builders exist for User, Document, Chat fixtures"
    - "Sample document fixtures (PDF, DOCX, TXT) are valid and parsable"
  artifacts:
    - path: "tests/conftest.ts"
      provides: "Global test fixtures and mocking setup"
      min_lines: 50
    - path: "tests/fixtures/sample.pdf"
      provides: "Valid PDF fixture with extractable text for processor tests"
      min_size_kb: 10
    - path: "tests/fixtures/sample.docx"
      provides: "Valid DOCX fixture with structured content"
      min_size_kb: 5
    - path: "tests/fixtures/sample.txt"
      provides: "Plain text fixture with sections and paragraphs"
      min_size_kb: 5
  key_links:
    - from: "tests/conftest.ts"
      to: "all test files"
      via: "global imports and test module setup"
      pattern: "import.*conftest"

---

<objective>
Create shared test fixtures and sample document files for all Phase 1 tests

Purpose: Provide reusable test infrastructure: database mocks, Redis mock, Qdrant mock, test data builders, and real document fixtures (PDF, DOCX, TXT) for processor validation.

Output: Complete test fixture infrastructure ready for test implementation

</objective>

<execution_context>
@/Users/franciscoegloff/.claude/get-shit-done/workflows/execute-plan.md
@/Users/franciscoegloff/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-backend-mvp/01-CONTEXT.md
@.planning/phases/01-backend-mvp/01-RESEARCH.md

# Research requirements for test fixtures:
- Database mocks: MockPostgresService simulating Prisma with RLS context
- Redis mocks: MockRedisService for BullMQ worker tests
- Qdrant mocks: MockQdrantService returning test SearchResult arrays
- Test data builders: UserBuilder, DocumentBuilder, ChunkBuilder for consistent test data
- Helper functions: mockJwtPayload(tenantId, userId), mockUploadFile(buffer, mimetype)
- Fixtures: sample documents that can be parsed by pdfjs-dist, mammoth, and native fs

</context>

<tasks>
<task type="auto">
  <name>Task 1: Create conftest.ts with global fixtures</name>
  <files>
    tests/conftest.ts
  </files>
  <action>
    Create tests/conftest.ts with database mock, Redis mock, Qdrant mock, test data builders, and helper functions as described in the original plan.
  </action>
  <verify>
    <automated>node -e "require('./tests/conftest.ts')" 2>&1 | grep -q "error" && echo "Import failed" || echo "Conftest loads"</automated>
  </verify>
  <done>Shared test fixtures created</done>
</task>

<task type="auto">
  <name>Task 2: Create sample document fixtures (PDF, DOCX, TXT)</name>
  <files>
    tests/fixtures/sample.pdf
    tests/fixtures/sample.docx
    tests/fixtures/sample.txt
  </files>
  <action>
    Generate three sample document files using appropriate libraries (pdfkit, mammoth). Ensure:
    - PDF: >10KB, valid %PDF- header, ~1000 words
    - DOCX: >5KB, valid structure, ~800 words
    - TXT: >5KB, contains "Section 1" and "Section 2", ~1500 words
  </action>
  <verify>
    <automated>
      ls -lh tests/fixtures/{sample.pdf,sample.docx,sample.txt} &&
      head -c 5 tests/fixtures/sample.pdf | grep -q "%PDF-" &&
      node -e "const fs=require('fs'); const txt=fs.readFileSync('tests/fixtures/sample.txt','utf8'); console.log('Has sections:', /Section 1/.test(txt) && /Section 2/.test(txt));" &&
      echo "All fixtures valid"
    </automated>
  </verify>
  <done>PDF, DOCX, TXT fixtures created</done>
</task>
</tasks>

<verification>
Wave 0b - Test fixtures complete

**Automated checks:**
1. Conftest imports without errors: `node -e "require('./tests/conftest.ts')"` succeeds
2. All fixture files exist: `ls tests/fixtures/*.{pdf,docx,txt}` shows 3 files
3. File sizes: PDF >10KB, DOCX >5KB, TXT >5KB
4. PDF header valid: `%PDF-` present in first 5 bytes
5. TXT contains expected section markers

**Coverage:** These fixtures enable unit tests for document processors and chunking across DOC-06 and DOC-07 requirements.

</verification>

<success_criteria>
Test fixtures ready when:
- [ ] tests/conftest.ts exists with MockPostgresService, MockRedisService, MockQdrantService, test builders
- [ ] tests/fixtures/sample.pdf exists, >10KB, valid PDF header
- [ ] tests/fixtures/sample.docx exists, >5KB, valid DOCX structure
- [ ] tests/fixtures/sample.txt exists, >5KB, contains "Section 1" and "Section 2"
- [ ] Helper functions (mockJwtPayload, mockUploadFile) exported from conftest
- [ ] All mocks implement methods needed by test suites (see RESEARCH.md validation section)

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-01b-PLAN-01b-summary.md`
</output>
