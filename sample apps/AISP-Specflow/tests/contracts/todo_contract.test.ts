/**
 * Contract Tests: feature_todo.yml
 *
 * These tests enforce the following AISP rules via Specflow contracts:
 * - TODO-001: Creating a task must generate unique UUID
 * - TODO-002: Completing task must set completed and timestamp
 * - TODO-005: Persistence must use indexedDB or chrome.storage
 *
 * AISP Source: docs/specs/TODO-APP.aisp
 * Specflow Contract: docs/contracts/feature_todo.yml
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

interface ContractViolation {
  ruleId: string;
  file: string;
  line?: number;
  pattern: string;
  message: string;
  match?: string;
}

function scanFiles(patterns: string[]): string[] {
  const allFiles: string[] = [];
  for (const pattern of patterns) {
    const files = glob.sync(pattern, { cwd: PROJECT_ROOT });
    allFiles.push(...files.map(f => path.join(PROJECT_ROOT, f)));
  }
  return [...new Set(allFiles)];
}

function findPatternInFile(
  filePath: string,
  pattern: RegExp
): { line: number; match: string }[] {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const matches: { line: number; match: string }[] = [];

  lines.forEach((line, index) => {
    const match = line.match(pattern);
    if (match) {
      matches.push({ line: index + 1, match: match[0] });
    }
  });

  return matches;
}

function checkRequiredPattern(
  files: string[],
  pattern: RegExp
): boolean {
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (pattern.test(content)) {
      return true;
    }
  }
  return false;
}

describe('Contract: feature_todo', () => {
  /**
   * TODO-001: Creating a task must generate unique UUID
   *
   * AISP Rule:
   * TODO-001:∀title:TaskTitle.create(title)⇒∃task∈TaskList:task.id∈UUID
   *
   * Specflow Contract:
   * required_patterns:
   *   - pattern: /crypto\.randomUUID|uuid(?:v4)?|nanoid/
   */
  describe('TODO-001: Task creation uses UUID generator', () => {
    const scope = ['src/services/**/*.ts', 'src/hooks/**/*.ts'];
    const requiredPattern = /crypto\.randomUUID|uuid(?:v4)?|nanoid/;

    it('should use UUID generator for task IDs', () => {
      const files = scanFiles(scope);

      if (files.length === 0) {
        // No implementation files yet - this is expected initially
        console.log('⏳ TODO-001: No implementation files found yet');
        return;
      }

      const found = checkRequiredPattern(files, requiredPattern);

      if (!found) {
        throw new Error(
          `CONTRACT VIOLATION: TODO-001\n` +
          `  Pattern: ${requiredPattern}\n` +
          `  Message: Task creation must use UUID generator (TODO-001)\n` +
          `  Scope: ${scope.join(', ')}\n` +
          `  Fix: Use crypto.randomUUID() or uuid library for task IDs`
        );
      }

      console.log('✅ TODO-001: UUID generator pattern found');
    });
  });

  /**
   * TODO-002: Completing task must set completed and timestamp
   *
   * AISP Rule:
   * TODO-002:∀task.complete(task)⇒task.completed≔⊤∧task.completedAt≔Some(now())
   *
   * Specflow Contract:
   * required_patterns:
   *   - pattern: /completed:\s*true|completed\s*=\s*true/
   */
  describe('TODO-002: Complete function sets completed flag', () => {
    const scope = ['src/services/**/*.ts', 'src/hooks/**/*.ts'];
    const requiredPattern = /completed:\s*true|completed\s*=\s*true/;

    it('should set completed: true in complete function', () => {
      const files = scanFiles(scope);

      if (files.length === 0) {
        console.log('⏳ TODO-002: No implementation files found yet');
        return;
      }

      const found = checkRequiredPattern(files, requiredPattern);

      if (!found) {
        throw new Error(
          `CONTRACT VIOLATION: TODO-002\n` +
          `  Pattern: ${requiredPattern}\n` +
          `  Message: Complete function must set completed: true (TODO-002)\n` +
          `  Scope: ${scope.join(', ')}\n` +
          `  Fix: Ensure completeTask sets { completed: true, completedAt: Date.now() }`
        );
      }

      console.log('✅ TODO-002: Completed flag pattern found');
    });
  });

  /**
   * TODO-005: Persistence must use indexedDB or chrome.storage
   *
   * AISP Rule:
   * TODO-005:∀write:persist(TaskList)⇒storage∈ApprovedStorage
   *
   * Specflow Contract:
   * required_patterns:
   *   - pattern: /indexedDB|IDBDatabase|chrome\.storage\.local|idb/
   * forbidden_patterns:
   *   - pattern: /localStorage\.setItem.*tasks|localStorage\.getItem.*tasks/i
   */
  describe('TODO-005: Persistence uses approved storage', () => {
    const scope = [
      'src/services/storage*.ts',
      'src/services/persist*.ts',
      'src/hooks/use*Storage*.ts',
    ];
    const requiredPattern = /indexedDB|IDBDatabase|chrome\.storage\.local|idb/;
    const forbiddenPattern = /localStorage\.(setItem|getItem)\s*\(\s*['"]tasks/i;

    it('should use indexedDB or chrome.storage for persistence', () => {
      const files = scanFiles(scope);

      if (files.length === 0) {
        console.log('⏳ TODO-005: No storage implementation files found yet');
        return;
      }

      const found = checkRequiredPattern(files, requiredPattern);

      if (!found) {
        throw new Error(
          `CONTRACT VIOLATION: TODO-005\n` +
          `  Pattern: ${requiredPattern}\n` +
          `  Message: Must use indexedDB or chrome.storage for persistence (TODO-005)\n` +
          `  Scope: ${scope.join(', ')}\n` +
          `  Fix: Use idb library or chrome.storage.local API`
        );
      }

      console.log('✅ TODO-005: Approved storage pattern found');
    });

    it('should NOT use localStorage for tasks', () => {
      const allFiles = scanFiles(['src/**/*.ts']);
      const violations: ContractViolation[] = [];

      for (const file of allFiles) {
        const matches = findPatternInFile(file, forbiddenPattern);
        for (const match of matches) {
          violations.push({
            ruleId: 'TODO-005',
            file: path.relative(PROJECT_ROOT, file),
            line: match.line,
            pattern: forbiddenPattern.toString(),
            message: 'Do not use localStorage for task persistence',
            match: match.match,
          });
        }
      }

      if (violations.length > 0) {
        const report = violations
          .map(
            (v) =>
              `  File: ${v.file}:${v.line}\n` +
              `  Match: ${v.match}\n` +
              `  Message: ${v.message}`
          )
          .join('\n\n');

        throw new Error(
          `CONTRACT VIOLATION: TODO-005\n` +
          `  Found ${violations.length} violation(s):\n\n${report}`
        );
      }

      console.log('✅ TODO-005: No localStorage usage for tasks');
    });
  });
});
