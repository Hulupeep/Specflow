# Contract Graph

Contracts form a directed graph of cross-references. The graph validator checks that every pointer lands on something real.

## The Graph

```
Spec (docs/specs/feature.md)
  → references invariant I-SEC-001
    → defined in contract (docs/contracts/security_defaults.yml)
      → scopes files (src/**/*.ts)
      → points to test (tests/contracts/security.test.js)

Issue (#500)
  → references journey J-SIGNUP-FLOW
    → defined in contract (docs/contracts/journey_signup.yml)
      → points to test (tests/e2e/journey_signup.spec.ts)
      → covers reqs [AUTH-001, AUTH-002]
        → defined in contract (docs/contracts/feature_auth.yml)

ADR (docs/adr/use-chrome-storage.md)
  → declares invariant I-SEC-001
    → enforced by contract (docs/contracts/security_defaults.yml)
      → verified by journey (docs/contracts/journey_login.yml)

CONTRACT_INDEX.yml
  → lists all contracts
  → maps requirements to contracts
  → maps journeys to test files
```

**Nodes:** specs, contracts, journeys, tests, ADRs, invariant IDs, requirement IDs.
**Edges:** "references", "defined in", "points to", "covers".

A broken edge = a contract claims a test exists but it doesn't, or a spec references an ID nobody defined. Enforcement silently disconnects downstream.

## Checks

```bash
npx @colmbyrne/specflow graph
```

| Check | What it catches |
|-------|----------------|
| Test file references | `test_hooks.e2e_test_file` points to nonexistent file |
| Journey ID uniqueness | Same ID defined in two YAML files |
| CONTRACT_INDEX coverage | Contract file exists but not in the index |
| Invariant ID references | Spec references ID no contract defines |
| ADR frontmatter | ADR claims journey exists but file doesn't |
| Waiver expiry | Waiver `expires` date is past |
| Contract directory | `docs/contracts/` exists and has YAMLs |

## Graph vs Verify

| | `verify` | `graph` |
|---|---|---|
| Checks | Is Specflow installed? | Do contracts reference each other correctly? |
| Scope | Infrastructure | Data integrity |
| When | After install/update | After adding/editing contracts |
