# SpecFlow × ruvector Learning Injection Spec

> Proof-first learning loop for contract enforcement.

**Objective:** Measurable reduction in repeat violations + faster convergence to contract-passing diffs.

**Non-goal:** "Make agents smart." Goal is **quantitative improvement** under controlled replay.

---

## Critical Analysis: How It All Fits Together

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   AGENT     │    │  PREFLIGHT  │    │   WRITE     │    │   TEST      │  │
│  │   STARTS    │───▶│  INJECTION  │───▶│   CODE      │───▶│  CONTRACTS  │  │
│  │             │    │             │    │             │    │             │  │
│  └─────────────┘    └──────┬──────┘    └─────────────┘    └──────┬──────┘  │
│                            │                                      │         │
│                            │                                      ▼         │
│                    ┌───────▼───────┐                      ┌─────────────┐  │
│                    │ ruvector      │                      │   PASS or   │  │
│                    │ GET /guardrails│                     │   FAIL?     │  │
│                    └───────────────┘                      └──────┬──────┘  │
│                            ▲                                     │         │
│                            │                         ┌───────────┴───────┐ │
│                            │                         ▼                   ▼ │
│                    ┌───────┴───────┐         ┌─────────────┐    ┌────────┐│
│                    │ ruvector      │         │ EMIT        │    │ EMIT   ││
│                    │ Remediation   │◀────────│ REMEDIATION │    │VIOLAT- ││
│                    │ Store         │         │ _APPLIED    │    │ION     ││
│                    └───────────────┘         └─────────────┘    └────┬───┘│
│                                                                      │    │
│                                              ┌───────────────────────┘    │
│                                              ▼                            │
│                                      ┌─────────────┐                      │
│                                      │ ruvector    │                      │
│                                      │ POST        │                      │
│                                      │ /violations │                      │
│                                      └─────────────┘                      │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 0) Proof-First Strategy

Build a **deterministic harness** that proves:

1. System **retrieves the right lessons** for a given upcoming edit
2. Injection **reduces repeat violations**
3. Min-cut (or gating) **controls injection size without harming success rate**

**No vibes. Everything replayable.**

### Critical Gap Identified: Baseline Definition

**Issue:** What's the baseline for "60% reduction"?

**Resolution:** Need explicit baseline definition:
```yaml
baseline:
  measurement: "violations_per_100_runs_without_injection"
  control_group: "same fixtures, no guardrail brief injected"
  statistical_significance: "p < 0.05"
```

---

## 1) System Components

### 1.1 SpecFlow Emits Structured Events

**Event: CONTRACT_VIOLATION**
```json
{
  "event_type": "CONTRACT_VIOLATION",
  "contract_id": "AUTH-001",
  "rule_id": "AUTH-001",
  "signature": {
    "type": "forbidden_pattern",
    "match": "localStorage\\.setItem.*token",
    "ast_hash": "abc123"
  },
  "evidence": {
    "paths": ["src/auth/login.ts"],
    "snippets": ["localStorage.setItem('token', jwt)"],
    "line_numbers": [47]
  },
  "repo_context": {
    "repo": "myorg/myapp",
    "branch": "feature/auth",
    "commit": "def456"
  },
  "run_id": "run_789",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

**Event: REMEDIATION_APPLIED**
```json
{
  "event_type": "REMEDIATION_APPLIED",
  "contract_id": "AUTH-001",
  "signature": {
    "type": "forbidden_pattern",
    "match": "localStorage\\.setItem.*token",
    "ast_hash": "abc123"
  },
  "fix_recipe": {
    "type": "patch",
    "before": "localStorage.setItem('token', jwt)",
    "after": "document.cookie = `token=${jwt}; HttpOnly; Secure`",
    "diff": "-localStorage.setItem('token', jwt)\n+document.cookie = ..."
  },
  "validation": {
    "tests_passed": true,
    "contracts_passed": true,
    "test_suite_version": "jest@29.0.0"
  },
  "run_id": "run_789",
  "timestamp": "2024-01-15T10:05:00Z"
}
```

**Invariants:**
| ID | Rule | Enforcement |
|----|------|-------------|
| SF-EVT-001 | Every contract failure MUST emit exactly one `CONTRACT_VIOLATION` per violated rule_id | Unit test |
| SF-EVT-002 | Every successful post-failure pass MUST emit `REMEDIATION_APPLIED` linked to same signature | Integration test |

### Critical Gap: Event Ordering

**Issue:** What if agent fixes multiple violations in one commit?

**Resolution:** Add `violation_ref` to link remediation to specific violation:
```json
{
  "event_type": "REMEDIATION_APPLIED",
  "violation_ref": "run_789/AUTH-001/1705312800",  // links to specific violation
  ...
}
```

---

### 1.2 ruvector Stores Remediation Recipes

**Entity: RemediationRecipe**
```json
{
  "key": {
    "contract_id": "AUTH-001",
    "signature_hash": "sha256:abc123def456"
  },
  "fix_recipe": {
    "type": "patch",
    "payload": "...",
    "description": "Use httpOnly cookie instead of localStorage"
  },
  "context_fingerprint": {
    "framework": "next.js",
    "language": "typescript",
    "path_pattern": "src/auth/**"
  },
  "metrics": {
    "occurrences": 7,
    "applied_count": 5,
    "success_count": 5,
    "success_rate": 1.0,
    "last_seen": "2024-01-15T10:05:00Z"
  },
  "confidence": 0.95,
  "provenance": {
    "first_seen_repo": "myorg/myapp",
    "first_seen_run": "run_123"
  }
}
```

**Invariants:**
| ID | Rule | Enforcement |
|----|------|-------------|
| RV-STORE-001 | Recipe MUST NOT be stored unless `validation.contracts_passed=true` | Unit test + integration |
| RV-STORE-002 | Retrieval MUST return recipes ranked by confidence + context match | Unit test |

### Critical Gap: Confidence Decay

**Issue:** Old recipes with high success rate but no recent usage should decay.

**Resolution:** Add decay function:
```typescript
function effectiveConfidence(recipe: Recipe): number {
  const daysSinceLastSeen = (Date.now() - recipe.metrics.last_seen) / MS_PER_DAY;
  const decayFactor = Math.exp(-daysSinceLastSeen / 30); // half-life: 30 days
  return recipe.confidence * decayFactor;
}
```

---

### 1.3 Injection Gate

**ChangeFingerprint:**
```json
{
  "paths_touched": ["src/auth/login.ts", "src/auth/session.ts"],
  "imports_added": ["jsonwebtoken"],
  "imports_present": ["prisma", "next/headers"],
  "api_calls_detected": ["localStorage.setItem", "fetch"],
  "context_edges": [
    {"from": "auth", "to": "billing", "type": "import"}
  ],
  "intent_tags": ["auth", "token-handling"]
}
```

**GuardrailBrief:**
```json
{
  "items": [
    {
      "contract_id": "AUTH-001",
      "rule_id": "AUTH-001",
      "why_triggered": "localStorage.setItem detected in fingerprint",
      "known_fix_recipe": {
        "description": "Use httpOnly cookie instead",
        "example_before": "localStorage.setItem('token', jwt)",
        "example_after": "res.cookie('token', jwt, { httpOnly: true })"
      },
      "confidence": 0.95
    }
  ],
  "tension_level": "low",
  "injection_count": 3,
  "mode": "WARN"
}
```

**Invariants:**
| ID | Rule | Enforcement |
|----|------|-------------|
| INJ-001 | Agent MUST receive GuardrailBrief before planning/editing | Integration test |
| INJ-002 | GuardrailBrief MUST be ≤ N items unless Gate escalates | Unit test |

### Critical Gap: Fingerprint False Positives

**Issue:** `localStorage.setItem` might be legitimate (user preferences, not tokens).

**Resolution:** Context-aware pattern matching:
```typescript
function isViolationLikely(apiCall: string, context: Context): boolean {
  if (apiCall === 'localStorage.setItem') {
    // Check if it's in auth-related file
    if (context.paths.some(p => /auth|login|session|token/i.test(p))) {
      return true; // likely violation
    }
    // Check if the value looks like a token
    if (context.snippets.some(s => /token|jwt|session/i.test(s))) {
      return true;
    }
    return false; // probably user preferences
  }
  return false;
}
```

---

### 1.4 Min-Cut Gating

**Gate Inputs:**
- Candidate contracts from fingerprint classifier
- ruvector matches (top K per contract)
- Risk score / cohesion score

**Gate Outputs:**
```typescript
interface GateDecision {
  injection_size: 3 | 5 | 10;
  mode: 'WARN' | 'BLOCK' | 'ESCALATE';
  reason: string;
}
```

**Invariants:**
| ID | Rule | Enforcement |
|----|------|-------------|
| GATE-001 | Default mode is WARN, injection_size=3 | Unit test |
| GATE-002 | BLOCK only when deterministic signature match in diff | Unit test |
| GATE-003 | ESCALATE only when cohesion low AND historical failure high | Integration test |

### Critical Question: When to BLOCK vs WARN?

**Current spec says:** BLOCK when deterministic signature match is present in diff.

**Issue:** This means BLOCK happens AFTER the agent writes code. But we want to prevent writing bad code.

**Resolution:** Two-stage gating:
1. **Preflight (before writing):** WARN with guardrail brief
2. **Pre-commit (after writing, before committing):** BLOCK if violation detected

```
Agent intent → Preflight WARN → Agent writes → Pre-commit check → BLOCK if violation
```

---

## 2) Success Criteria

| Criterion | Metric | Target | Measurement |
|-----------|--------|--------|-------------|
| Repeat violation rate | violations per class per 50 runs | ≥ 60% reduction | ReplayLab |
| Time-to-green | median attempts to pass | ≥ 30% reduction | ReplayLab |
| Injection stays small | % runs with ≤ 3 items | ≥ 90% | ReplayLab |
| No regression | contract pass rate | ≥ baseline | ReplayLab |
| Deterministic replay | same seed → same output | 100% | Unit test |

### Critical Gap: Defining "Attempt"

**Issue:** What counts as an "attempt to pass contracts"?

**Resolution:**
```typescript
interface Attempt {
  run_id: string;
  diff_hash: string;  // unique diff
  contract_results: { passed: boolean; violations: string[] };
}

// An attempt is one unique diff submitted for contract testing
// Multiple violations in same diff = 1 attempt
// Agent iterating 3 times with different diffs = 3 attempts
```

---

## 3) Test Plan

### 3.1 ReplayLab (Golden Harness)

```
fixtures/
├── repos/
│   ├── minimal-nextjs/        # tiny Next.js app
│   ├── minimal-express/       # tiny Express app
│   └── minimal-react/         # tiny React SPA
├── contracts/
│   ├── AUTH-001.yml           # localStorage token
│   ├── LAYER-001.yml          # db in controller
│   ├── SEC-001.yml            # SQL injection
│   └── ... (10 total)
├── violations/
│   ├── AUTH-001/
│   │   ├── variant-a.diff     # localStorage.setItem('token', ...)
│   │   ├── variant-b.diff     # localStorage.token = ...
│   │   └── variant-c.diff     # window.localStorage.setItem(...)
│   └── ... (30 total, 3 per contract)
├── remedies/
│   ├── AUTH-001/
│   │   └── httponly-cookie.json
│   └── ...
└── expected/
    ├── fingerprints/
    │   └── AUTH-001-variant-a.json
    └── guardrails/
        └── AUTH-001-variant-a.json
```

**Invariant TEST-REPLAY-001:** Same input fixture MUST yield same guardrail brief.

### 3.2 Unit Tests

**A) Fingerprint Extraction**
```typescript
describe('ChangeFingerprint', () => {
  it('FP-001: detects controllers/ path', () => {
    const diff = loadFixture('violations/LAYER-001/variant-a.diff');
    const fp = extractFingerprint(diff);
    expect(fp.paths_touched).toContain('src/controllers/users.ts');
  });

  it('FP-002: extracts prisma import', () => {
    const diff = loadFixture('violations/LAYER-001/variant-a.diff');
    const fp = extractFingerprint(diff);
    expect(fp.imports_added).toContain('prisma');
  });

  it('FP-003: detects localStorage.setItem', () => {
    const diff = loadFixture('violations/AUTH-001/variant-a.diff');
    const fp = extractFingerprint(diff);
    expect(fp.api_calls_detected).toContain('localStorage.setItem');
  });

  it('FP-004: computes context edge auth -> billing', () => {
    const diff = loadFixture('violations/CTX-001/variant-a.diff');
    const fp = extractFingerprint(diff);
    expect(fp.context_edges).toContainEqual({
      from: 'auth', to: 'billing', type: 'import'
    });
  });
});
```

**B) Signature Generation**
```typescript
describe('SignatureHash', () => {
  it('SIG-001: AST signature stable across variable renames', () => {
    const code1 = `prisma.user.findMany()`;
    const code2 = `client.user.findMany()`;  // renamed
    const sig1 = generateASTSignature(code1);
    const sig2 = generateASTSignature(code2);
    expect(sig1).toEqual(sig2);  // same pattern, different name
  });

  it('SIG-002: import signature catches direct client import', () => {
    const code = `import { PrismaClient } from '@prisma/client'`;
    const sig = generateImportSignature(code);
    expect(sig).toMatch(/prisma.*client/i);
  });

  it('SIG-003: regex fallback low false positives', () => {
    const falsePositive = `// localStorage.setItem is bad`;  // comment
    const truePositive = `localStorage.setItem('token', jwt)`;
    expect(matchesRegexSignature(falsePositive, AUTH_001_PATTERN)).toBe(false);
    expect(matchesRegexSignature(truePositive, AUTH_001_PATTERN)).toBe(true);
  });
});
```

**C) Retrieval Ranking**
```typescript
describe('RetrievalRanking', () => {
  it('RET-001: highest confidence + closest context ranks first', () => {
    const recipes = [
      { contract_id: 'AUTH-001', confidence: 0.9, context_match: 0.8 },
      { contract_id: 'AUTH-001', confidence: 0.95, context_match: 0.9 },
      { contract_id: 'AUTH-001', confidence: 0.7, context_match: 0.95 },
    ];
    const ranked = rankRecipes(recipes);
    expect(ranked[0].confidence).toBe(0.95);
  });

  it('RET-002: old low-confidence demoted', () => {
    const old = { confidence: 0.8, last_seen: daysAgo(60) };
    const recent = { confidence: 0.7, last_seen: daysAgo(1) };
    expect(effectiveConfidence(old)).toBeLessThan(effectiveConfidence(recent));
  });

  it('RET-003: no recipes for mismatched contract_id', () => {
    const recipes = retrieve({ contract_id: 'AUTH-001' }, 'SEC-001');
    expect(recipes).toHaveLength(0);
  });
});
```

**D) Gate Sizing**
```typescript
describe('GateDecision', () => {
  it('GATE-001: strong match → inject 3', () => {
    const decision = computeGate({ matchStrength: 0.9, cohesion: 0.8 });
    expect(decision.injection_size).toBe(3);
    expect(decision.mode).toBe('WARN');
  });

  it('GATE-002: fragile + high failure → inject 10 + ESCALATE', () => {
    const decision = computeGate({
      matchStrength: 0.5,
      cohesion: 0.2,
      historicalFailureRate: 0.8
    });
    expect(decision.injection_size).toBe(10);
    expect(decision.mode).toBe('ESCALATE');
  });

  it('GATE-003: deterministic match in diff → BLOCK', () => {
    const decision = computeGate({
      deterministicMatchInDiff: true
    });
    expect(decision.mode).toBe('BLOCK');
  });
});
```

### 3.3 Integration Tests

**LOOP-001: Learns and Reuses**
```typescript
it('LOOP-001: learns and reuses', async () => {
  // 1. Scripted agent violates LAYER-001
  const run1 = await replayLab.run({
    policy: 'violate-LAYER-001',
    fixture: 'minimal-nextjs'
  });
  expect(run1.contractsPassed).toBe(false);
  expect(run1.emittedEvents).toContainEqual(
    expect.objectContaining({ event_type: 'CONTRACT_VIOLATION', contract_id: 'LAYER-001' })
  );

  // 2. Apply fix, contracts pass
  const run2 = await replayLab.run({
    policy: 'fix-LAYER-001',
    fixture: 'minimal-nextjs',
    previousRun: run1.id
  });
  expect(run2.contractsPassed).toBe(true);
  expect(run2.emittedEvents).toContainEqual(
    expect.objectContaining({ event_type: 'REMEDIATION_APPLIED', contract_id: 'LAYER-001' })
  );

  // 3. New variant of same violation
  const run3 = await replayLab.run({
    policy: 'violate-LAYER-001-variant-b',
    fixture: 'minimal-nextjs'
  });

  // 4. Preflight MUST include learned fix
  expect(run3.preflightBrief.items).toContainEqual(
    expect.objectContaining({ contract_id: 'LAYER-001' })
  );

  // 5. Scripted agent uses fix → pass first attempt
  const run4 = await replayLab.run({
    policy: 'use-guardrail-brief',
    fixture: 'minimal-nextjs',
    guardrailBrief: run3.preflightBrief
  });
  expect(run4.contractsPassed).toBe(true);
  expect(run4.attempts).toBe(1);
});
```

**LOOP-002: Doesn't Bloat**
```typescript
it('LOOP-002: injection stays small', async () => {
  const results = await replayLab.runBatch({
    count: 100,
    policies: 'random-mixed',
    fixture: 'minimal-nextjs'
  });

  const injectionSizes = results.map(r => r.preflightBrief.items.length);
  const under3 = injectionSizes.filter(s => s <= 3).length;
  const under10 = injectionSizes.filter(s => s <= 10).length;

  expect(under3 / 100).toBeGreaterThanOrEqual(0.9);   // 90% ≤ 3
  expect(under10 / 100).toBeGreaterThanOrEqual(0.99); // 99% ≤ 10
});
```

**LOOP-003: No Superstition Stored**
```typescript
it('LOOP-003: rejects invalid fixes', async () => {
  // Attempt to store a "fix" that passes unit tests but fails contract
  const badFix = {
    contract_id: 'AUTH-001',
    fix_recipe: { /* doesn't actually fix the issue */ },
    validation: {
      tests_passed: true,
      contracts_passed: false  // <-- fails contract
    }
  };

  await expect(ruvector.storeRemediation(badFix))
    .rejects.toThrow('RV-STORE-001: contracts_passed must be true');
});
```

### 3.4 E2E Test

```typescript
it('E2E: real SpecFlow runner with known recipe', async () => {
  // 1. Setup: tiny repo with known violation
  const repo = await setupTestRepo('minimal-nextjs');
  await applyDiff(repo, 'violations/AUTH-001/variant-a.diff');

  // 2. Seed a known remedy
  await ruvector.storeRemediation({
    contract_id: 'AUTH-001',
    signature_hash: 'sha256:auth001',
    fix_recipe: loadFixture('remedies/AUTH-001/httponly-cookie.json'),
    validation: { tests_passed: true, contracts_passed: true }
  });

  // 3. Run SpecFlow
  const result = await specflow.run(repo);

  // 4. Verify output includes "Known fix available"
  expect(result.stdout).toContain('Known fix available');
  expect(result.stdout).toContain('AUTH-001');
  expect(result.artifacts).toContainEqual(
    expect.objectContaining({ type: 'violation', contract_id: 'AUTH-001' })
  );
});
```

---

## 4) Journey Specs

### J-01: Preflight Injection

**Given** a task intent + repo snapshot
**When** agent is about to plan/edit
**Then** system MUST compute fingerprint and inject GuardrailBrief

**Acceptance:**
- [ ] Brief references 1-3 contracts max (unless escalated)
- [ ] Includes "what to do instead" fix recipe
- [ ] Latency < 100ms for fingerprint + retrieval

### J-02: Violation Capture → Remedy Capture

**Given** contract test fails
**When** SpecFlow reports violation
**Then** violation is stored and linked to subsequent remedy on pass

**Acceptance:**
- [ ] Same signature_hash in both events
- [ ] Remedy only stored if validation passes
- [ ] Metrics updated (occurrences++, success_rate recalculated)

### J-03: Cross-Agent Broadcast

**Given** a recipe reaches confidence threshold (≥ 0.8, ≥ 3 successes)
**When** new agent run begins in same org
**Then** recipe is eligible for retrieval

**Acceptance:**
- [ ] Retrieval considers org scope
- [ ] Retrieval considers repo context (framework, language)
- [ ] Broadcast doesn't include low-confidence recipes

---

## 5) Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SPECFLOW (Enforcement)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Contract Tests ──▶ CONTRACT_VIOLATION event                    │
│                                                                  │
│  Post-fix Tests ──▶ REMEDIATION_APPLIED event                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RUVECTOR (Memory)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST /violations ──▶ Store violation, link to signature        │
│                                                                  │
│  POST /remediations ──▶ Store recipe (if valid), update metrics │
│                                                                  │
│  GET /guardrails?fingerprint=... ──▶ Return ranked brief        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SKILL/PLUGIN (Injection)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Preflight: GET /guardrails ──▶ Inject brief into agent context │
│                                                                  │
│  Post-test: Report outcome ──▶ Close feedback loop              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Invariant ARCH-001:** SpecFlow remains enforcement authority; ruvector never overrides contracts.

---

## 6) Critical Gaps Identified

### Gap 1: Signature Stability Across Refactors

**Issue:** If code is refactored (function renamed, moved to different file), signature may not match.

**Resolution:** Multi-level signature matching:
1. AST pattern (most stable)
2. Import pattern
3. Regex pattern (fallback)
4. Fuzzy match with decay (last resort)

### Gap 2: Context Drift

**Issue:** A remedy that worked in Next.js 14 might not work in Next.js 15.

**Resolution:** Include framework version in context_fingerprint:
```json
{
  "context_fingerprint": {
    "framework": "next.js",
    "framework_version": "14.x",
    "language": "typescript"
  }
}
```

### Gap 3: Conflicting Remedies

**Issue:** Two different remedies for the same violation. Which wins?

**Resolution:** Ranking by:
1. Context match score
2. Success rate
3. Recency
4. Confidence

Only return top-ranked remedy per contract.

### Gap 4: Cold Start

**Issue:** New project has no learned remedies.

**Resolution:** Seed with org-wide or public remedy library:
```typescript
const sources = [
  'project-specific',  // highest priority
  'org-wide',
  'public-specflow-remedies'  // lowest priority, curated
];
```

### Gap 5: Feedback Loop Latency

**Issue:** How long until a new remedy is available for retrieval?

**Resolution:** Immediate availability with low confidence:
```typescript
// On REMEDIATION_APPLIED:
// - Store immediately with confidence = 0.5
// - After 2nd success: confidence = 0.7
// - After 3rd success: confidence = 0.9
```

---

## 7) Rollout Plan

### Phase 1: Prove Loop Without LLM (Week 1-2)

- [ ] Build ReplayLab + fixtures (10 contracts, 30 violations)
- [ ] Ship unit tests (FP-*, SIG-*, RET-*, GATE-*)
- [ ] Ship integration tests (LOOP-001/002/003)
- [ ] Implement minimal store/retrieve + brief generation

**Exit criteria:** All tests green, deterministic replay proven.

### Phase 2: Wire Into Real Agents (Week 3-4)

- [ ] Add preflight injection to Claude Code skill
- [ ] Add CI output "Known fix available" on failure
- [ ] Measure baseline violation rate (no injection)
- [ ] Measure post-injection violation rate

**Exit criteria:** Measurable reduction in repeat violations.

### Phase 3: Min-Cut Gating (Week 5-6, Optional)

- [ ] Implement cohesion scoring
- [ ] Verify against LOOP-002 (no bloat)
- [ ] Verify against LOOP-001 (success rate)
- [ ] Tune thresholds based on data

**Exit criteria:** Gating improves efficiency without harming success rate.

---

## 8) Next Actions

1. **Create fixtures:** 10 contract files + 30 failing diffs (3 variants each)
2. **Build ReplayLab:** Deterministic runner with fixed seeds
3. **Implement ChangeFingerprint:** + signature_hash + golden tests
4. **Implement ruvector endpoints:** + retrieval ranking tests
5. **Make LOOP-001/002/003 green** before any live agent integration

---

## Appendix: Invariant Checklist

| ID | Invariant | Enforcement | Status |
|----|-----------|-------------|--------|
| SF-EVT-001 | One violation event per rule_id | Unit test | TODO |
| SF-EVT-002 | Remediation linked to violation | Integration | TODO |
| RV-STORE-001 | No storage unless contracts pass | Unit test | TODO |
| RV-STORE-002 | Ranked retrieval | Unit test | TODO |
| INJ-001 | Brief before planning | Integration | TODO |
| INJ-002 | Brief ≤ N items | Unit test | TODO |
| GATE-001 | Default WARN, size 3 | Unit test | TODO |
| GATE-002 | BLOCK on deterministic match | Unit test | TODO |
| GATE-003 | ESCALATE on fragile + high failure | Integration | TODO |
| TEST-REPLAY-001 | Deterministic replay | Unit test | TODO |
| ARCH-001 | SpecFlow is authority | Design | ENFORCED |
