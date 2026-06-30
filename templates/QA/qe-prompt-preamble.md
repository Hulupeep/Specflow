# QE-fleet prompt preamble + output classification

Use this template whenever you invoke any agentic-qe-fleet skill or agent (`qe-coverage-analysis`, `qe-test-generation`, `qe-regression-analyzer`, `qe-quality-gate`, `qe-coverage-specialist`, `mutation-testing`, `risk-based-testing`, etc.) against the AI-Claims claims-monorepo or any similar monorepo.

The QE fleet (Dragan Spiridonov's framework) is high-signal but routinely hallucinates monorepo boundaries — generating false positives that consolidate cross-app code, flag intentional per-app duplication, or misapply browser-bundle reasoning to Node servers. This preamble + the post-report classification pass mitigates those false positives without throwing away the genuine findings.

---

## How to use

When invoking a qe-fleet skill via the Skill tool, or when spawning a qe-fleet-* subagent via the Agent tool, **prepend** the ARCHITECTURE CONTEXT block below to your prompt, AND **append** the OUTPUT CLASSIFICATION INSTRUCTION block. The body of the prompt (what you actually want analyzed) goes in between.

For multi-app monorepos, also invoke per-workspace rather than monorepo-wide whenever the skill supports a `--scope` or path filter. Example: run `qe-coverage-analysis` once per `apps/*` workspace and once per `packages/*` workspace, not once across the whole repo.

---

## ARCHITECTURE CONTEXT block (prepend to QE prompts)

```
ARCHITECTURE CONTEXT — read before reporting any finding.

This is a monorepo with multiple independently deployed apps. Each app has its own bundle, runtime, role boundary, and permission model. Their similar-looking code is DELIBERATELY duplicated by role boundary — do not recommend consolidation across apps.

Workspaces:
- apps/claims-server                    — customer-facing API (owners, insureds)
- apps/claims-management-server         — case-manager / counsel-facing API
- apps/claims-client                    — customer-facing React client
- apps/claims-management-client         — CM-facing React client
- packages/domains                      — pure domain logic, ADR-043 isolation (no drizzle, no fetch, no axios, no node:http)
- packages/infrastructure               — DB, exporters, vendor adapters
- packages/ui                           — shared React components
- packages/application                  — application services / use cases
- packages/address                      — address validation utilities
- tests/contracts                       — repo-wide specflow contract tests
- tests/e2e                             — repo-wide journey tests
- multicheck                            — multi-agent reviewer protocol session state (gitignored)

Rules the QE fleet routinely violates — DO NOT flag these as findings:

1. Similar route shapes / handler shapes across claims-server and claims-management-server are intentional per the customer-vs-CM split. Do NOT recommend DRY consolidation across apps.

2. Per-app test placement: each app's functional tests live at apps/<app>/tests/functional/. Cross-app integration is journey-test-only (tests/e2e/). Do NOT recommend adding cross-app integration tests inside an app's functional test dir.

3. INV-001 (domain isolation) applies to RUNTIME imports only. `import type { X } from '@claims/infrastructure/...'` is erased at compile time and is NOT a violation. Check for actual JS imports, not TypeScript type imports.

4. Drizzle migration numbering is global across packages/infrastructure/db/drizzle/, not per-feature. Conflicts are caught by file-system collision, not by the QE tool.

5. React / @react-pdf/renderer / similar duplicate-instance warnings: these are browser-bundle concerns. Node servers do NOT bundle the same way. If a finding says "duplicate React instance risk on the server," verify with `npm ls react` and discount unless the actual resolution tree has multiple versions.

6. Cross-app code that looks duplicated may be legitimately separated for: role-based access control, tenant isolation, deployment cadence differences, or audit-trail requirements per ADR-013. Check `docs/ard/` ADR index before flagging.

7. The two server apps are deployed to different domains and may be at different release cadences. Schema migrations are shared but route shape is not.

8. Contract YAML rules in `docs/contracts/feature_*.yml` define INVARIANTS that override generic "best practice" recommendations. If your recommendation conflicts with a contract YAML rule, the contract wins; don't recommend changing the contract to fit your suggestion.

Relevant ADR references (always consult before architectural recommendations):
- ADR-043 — domain/infrastructure boundary
- ADR-055 — repository pattern
- ADR-095 — request-scoped context
- ADR-107 — address validation boundary (INV-ADDRESS-CENTRAL-001)
- ADR-115 — audit trail (propertyActivityLog + caseEvents)
- ADR-119 — hexagonal target architecture
- ADR-134..153 — recent feature ADRs (storm assessment, NOL, ADR-152/153 renumbering)
- See full index at docs/ard/INDEX.md

When in doubt about whether something is a real defect or a monorepo-confusion false positive, prefer to NOT report it. The reviewer can ask follow-up questions if a gap is suspected.
```

---

## OUTPUT CLASSIFICATION INSTRUCTION block (append to QE prompts)

```
OUTPUT CLASSIFICATION — apply before returning your final report.

For every finding you would report, classify it as one of:

A — Genuine code defect or coverage gap that exists in the actual codebase as architected.
B — Monorepo / app-boundary confusion or architecture hallucination (e.g., recommends DRY across apps, conflates browser-bundle and Node-runtime concerns, flags type-only imports as runtime violations, suggests cross-app integration tests inside an app's functional dir).
C — Generic best-practice recommendation that does not apply to this codebase given the ARCHITECTURE CONTEXT above (e.g., generic "add more tests" without a specific gap, generic "consolidate similar code" without checking ADR rationale).

DROP all B and C classifications from your final report. Report ONLY A findings.

For each A finding, include:
- file:line citation (absolute or repo-relative path)
- one-sentence description of the defect
- one-sentence rationale for why it is genuinely an A (not just generically applicable)
- specific test or change that would fix it

If your A list is empty after filtering, return "NO GENUINE FINDINGS" rather than padding the report with B/C suggestions. An empty A report is more useful than a noisy A+B+C report.
```

---

## Composed example

When you invoke `qe-coverage-specialist` against the explainability slice (or any new feature on this repo), your full prompt looks like:

```
{ARCHITECTURE CONTEXT block above, verbatim}

YOUR ANALYSIS TASK
Analyze test coverage gaps for the #1361 roof-estimate-explainability slice in C:\code\claims-monorepo.

[... whatever specific context and instructions for the analysis ...]

{OUTPUT CLASSIFICATION INSTRUCTION block above, verbatim}
```

The agent then runs its analysis with monorepo-aware context AND the filter logic, returning only A-class findings.

---

## When to update this template

- A new app workspace is added to `apps/` → add it to the Workspaces list
- A new ADR establishes a cross-cutting invariant the QE fleet keeps missing → add to "Rules the QE fleet routinely violates" + the ADR references
- A QE fleet false-positive pattern shows up repeatedly across sessions → add to the rules list with an example
- A skill in the QE fleet is added / renamed → update the "How to use" section's skill list

Keep the file in this exact location (`multicheck/.framework/templates/qe-prompt-preamble.md`) so reviewers across sessions can find it. The session-local copy at `docs/qe-conventions.md` (or equivalent) is the repo-tracked durable copy.
