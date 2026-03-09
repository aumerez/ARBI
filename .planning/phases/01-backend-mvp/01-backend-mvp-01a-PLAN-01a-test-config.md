---
phase: 01-backend-mvp
plan: 01a
type: execute
wave: 0
depends_on: []
files_modified:
  - jest.config.js
  - tsconfig.json
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
    - "Jest test framework initialized with TypeScript support and coverage thresholds"
    - "Test discovery pattern configured to find all *.spec.ts files"
  artifacts:
    - path: "jest.config.js"
      provides: "Jest configuration with ts-jest preset and NestJS settings"
      min_lines: 20
    - path: "tsconfig.json"
      provides: "TypeScript configuration extending build config for tests"
      contains:
        - "extends"
        - "compilerOptions"
  key_links:
    - from: "jest.config.js"
      to: "all test files"
      via: "test runner loads configuration"
      pattern: "module.exports = { preset: 'ts-jest'"

---

<objective>
Initialize Jest test framework with TypeScript support and configure coverage thresholds

Purpose: Establish testing infrastructure for TDD approach. All subsequent test files will rely on this configuration.

Output: Working jest.config.js and tsconfig.json for test execution

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

# Research insights:
- Jest 29.x with ts-jest preset for TypeScript
- Coverage thresholds: ≥80% (branches, functions, lines, statements)
- Test discovery: **/*.spec.ts pattern
- Environment: node test environment

</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Jest configuration</name>
  <files>
    jest.config.js
  </files>
  <action>
    Create jest.config.js with:
    - preset: 'ts-jest'
    - testEnvironment: 'node'
    - testMatch: ['**/*.spec.ts']
    - coverageDirectory: 'coverage'
    - collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts']
    - coverageThreshold: { global: { branches: 80, functions: 80, lines: 80, statements: 80 } }
    - moduleFileExtensions: ['ts', 'js', 'json']
    - transform: { '^.+\\.ts$': 'ts-jest' }
    - testTimeout: 30000

    Verify: Jest can parse config without syntax errors.
  </action>
  <verify>
    <automated>npx jest --showConfig 2>&1 | grep -q "preset.*ts-jest"</automated>
  </verify>
  <done>Jest configured with ts-jest preset and coverage thresholds</done>
</task>

<task type="auto">
  <name>Task 2: Update tsconfig for tests</name>
  <files>
    tsconfig.json
  </files>
  <action>
    Ensure tsconfig.json extends appropriate build config:
    - If using NestJS standard structure, extend ./tsconfig.build.json
    - Include jest types: "types": ["jest", "node"]
    - Compiler options: module=commonjs, esModuleInterop=true, sourceMap=true

    Example structure:
    ```json
    {
      "extends": "./tsconfig.build.json",
      "compilerOptions": {
        "types": ["jest", "node"],
        "outDir": "./dist",
        "rootDir": "./"
      },
      "include": ["src/**/*", "tests/**/*"],
      "exclude": ["node_modules", "dist"]
    }
    ```

    Verify: TypeScript compiles test files without errors.
  </action>
  <verify>
    <automated>npx tsc --noEmit tests/conftest.ts 2>&1 | grep -q "error" && echo "TypeScript errors" || echo "TypeScript check passed"</automated>
  </verify>
  <done>TypeScript test configuration ready</done>
</task>

</tasks>

<verification>
Wave 0a - Test framework foundation complete

**Automated checks:**
1. Jest config valid: `npx jest --showConfig` returns valid JSON with ts-jest preset
2. Test discovery works: `npx jest --listTests` shows test files (may be empty initially)
3. TypeScript compiles: `npx tsc --noEmit` succeeds for src/ and tests/

**Success criteria:**
- jest.config.js exists with correct preset and coverage settings
- tsconfig.json includes jest types and proper include/exclude patterns
- `npm test` command ready to run (even with zero tests)

</verification>

<success_criteria>
Test scaffolding Phase 0a complete when:
- [ ] jest.config.js created with 20+ lines including preset, coverage thresholds, testMatch
- [ ] tsconfig.json extends build config and includes "jest" in types
- [ ] `npx jest --showConfig` executes without errors
- [ ] `npx tsc --noEmit` passes for tests/ directory
- [ ] Coverage thresholds set: ≥80% for branches, functions, lines, statements

</success_criteria>

<output>
After completion, create `.planning/phases/01-backend-mvp/01-backend-mvp-01a-PLAN-01a-summary.md`
</output>
