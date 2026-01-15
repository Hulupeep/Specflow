/**
 * Contract Tests: feature_data.yml
 *
 * These tests enforce the following AISP rules via Specflow contracts:
 * - DATA-001: Task IDs must be unique (UUID)
 * - DATA-002: Completed tasks must have completedAt timestamp
 *
 * AISP Source: docs/specs/TODO-APP.aisp
 * Specflow Contract: docs/contracts/feature_data.yml
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

function checkRequiredPattern(files: string[], pattern: RegExp): boolean {
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (pattern.test(content)) {
      return true;
    }
  }
  return false;
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

describe('Contract: feature_data', () => {
  /**
   * DATA-001: Task IDs must be unique (UUID)
   *
   * AISP Rule:
   * DATA-001:∀t1,t2∈TaskList:t1≢t2⇒t1.id≢t2.id
   *
   * Specflow Contract:
   * required_patterns:
   *   - pattern: /id:\s*string|id:\s*UUID/
   * forbidden_patterns:
   *   - pattern: /id:\s*number/
   */
  describe('DATA-001: Task IDs are string (UUID)', () => {
    const scope = ['src/types/**/*.ts', 'src/services/**/*.ts'];
    const requiredPattern = /id:\s*string/;
    const forbiddenPattern = /id:\s*number/;

    it('should define Task.id as string type', () => {
      const files = scanFiles(scope);

      if (files.length === 0) {
        console.log('⏳ DATA-001: No type files found yet');
        return;
      }

      const found = checkRequiredPattern(files, requiredPattern);

      if (!found) {
        throw new Error(
          `CONTRACT VIOLATION: DATA-001\n` +
          `  Pattern: ${requiredPattern}\n` +
          `  Message: Task type must have id: string property (DATA-001)\n` +
          `  Scope: ${scope.join(', ')}\n` +
          `  Fix: Define Task interface with id: string`
        );
      }

      console.log('✅ DATA-001: Task.id is string type');
    });

    it('should NOT define Task.id as number type', () => {
      const files = scanFiles(scope);
      const violations: ContractViolation[] = [];

      for (const file of files) {
        const matches = findPatternInFile(file, forbiddenPattern);
        for (const match of matches) {
          violations.push({
            ruleId: 'DATA-001',
            file: path.relative(PROJECT_ROOT, file),
            line: match.line,
            pattern: forbiddenPattern.toString(),
            message: 'Task ID must be string (UUID), not number',
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
          `CONTRACT VIOLATION: DATA-001\n` +
          `  Found ${violations.length} violation(s):\n\n${report}`
        );
      }

      console.log('✅ DATA-001: No numeric IDs found');
    });
  });

  /**
   * DATA-002: Completed tasks must have completedAt timestamp
   *
   * AISP Rule:
   * DATA-002:∀task.completed≡⊤⇒task.completedAt≢None
   *
   * Specflow Contract:
   * required_patterns:
   *   - pattern: /completedAt\??\s*:\s*(number|Date)/
   */
  describe('DATA-002: Task has completedAt property', () => {
    const scope = ['src/types/**/*.ts'];
    const requiredPattern = /completedAt\??\s*:\s*(number|Date)/;

    it('should define completedAt property in Task type', () => {
      const files = scanFiles(scope);

      if (files.length === 0) {
        console.log('⏳ DATA-002: No type files found yet');
        return;
      }

      const found = checkRequiredPattern(files, requiredPattern);

      if (!found) {
        throw new Error(
          `CONTRACT VIOLATION: DATA-002\n` +
          `  Pattern: ${requiredPattern}\n` +
          `  Message: Task type must have completedAt property (DATA-002)\n` +
          `  Scope: ${scope.join(', ')}\n` +
          `  Fix: Add completedAt?: number to Task interface`
        );
      }

      console.log('✅ DATA-002: completedAt property defined');
    });
  });
});
