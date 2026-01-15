/**
 * Contract Tests: feature_security.yml
 *
 * These tests enforce the following AISP rules via Specflow contracts:
 * - SEC-001: No localStorage in service workers
 * - SEC-002: No sessionStorage in service workers
 *
 * AISP Source: docs/specs/TODO-APP.aisp
 * Specflow Contract: docs/contracts/feature_security.yml
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
  line: number;
  pattern: string;
  message: string;
  match: string;
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

function scanForForbiddenPattern(
  filePatterns: string[],
  forbiddenPattern: RegExp,
  ruleId: string,
  message: string
): ContractViolation[] {
  const violations: ContractViolation[] = [];

  for (const pattern of filePatterns) {
    const files = glob.sync(pattern, { cwd: PROJECT_ROOT });

    for (const file of files) {
      const fullPath = path.join(PROJECT_ROOT, file);
      const matches = findPatternInFile(fullPath, forbiddenPattern);

      for (const match of matches) {
        violations.push({
          ruleId,
          file,
          line: match.line,
          pattern: forbiddenPattern.toString(),
          message,
          match: match.match,
        });
      }
    }
  }

  return violations;
}

function formatViolations(violations: ContractViolation[]): string {
  return violations
    .map(
      (v) =>
        `  File: ${v.file}:${v.line}\n` +
        `  Match: "${v.match}"\n` +
        `  Message: ${v.message}`
    )
    .join('\n\n');
}

describe('Contract: feature_security', () => {
  /**
   * SEC-001: No localStorage in service workers
   *
   * AISP Rule:
   * SEC-001:∀file∈ServiceWorkerFiles:¬∃call∈file:call.target≡localStorage
   *
   * Specflow Contract:
   * forbidden_patterns:
   *   - pattern: /localStorage/
   *     message: "localStorage not available in service workers (SEC-001)"
   */
  describe('SEC-001: No localStorage in service workers', () => {
    const scope = [
      'src/sw/**/*.ts',
      'src/sw/**/*.js',
      'src/background/**/*.ts',
      'src/background/**/*.js',
      'src/service-worker/**/*.ts',
      'src/service-worker/**/*.js',
    ];

    it('should not reference localStorage in service worker files', () => {
      const violations = scanForForbiddenPattern(
        scope,
        /localStorage/,
        'SEC-001',
        'localStorage not available in service workers (SEC-001)'
      );

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: SEC-001\n` +
          `  Found ${violations.length} violation(s):\n\n` +
          formatViolations(violations) +
          `\n\n  Fix: Use chrome.storage.local or indexedDB instead`
        );
      }

      console.log('✅ SEC-001: No localStorage in service workers');
    });

    it('should not reference window.localStorage in service worker files', () => {
      const violations = scanForForbiddenPattern(
        scope,
        /window\.localStorage/,
        'SEC-001',
        'window.localStorage not available in service workers (SEC-001)'
      );

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: SEC-001\n` +
          `  Found ${violations.length} violation(s):\n\n` +
          formatViolations(violations)
        );
      }

      console.log('✅ SEC-001: No window.localStorage in service workers');
    });
  });

  /**
   * SEC-002: No sessionStorage in service workers
   *
   * AISP Rule:
   * SEC-002:∀file∈ServiceWorkerFiles:¬∃call∈file:call.target≡sessionStorage
   *
   * Specflow Contract:
   * forbidden_patterns:
   *   - pattern: /sessionStorage/
   *     message: "sessionStorage not available in service workers (SEC-002)"
   */
  describe('SEC-002: No sessionStorage in service workers', () => {
    const scope = [
      'src/sw/**/*.ts',
      'src/sw/**/*.js',
      'src/background/**/*.ts',
      'src/background/**/*.js',
      'src/service-worker/**/*.ts',
      'src/service-worker/**/*.js',
    ];

    it('should not reference sessionStorage in service worker files', () => {
      const violations = scanForForbiddenPattern(
        scope,
        /sessionStorage/,
        'SEC-002',
        'sessionStorage not available in service workers (SEC-002)'
      );

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: SEC-002\n` +
          `  Found ${violations.length} violation(s):\n\n` +
          formatViolations(violations) +
          `\n\n  Fix: Use chrome.storage.session or remove entirely`
        );
      }

      console.log('✅ SEC-002: No sessionStorage in service workers');
    });

    it('should not reference window.sessionStorage in service worker files', () => {
      const violations = scanForForbiddenPattern(
        scope,
        /window\.sessionStorage/,
        'SEC-002',
        'window.sessionStorage not available in service workers (SEC-002)'
      );

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: SEC-002\n` +
          `  Found ${violations.length} violation(s):\n\n` +
          formatViolations(violations)
        );
      }

      console.log('✅ SEC-002: No window.sessionStorage in service workers');
    });
  });
});
