# Prompt audit — Specflow agents, skills, loop prompts (#94, #128)

**Date:** 2026-09-12. **Protocol:** Anthropic `prompt-audit` (claude-api skill). **Status:** proposal. No prompt, skill, or agent file was edited. Every edit below is a hypothesis to re-probe, not a conclusion (Step 7 of the protocol); the kit has no behavioural eval for these prompts, so the first three hunks taken should be probed on a scratch copy before the rest.

## Assumptions (Step 0)

- **Scope:** `agents/*.md` (18 agent prompts plus README/PROTOCOL), `skills/*/SKILL.md`, `templates/loops/prompts/*.md`, `templates/loops/adversary-mandate.md`. `scripts/agents/` is an installed copy and diverges from `agents/`; it is out of scope and should be regenerated from `agents/` once edits land. Adapter policies and the runner's stage-prompt builder were audited under Group 4.
- **Target model:** Claude Fable 5.1 (`claude-fable-5-1`), the documented destination of the routing-template bump in `docs/specs/claude-code-overlap.md` AC5. Current pin is `claude-fable-5`.
- **Provenance:** every file in scope was authored 2026-06-09 to 2026-07-14 for Sonnet/Haiku-era subagents. No file carries YAML frontmatter that a runtime reads.

## Inventory (Step 1)

| Surface | Files | Bytes | Approx tokens |
|---|---|---|---|
| Agent prompts | 30 | 328 K | 82 K |
| Skills | 3 | 18 K | 4.6 K |
| Loop prompts + mandate | 5 | 10 K | 2.5 K |

Largest: waves-controller (31.6 K), specflow-writer (28 K), pre-flight-simulator (19.5 K), heal-loop (16 K).

## Summary

| Group | Findings | High | Medium | Low |
|---|---|---|---|---|
| 1a pressure language | 11 | 2 | 8 | 1 |
| 1b arithmetic rubrics in prose | 2 | 2 | 0 | 0 |
| 1c over-specification / repetition | 22 | 1 | 17 | 4 |
| 1d fossils / migration-relative | 5 | 1 | 4 | 0 |
| 1e prohibition clusters | 3 | 0 | 3 | 0 |
| 2 brittle skill files (pins, volatile paths, drifted duplicates) | 33 | 6 | 15 | 12 |
| 3 tool descriptions | 0 | | | |
| 4 request config / architecture | 5 | 2 | 2 | 1 |
| **Total** | **82** | **14** | **49** | **19** |

**Three highest-impact findings.**

1. **Two agents are LLM executors for deterministic plans.** `board-auditor` (marker grep, enum parse, timestamp and mtime compare, matrix render) and `heal-loop` (confidence decay arithmetic with an undefined 0.70–0.75 band) ask the model to compute what a script computes. Fable 5.1 will do it literally, per issue, per fix. Move both into `scripts/` and leave the model the judgment remainder. `contract-test-generator`'s YAML→Jest transform is the same shape.
2. **`sprint-executor` is a dangling duplicate of `waves-controller`.** waves-controller names it after the pre-flight gate but never invokes it, and re-implements its Phase 4 itself. One real difference survives (collision-resource pre-assignment, sprint-executor:41-64). Fold it in, delete the file, fix nine references.
3. **The kit contradicts itself on the stop rule.** The three loop prompts say "advance exactly ONE gate"; the newer loop-selector skill says "continue through every unblocked stage". An agent handed both stops inconsistently from tick to tick. This is a product decision, not a prompt edit, and it gates every other loop change.

Cross-file: the `## Recommended Model` prose section in 19 agents pins `sonnet`/`haiku`/`opus` tier aliases that no runtime reads. Claude Code reads `model:` and `effort:` frontmatter (fixed 2.1.259/2.1.267). This is the same gap #128 names as CB-003 and is the first hunk below.

## Group 4 — request config and architecture

| Location | Finding | Confidence | Action |
|---|---|---|---|
| `templates/adapter-policies/claude-code-large-routing.yml:24-25,63-64`; `scripts/specflow-runner.cjs:56`; `MODEL_ROUTING.md:90-91,116,135,147,250,290-291` | Model pin `claude-fable-5`; Fable 5.1 is current, same tier and price, more eager | High | bump to `claude-fable-5-1` after the High hunks below land; keep `claude-opus-4-8` fallback; add `'fable-5-1'` alias at runner:56 |
| `templates/loops/adversary-mandate.md` (v1/v2/v3 stacked) vs `spec-build.yaml:38` (`@v2`) vs `scripts/adversary-spawn.cjs:20` (`@v1`); `templates/QA/loops/` copies differ | Mandate version drift: the id the verdict records is not the mandate the critic reads | High | ticket (filed alongside this audit); align both references to the current id, one canonical copy |
| `scripts/specflow-runner.cjs:1338-1385` `materializeStagePrompt` | Volatile header (goal, stage, next gate) precedes stable rules | Low | no diff; each stage is a fresh `claude -p` call so nothing caches across the boundary today. Revisit if rails 1–5 share a `--resume` session |
| `agents/board-auditor.md`, `agents/heal-loop.md`, `agents/contract-test-generator.md` | LLM executor for a deterministic plan (see summary) | High / Medium | extract to `scripts/board-audit.cjs`, `scripts/fix-patterns.cjs`, generic contracts runner |
| `agents/sprint-executor.md` vs `agents/waves-controller.md` | Redundant specialist sub-agent | Medium | merge, delete sprint-executor |

## Findings by file

### `agents/pre-flight-simulator.md`

| Location | Evidence (quoted) | Pattern | Why obsolete on Fable 5.1 | Confidence | Action + replacement |
|---|---|---|---|---|---|
| pre-flight-simulator.md:7-9 | "## Recommended Model / `sonnet` — Multi-lens analysis…" | G2 pinned model names | Prose pin unread by any runtime; rots per release. Claude Code reads frontmatter. | High | rewrite → delete section; add frontmatter `name`, `description`, `model: inherit`, `effort: high` (takes effect only when installed under `.claude/agents/`; note in agents/README.md) |
| pre-flight-simulator.md:243 | "Do not produce partial output — wait until all lenses complete, then output once." | G1d update suppressor | Fable 5.1 under-narrates with hold-findings instructions present. Live purpose (one parseable block) survives without suppressing interim text. | High | rewrite → "The report is one contiguous block — waves-controller parses `simulation_status` out of it — so emit it once, complete, after every applicable lens. Brief progress notes to the caller before the report are fine." |
| pre-flight-simulator.md:399-400 | "Does NOT implement `confidence_score` — deferred from v1 (SIM-012 cut)." / "SIM-004 is cut from v1" | G2 history narrative (PRD ticket IDs) | Diff against a v1 the model never saw. Absence of a feature needs no rule. | High | remove both; if needed one sentence: "There is no confidence score and no automatic re-run on edit; re-simulation is invoked by the caller." |
| pre-flight-simulator.md:57-83 | "MANDATORY PREAMBLE: Proof-of-Work Contract Load" / "Before running ANY lens, you MUST…" / "Do not proceed to Lens 1 until…" (×3) | G1d model workaround + G1a pressure + G1c repetition | "Prove you read the files" ritual patched a model that skipped inputs; Fable 5.1 reads inputs and follows a requirement stated once. | Medium | rewrite 57-83 → "### Load contracts and schemas. Read every `docs/contracts/*.yml` and every path in `schema_files` before analysis, and list the files read in the report header so the caller can see what findings were verified against." Keep line 85 (empty-dir rule). |
| pre-flight-simulator.md:390-401 | "## What This Agent Does NOT Do" — 10 × "Does NOT …" | G1e prohibition cluster | 393-397 restate Role (5); 392/401 duplicate 333/361/386/417; 399-400 fossils. Only 398 adds info. | Medium | rewrite → "## Scope boundary. Findings cover structural correctness, schema reality, dependency order, timing, and failure states — not business-logic merit. This agent never writes: the calling agent edits tickets, writes P2 files, and sets `stale` / `override:[reason]`." |
| pre-flight-simulator.md:333, 361, 392, 433 | "This agent does NOT write the file." / "— ever." / "does not participate in override handling" | G1c repetition as reinforcement | Read-only boundary stated 5+ times; stale/override ownership 4×. | Medium | remove 333, 361, 392, 401, 433; keep 5, 312-313, 386, 408, 414, 417 |
| pre-flight-simulator.md:16 vs :20 | "User explicitly says 'run pre-flight on ticket #N'" vs "Do not accept free-text input — if … not … JSON, request it." | G2 duplicated info that disagrees | A direct user trigger is free text; literal-following model refuses its own trigger. | Medium | rewrite :20 → "Input is one of the two JSON shapes below. When a user invokes you directly with a ticket number, ask the calling session to fetch the ticket and build the ticket-scope JSON (this agent does not call `gh`)." |
| pre-flight-simulator.md:59, 218, 392 | "ANY lens" / "runs ONLY for wave scope. Skip entirely for ticket scope." / "— ever." | G1a pressure (CAPS, no reason) | Over-triggers; 218 duplicates heading at 214. Severity labels CRITICAL/P1/P2 are load-bearing, not flagged. | Medium | 218 delete; 59/392 covered above |
| pre-flight-simulator.md:136-152, 166-178, 191-205, 220-231 | "**Steps:** 1. … 2. … 3. …" under Lenses 3-6 | G1c step choreography for judgment | Order inside a lens does not matter; numbering invites ticking. Checks themselves are author knowledge, keep. | Medium | rewrite → "**Check:**" + de-numbered bullets; keep every check and Finding format block |
| pre-flight-simulator.md:373-376 | "Linux: `stat -c %Y …` / macOS: `stat -f %m …`" | G2 wrong degrees of freedom | Not a narrow bridge; duplicates board-auditor.md:81-83 (working redundancy, keep-list #8). | Low | flag |

### `agents/specflow-writer.md`

| Location | Evidence (quoted) | Pattern | Why obsolete on Fable 5.1 | Confidence | Action + replacement |
|---|---|---|---|---|---|
| specflow-writer.md:6-7 | "## Recommended Model / `sonnet` — Generation task…" | G2 pinned model names | As above. | High | rewrite → frontmatter `name: specflow-writer`, `description: Turns feature requests into build-ready tickets with Gherkin, full SQL contracts, journeys, and the YAML/test artifacts CI checks.`, `model: inherit`, `effort: high` |
| specflow-writer.md:25-49 | "MANDATORY PRE-CODE RECONNAISSANCE" / "The LLM is a next-token predictor…" / "Four of five common post-code corrections (pino-http stubs, better-auth ESM…)" | G1a trait claim + G1d workaround + G2 recency trap | Wrong agent: this file writes specs, never code (Role, line 4). "Q7 in the pre-flight packet" exists only in builder-guidance.md:69; `jest.config.cjs`, pino-http, better-auth are one project's incidents. Trait-claim sets an anxious register. | High | move → Q7 checklist stays in builder-guidance.md. Replace 25-49 with one line under Step 1: "Read the code, tests and config around the surface being specified so the spec names real files, existing helpers and constraints rather than guesses." |
| specflow-writer.md:84-91, 202, 206-208 | "`docs/PTO.md`, `docs/meetings/`" / "Employee, Manager, Org Admin…" / "I-PTO-XXX, I-OPS-XXX" / "Domains: `PTO`… `SCH`, `SYS`" | G2 volatile specifics + duplicates that disagree (502-503 says steps are stack-agnostic) | Origin-project paths and personas hardcoded into steps the file declares generic; model will search for `docs/PTO.md` in every adopting repo. | High | rewrite Step 1 → "1. Read the project's product docs and meeting notes. 2. Read existing code for the feature. 3. Read the schema/migrations directory. 4. Read related issues for prior invariants. 5. Take personas, bounded contexts and the invariant-prefix registry from the Domain Knowledge section below." Delete 202; prefix list lives at 527-532. |
| specflow-writer.md:276-282 and 738-746 | five trigger phrases, verbatim ×2 | G2 trigger-case enumeration + duplicate | Last bullet subsumes the other four; list grows per missed trigger. | High | rewrite :276-282 → "This applies to every run that creates or modifies a ticket body, however the request is phrased." remove :738-746 |
| specflow-writer.md:9-21, 579-619, 656-669 | "Every specflow-writer run MUST produce these files" (4) vs Step 10 (5+10b) vs "MANDATORY CHECKLIST" (9) | G2 duplicated info that drifts (three required-output lists disagree) | Top list omits contract test stub, index version/totals bump, issue comment. Literal model reads the first list as the contract. | High | rewrite → Step 10 (579-654) is the single "Required outputs" list, folding in the three checklist-only items. Replace 9-21 with: "Every run produces the artifacts in Step 10, not just issue text. Contract rules live in `docs/contracts/*.yml` — the verifier and CI read YAML, not markdown — so a ticket whose invariants exist only in the issue body is not compliant." remove 656-669. Make `src/__tests__/contracts/…` (617) "the project's contract-test directory". |
| specflow-writer.md:11, 18-19, 27, 49, 63, 105, 198, 274, 276, 284, 581, 623, 632, 654, 659, 740, 770 | "MUST" ×9, "NEVER" ×3, "MANDATORY" ×5, "No exceptions." | G1a pressure: everything marked critical | 26 caps hits; marker carries no information; register bleeds into generated tickets. | Medium | rewrite → drop CAPS and "not optional"/"no exceptions" tails; keep each requirement as a plain sentence with its reason (e.g. 770: "Every new table gets RLS policies — migration-builder ships the SQL as written.") |
| specflow-writer.md:274, 284, 740 + 63, 256-258, 585, 623, 710 + 11, 581, 623, 654 | "neither step is optional" ×3; "Journeys are Definition of Done" ×5; "not optional / incomplete" ×4 | G1c repetition as reinforcement | Each rule restated 3-5× across sections. | Medium | rewrite → state each once at point of use: journey-as-DoD at Step 8 (256); format-then-simulate at 9a heading; artifacts-not-issue-text in Step 10 lead. Remove others. |
| specflow-writer.md:734-763 | "## Pre-Flight Integration … See also Step 9a" | G1c near-duplicate sections (self-acknowledged) | 736, 750, 754 restate 303, 321-323, 311. Only Override mechanics (756-761) unique. | Medium | move 756-761 into Step 9a as "Step 9a-iii: Override"; remove 734-755, 763 |
| specflow-writer.md:671-685 | "### What Happens If You Skip This / The `contract_completeness.test.ts` audit test will fail…" | G1c grader vocabulary + G2 volatile specifics | Describes the scoring apparatus; named test file does not exist in this repo. | Medium | rewrite → one sentence in Step 10 lead: "CI's Contract Completeness gate fails the PR when `CONTRACT_INDEX.yml` and the files on disk disagree, so keep them in sync." Remove sample failure output. |
| specflow-writer.md:767-776 | "## Anti-Patterns to Avoid / 1. Placeholder SQL: Never… 8. Single-domain thinking" | G1e prohibition cluster | 1-3, 6, 7 duplicate Quality Gates; 8 has no provenance. Reason for 1-3 missing. | Medium | rewrite → fold into Quality Gates: "SQL is complete and executable because migration-builder ships it as written — no placeholders, no signature-only RPCs." Keep item 5 positive example. remove 6-8. |
| specflow-writer.md:106-241 | SQL/Gherkin examples: "Dublin Central", "Baby Room", "Surgery 1 / clinical", "auth.jwt()->>'org_id'" | G1c example over-indexing (single domain) | Shape is load-bearing (keep #7) but childcare/clinic domain and Supabase idiom get matched verbatim elsewhere. | Medium | rewrite → keep blocks; add above Step 3: "Examples below are illustrative shape only — take entities, personas and auth idiom from the Domain Knowledge section." Neutralise proper nouns. |
| specflow-writer.md:493-503, 542-550 | "> **ADAPTATION REQUIRED:** Add your project's domain knowledge below." | G2 wrong audience (human setup notes inside model-facing prompt) | Model may treat adoption steps as its own tasks. | Low | flag — move to agents/README.md; leave placeholder |
| specflow-writer.md:272 | "Always use heredoc for body." | G1a emphasis without reason (keeper) | Genuine fragile-op guard, reason missing. | Low | rewrite → "Pass the body via heredoc or `--body-file` so backticks and quotes survive the shell." |

**Kept deliberately (A):** pre-flight-simulator.md:257-317 report format + `simulation_status` enum ("MUST match exactly" is calibrated); :89-237 six lens rubrics; :85, 321-361 empty-dir rule + WRITE INSTRUCTION blocks. specflow-writer.md:286-347 ticket-scope JSON + severity action rules; :587-654 journey YAML, CONTRACT_INDEX sections, Playwright skeleton with `test.skip()`, naming rule; :689-730 Quality Gates.

### Mid-size agents: ticket-closer, specflow-uplifter, contract-test-generator, migration-builder, contract-generator, waves-controller, sprint-executor, board-auditor

| Location | Evidence (quoted) | Pattern | Why obsolete on Fable 5.1 | Confidence | Action + replacement |
|---|---|---|---|---|---|
| ticket-closer.md:6-7, board-auditor.md:6-7, migration-builder.md:6-7, specflow-uplifter.md:8-9, contract-test-generator.md:8-9, contract-generator.md:8-9, waves-controller.md:8-9, sprint-executor.md:8-9; waves-controller.md:696,760-764; agents/README.md:165-185 | `## Recommended Model` / `haiku — Mechanical task…` / `Task(…, model="haiku")` | G2 pinned model names | Prose section read by no runtime; tier names two generations stale. Harness reads `model:`/`effort:` frontmatter. | High | replace-with-API-feature: delete section in all 8; add frontmatter (mechanical agents ticket-closer, board-auditor → `effort: low`; generation/orchestration → `effort: medium`; `model: inherit`, never a retired alias). Remove `model="…"` args at waves-controller:696,760-764; point README Routing Table (165-185) at frontmatter. |
| waves-controller.md:269-276 | `score = label_weight + (blocker_count * 2) + context_bonus + risk_factor` … `critical=10, priority-high=7…` | G1b inline arithmetic rubric | Model computes a 4-term score per issue in prose; spends reasoning on tallying, not ordering judgment. | High | move into code: `6. Order issues within a wave by running node scripts/wave-priority.cjs (label weight, blocker count, recent-commit relevance, DB/edge-function risk). Use its output as the default order; override only when an issue's spec makes a dependency obvious that the labels miss.` |
| board-auditor.md:22-93 (Steps 1–2b), :95-113 (Step 3 matrix) | `"Scenario:" or "gherkin" (case-insensitive) in body/comments` … `If updated_at > simulated_at → write simulation_status: stale` | G4 LLM executor for a deterministic plan | Marker grep, enum parse, RFC 3339 compare, mtime compare, matrix render: inputs fully determine output. File itself says "Mechanical task". Only Step 4 Infrastructure classification and Step 5 recommendations are judgment. | High | move: extract Steps 1–3 + 2b into `scripts/board-audit.cjs` (matrix JSON + `PF=stale` write). Process → `1. Run node scripts/board-audit.cjs and read its matrix. 2. For each non-compliant issue decide Infrastructure vs needs uplift/rewrite. 3. Produce the report and post it.` Keep Step 4 tables and the two block-quoted rules verbatim. |
| waves-controller.md:389-391, :700; SKILL.md:73 | `**NO regex interpretation. NO fuzzy matching. Parse the enum value directly.**` | G1a pressure + G1d unenforced instruction that could be code | Bold-caps triple makes a literal model refuse trailing whitespace/backtick values as anything but `blocked`. | High | rewrite 389-392 → `4. Read each ticket's **simulation_status:** line and compare the value exactly against the enum passed | passed_with_warnings | blocked | stale | override:<text>; any other value counts as blocked so a malformed section can never pass the gate.` Delete line 700. Same at SKILL.md:73. |
| waves-controller.md:25-46, :681-776 | `Check if TeammateTool is available (Claude Code 4.6+)` … `All existing behavior is preserved.` … Phase 2 means different work in Teams vs fallback | G2 version pins + G1d migration-relative + duplicates that disagree | Pins a Claude Code version and tool name as capability test; two pipelines share one phase numbering. | Medium | rewrite 27-33 → `Use Agent Teams (persistent teammates) when the harness exposes a teammate/spawn-team tool; otherwise spawn one-shot subagents with the Task tool. Same phases, same gates, same visualizations — only the spawn mechanism differs.` Delete 683. Renumber fallback phases to match the Teams-mode table. |
| sprint-executor.md (whole) vs waves-controller.md:327-334, 340-398, 723-728, 757-766 | waves-controller: `Do NOT fire sprint-executor` (395) yet fallback Phase 4 spawns builders itself (726) | G4 redundant specialist sub-agents | **Redundant in subagent mode.** Both take a wave plan, create TaskCreate entries with blockedBy, launch builders, track notifications, post wave summary, same tools. waves-controller names sprint-executor but never invokes it. One real difference: sprint-executor Step 2 (:41-64) pre-assigns collision-prone resources (migration numbers, feature dirs). | Medium | remove sprint-executor.md; waves-controller absorbs: insert Step 2 (41-64) into fallback Phase 4 (`Before spawning builders, pre-assign migration numbers and feature directories…`); fold briefing checklist (111-121) into Subagent Coordination Pattern (757-766). Rewrite waves-controller:340/344/395-398/660. Update refs: agents/README.md:123,175,251; SKILL.md:50,77,80,258; agents/WORKFLOW.md; journey-enforcer.md; e2e-test-auditor.md; pre-flight-simulator.md; builder-guidance.md; docs/reference.md. |
| contract-generator.md vs contract-test-generator.md; contract-test-generator.md:47-330, 332-412 | test-gen Step 5: `for (const rule of contract.rules?.non_negotiable …) new RegExp(forbidden.pattern.slice(1, -1))` | G4 LLM executor for a deterministic plan (roster: NOT redundant) | Different inputs/outputs/stage, so not duplicate agents. But YAML→Jest is a deterministic transform; its own Step 5 runtime script proves no model call is needed to generate per-contract files. Judgment remaining: assertion-identity (:502-505) and data-testid decisions. | Medium | rewrite: ship one generic runner in templates/ (`src/__tests__/contracts/contracts.test.ts` loading every `docs/contracts/*.yml`, keep `CONTRACT VIOLATION:` format 470-478). Process → `1. Ensure the generic runner and test:contracts script are installed. 2. For any rule whose pattern would only match per-call ids, emit a data-testid requirement on the implementation ticket instead of a weakened pattern. 3. Report.` Keep Steps 6–8, Quality Gates. |
| waves-controller.md:71-92, :296-303 | `Read scripts/agents/issue-lifecycle.md` … (16 Read lines) then 6 again | G1c repetition + G2 skill size tax | Loads 16 agent prompts before Phase 1, re-reads 6 in Phase 2, every invocation. | Medium | rewrite 71-92 → `### 2. Agent prompts. Read an agent's prompt file (scripts/agents/<name>.md) at the point you spawn it and pass its contents as that agent's prompt. Read PROTOCOL.md and team-names.md once, in Phase 2, when spawning a team.` Delete 296-303. |
| waves-controller.md:96-98, 636-638, 664, 671, 675 | `These are NOT optional — they are the trust layer` ×5 | G1c repetition + G1a | Legitimate product decision with reason, stated 5×. | Medium | rewrite 98 → `Five ASCII visualizations render at fixed phases (table below). They are the trust layer: they make execution order, enforcement, and progress visible.` Remove 638, 664, 671, 675. |
| waves-controller.md:433-437; board-auditor.md:68 | `**SIM-004 is NOT implemented in v1.** … Do not implement auto-triggers.` / `Known false-positive (accepted risk for v1)` | G2 history narrative + G1d migration-relative | Roadmap language; "Do not implement auto-triggers" reads as refuse-if-asked. | Medium | rewrite 433-437 → `Pre-flight runs once per wave. If a ticket is edited after the wave passed pre-flight, re-run the simulator with scope ticket for that issue, then wave scope if its status changed. (Do not key re-simulation off GitHub updated_at — it advances on comments too.)` board-auditor:68 → `Note: GitHub updated_at also advances on comments, so a review comment on a passing ticket marks it stale; re-running pre-flight clears it.` |
| ticket-closer.md:21-53 (Step 0), :106-128 (4b), :158-160, :173-176; :161,163,166 | `MANDATORY -- runs before all other steps` / `NEVER close a UI issue without a Tier 1…` | G1c repetition + G1a NEVER/ALWAYS cluster | Tier 1 certificate gate (keep) specified 4× with differing wording; "include test results" 4×. | Medium | rewrite: merge 4b's two novel checks into Step 0 as 2b/2c, delete 106-128 (keep its "Cannot close" block). Replace Rules 1-10 with four plain rules (close only when every AC met + Tier 1 cert for UI; comments name files/commits and Playwright results; validate each scenario/checkbox individually, leave unchecked when unsure; cross-reference as #NN). Trim QG to the four items not in Rules. |
| ticket-closer.md:55-79 (Steps 1–3) | `3. Read each changed file to understand what was implemented` | G1c step choreography for judgment | Read-everything script told literally runs even for a two-issue closure. | Medium | rewrite 55-79 → `### Step 1: Match implementation to issues. From the commit range and the target issues, decide for each issue which ACs are satisfied, partial, absent. Evidence per criterion: implementing file(s), commit(s), and whether a required migration/RPC/Edge Function exists.` Keep path→feature map (59-65). |
| specflow-uplifter.md:129-131, 244-264 | `Step 5: Post-Uplift Pre-Flight Simulation (MANDATORY)` … `it MUST invoke pre-flight-simulator` | G1c near-duplicate sections + G1a | Step 5 already states the rule; trailing section restates in table + two subheadings. | Medium | rewrite 129 → `### Step 5: Post-uplift pre-flight`; 131 → `After posting the uplift comment, run pre-flight-simulator on the updated ticket. Its findings — not the uplift itself — decide whether the ticket is compliant.` Fold in: `pre-flight-simulator is read-only; you perform the gh issue edit. When uplifting several issues, run Steps 1–5 per issue.` Delete 242-264. |
| contract-test-generator.md:47-94, :96-173 vs :175-330 | two different `findMatches` implementations, different ARCH-002 semantics | G1c gold output twice, duplicates disagree | Model must pick one. Superseded if the generic-runner row is taken. | Medium | remove 47-173; relabel Step 4 → `### Step 2: Generated test file (illustrative — one example per rule type)` |
| contract-test-generator.md:502; sprint-executor.md:17 | `## Assertion identity rule (pipeline-hardening #60)` / `(or GitHub issue #115 equivalent)` | G2 incident IDs | Archaeology the model can't resolve. | Medium | rewrite → `## Assertion identity rule`; `- Sprint wave plan from dependency-mapper` |
| contract-generator.md:20, 272; sprint-executor.md:190 | `The your project agents excel at SQL contracts.` / `project: your project` | G2 templating artifact | Search-and-replace residue reproduced literally into generated metadata. | Medium | rewrite → `The migration-builder covers SQL contracts. This agent adds the YAML contract layer for code-level enforcement.` / `project: <project-name>` / `for the <project-name> project.` |
| migration-builder.md:52 (also :231, :242) | `-- WRONG (does not exist in Supabase): uuid_generate_v4()` | G2 factual claim with no verification | Rule right, reason wrong (`uuid_generate_v4()` exists with uuid-ossp). Stated 3×. | Medium | rewrite 49-53 → `-- Use gen_random_uuid() (built into Postgres 13+); uuid_generate_v4() needs the uuid-ossp extension, not enabled by default.` Keep 231; delete QG 242. |
| sprint-executor.md:111-121, :184-224 | `Every agent prompt MUST include: 1…7` + 5-step template + `IMPORTANT:` | G1c choreography propagated into sub-agent briefs + G1a | Scripts the builder's work; builders plan natively. | Medium | delete Step 6; replace template body with deliverable-shaped brief (implement issue per spec following patterns; write to exactly [pre-assigned path]; when done comment + label; constraints list). |
| migration-builder.md:45, 227; sprint-executor.md:43; specflow-uplifter.md:129 | `Follow these MANDATORY patterns:` / `## Known Gotchas (MUST AVOID)` / `**CRITICAL: This prevents…**` | G1a caps headers (constraints stay, reasons present) | Caps make gotchas read as refusal criteria. | Low | rewrite headers only. |
| contract-generator.md:69, 366 | `**Always create feature_architecture.yml first**` | G1c strategy coaching | Creation order changes nothing. | Low | rewrite → `Ensure a feature_architecture.yml exists — it protects the structural invariants every feature contract assumes.` |
| sprint-executor.md:134-151 | `Wait for the entire wave (cleaner), or launch as they unblock (faster)… conservative is safer` | G2 option menu | Deliberated on every wave. | Low | rewrite → one default (wait for wave) + one escape hatch (early launch when blockers done and resources cannot collide). |
| waves-controller.md:282 vs :6, 677 | `"Proceed with this order? (yes/override)"` vs `user invokes you once, you handle everything` | flag (internal contradiction, product decision) | Stalls non-interactive runs. | Low | flag: drop the prompt, or pause only on first wave / graph change. |
| specflow-uplifter.md:219-229; board-auditor.md:40; contract-generator.md:55-66; ticket-closer.md:59-65 | `I-OPS … I-PTO … I-PAY … I-ENT` / `supabase/functions/*/index.ts` | G2 volatile specifics in a reusable kit | One HR product's domain prefixes/layout shipped as registry. | Low | flag; if kept prefix `Illustrative — replace with this project's domains/paths.` |
| sprint-executor.md:70-78, 95-109, 127-132; waves-controller.md:316-334, 521, 535, 554 | `Task("Build #73…", …, "general-purpose", { run_in_background: true })` / `TeammateTool(operation: "spawnTeam")` | G2 volatile harness API shapes / G3 contract accuracy | Undocumented call shapes pinned literally; nothing verifies them. | Low | flag: verify against current harness schema; otherwise describe intent. |
| contract-test-generator.md:414-425 | `"test:contracts": "jest --testPathPattern=contracts"` | G2 version-dependent flag | Removed in Jest 30; repo pins ^29.7.0. | Low | flag; path form `jest tests/contracts/ --no-coverage` matches package.json:38. |
| ticket-closer.md:135-137 | `gh issue edit --add-project … Move closed issues to Done column automatically` | G1d unenforced + G3 contract mismatch | `--add-project` cannot set a column; needs `gh project item-edit`. | Low | rewrite → `### Step 6: Project board. If the repo uses a Projects board with a Status field, set closed issues to Done via gh project item-edit; otherwise skip.` |
| migration-builder.md:235 | `*/30 in SQL comments | Escape or avoid — Deno parser treats as code` | G2 recency trap | Narrow incident, no repro path. | Low | flag; keep only if it reproduces with current Supabase CLI. |
| waves-controller.md:451-473 | `Common issues after Phase 2: 1. ORPHAN_FILE … Do NOT proceed to Phase 3` + QG `Exit code 1 → STOP` | G1c enumerating what the tool reports | Script self-describes failures; STOP rule stated twice. | Low | rewrite → `**If it fails (exit 1):** fix every item the script lists, re-run, proceed to Phase 3 only on exit 0.` |

**Kept deliberately (B):** ticket-closer.md:30-51 certificate rules + "Cannot close" blocks; migration-builder.md:47-176, 198-216, 229-236 SQL/RLS patterns, idempotency, gotcha table; board-auditor.md:114-134 classification table + Journey/Pre-Flight rule quotes; contract-generator.md:71-327 YAML examples + CONTRACT_INDEX; contract-test-generator.md:468-478 `CONTRACT VIOLATION:` format, :502-505 assertion-identity body; waves-controller.md:100-243 visualization templates, :394-431 gate logic/override, :441-449 completeness script; sprint-executor.md:41-64, 93 collision pre-assignment and single-message launch.

### Skills, loop prompts, adversary mandate, heal-loop, journey-tester, agents/README

| Location | Evidence (quoted) | Pattern | Why obsolete on Fable 5.1 | Confidence | Action + replacement |
|---|---|---|---|---|---|
| heal-loop.md:47-55, 66-71, 81-97, 109 | `pattern.confidence = pattern.confidence - (weeks_since_last_use * 0.01)` … `Platinum (>= 0.95)` … `Bronze (< 0.70)` | G1b inline arithmetic rubric | Executed literally in-context on every fix: date arithmetic, decay, tier recalculation, JSON read-modify-write. Rubric is broken: Silver `>= 0.75`, Bronze `< 0.70`, so 0.70–0.75 is undefined. | High | replace-with-code: `scripts/fix-patterns.cjs` with `match --rule <id> --message <msg>` → `{tier, template}` and `record --id <id> --outcome pass|fail` (decay inside). Prompt → "Before fixing, run match. Apply the template when platinum/gold (gold: add `[fix-pattern: <id>]` to the commit); use as reference when silver; ignore bronze. After re-test, run record." Delete 47-55, 81-121. |
| journey-tester.md:27 | `**CRITICAL: Always check for existing journey contracts before defining from scratch.**` | G1a CRITICAL/MUST | Textbook over-trigger row. | High | rewrite → "Check the issue for an existing journey contract first (the `gh` commands below); define one from the verbal description only when none exists." |
| journey-tester.md:182 | `await expect(page.getByTestId('product-card')).toHaveCount.greaterThan(0)` | G2 API claim with no verification | Not a Playwright API; gold example ships an invalid assertion into every generated test. | High | rewrite → `await expect(page.getByTestId('product-card').first()).toBeVisible()` |
| templates/loops/prompts/spec-build.prompt.md:14,17; feature-build.prompt.md:14; daily-use-teardown.prompt.md:14 vs skills/specflow-loop-selector/SKILL.md:74,78 | prompts: `Advance exactly ONE gate` / `Stop after that gate.` vs selector: `Continue through every currently unblocked stage/rail in the same invocation.` | G2 duplicates that disagree | Two contradictory stop rules reach the same agent; literal model reconciles unpredictably tick to tick. Selector (06-30) is newer than prompts (06-12). | High (that they disagree; which wins is a product decision) | rewrite prompt step 3 → "3. Advance through every gate that is unblocked this tick; persist each result to those artifacts (never only to chat). Stop only where the path says: a hard gate needing human input, a `never_without_human` action, missing input/evidence, or an external wait." Drop spec-build.prompt.md:17 "Stop after that gate." Or rewrite selector 74/78 instead. Pick one. |
| skills/specflow-audit/SKILL.md:8,18,20 | `never freelance the uplift inline` · `## The non-negotiable process` · `Do not skip phase 3.` | G1a + G1c repetition | Same rule 3× in 12 lines. | Medium | rewrite 8 → "Bring a partially-compliant story to compliance in three phases. Phase 3 is the gate that decides compliance, so it always runs." 18 → `## The process`; delete 20. |
| skills/specflow-audit/SKILL.md:34-38 | `Phase 3 — Pre-flight gate (HARD STOP)` · `compliant ONLY when` · `do NOT write` | G1a CAPS density | Gate is load-bearing; shouting over-triggers. | Medium | rewrite → "### Phase 3 — Pre-flight gate. After uplift, simulate the combined ticket and assign each finding CRITICAL / P1 / P2. A ticket is compliant only when no CRITICAL or P1 remains: if any do, surface them and leave the ticket non-compliant; if clean or P2-only, write the `## Pre-flight Findings` section with the matching `simulation_status`." |
| skills/specflow-audit/SKILL.md:10-14; skills/specflow-simulate/SKILL.md:10-12 | `Trigger on: …` · `Do NOT trigger on generic…` | G2 trigger text in body (dead after trigger) | Body is read after triggering; duplicates frontmatter and drifts. | Medium | remove audit 10-14 (keep 16), simulate 10-12 (keep 14-17 diagram). |
| skills/specflow-loop-selector/SKILL.md:89 | `If the user asks to "simulate", "simulate usage end to end", …` | G2 trigger-case enumeration (third copy) | Three copies of one list. | Medium | rewrite → "If the user asks to simulate or stress-test a story, use `specflow-simulate` directly (its description owns the triggers)." |
| skills/specflow-loop-selector/SKILL.md:78 | `Do not stop merely because the next stage is named GATE_*, B.5, or handoff.` | G2 recency trap / patch accretion | Model treats the named list as exhaustive. | Medium | rewrite → "Any stage not in the stop list above is work to perform now, whatever it is named; the stop list is exhaustive." |
| skills/specflow-loop-selector/SKILL.md:37-40 | `.specflow/adapter-policies/codex-gpt56-sol-routing.yml` · `claude-code-large-routing.yml` | G2 hardcoded paths with model pins in filename | Rename → skill points at a missing file. | Medium | rewrite → "Claude Code and Codex each have a managed profile under `.specflow/adapter-policies/`, created or refreshed by `specflow run --setup-routing --runtime <codex|claude-code>`; use that file. Unknown runtime: ask." |
| skills/specflow-simulate/SKILL.md:31-32 | `The ux-critique skill already runs parallel persona agents…` | G2 dangling cross-reference | No such skill in the kit. | Medium | rewrite → "For a deep run, fan out one fresh-context agent per persona so each route is explored blind to the others, then dedupe into the single findings block." |
| skills/specflow-simulate/SKILL.md:24-28 | `1. Read the story … 4. Collect gaps` | G1c choreography for judgment | Steps 1–4 are default behaviour; 5–6 carry the constraints. | Medium | rewrite 22-28 → "Full method in `references/simulation-method.md`. Constraints: pick 3–5 behavioural personas that stress this story (power user, first-timer, wrong-permissions, interrupted/returning, adversarial), walk each through the happy path and at least one divergent route, and record every moment the story is silent, ambiguous, or wrong." Keep 28-29. |
| skills/specflow-simulate/SKILL.md:18 (also :3, :8) | `It is NOT the pre-flight gate… Do not conflate the two.` | G1c repetition | Stated 3×. | Medium | rewrite 18 → "This skill discovers and proposes; the pre-flight gate in `specflow-audit` verifies and blocks." |
| skills/specflow-audit/SKILL.md:63 | `Find the repo: it is the dir containing CONTRACT-SCHEMA.md (commonly tooling/Specflow/…)` | G2 volatile specifics + strategy coaching | Layout guesses rot. | Medium | rewrite → "If the canonical Specflow docs are in the repo (the directory containing `CONTRACT-SCHEMA.md`), ground against them; otherwise the `references/` files here are sufficient." |
| templates/loops/prompts/gate-d.prompt.md:6, 19-20, 22-23 | countersign rule ×3 in 20 lines | G1c repetition | Keeper rule; count is the finding. | Medium | rewrite 6 → `Goal: GATE D green for epic #<n> — persona-walk the MERGED tree`; keep 19-23 as the single statement. |
| gate-d.prompt.md:11-12,17,19,21-22; daily-use-teardown.prompt.md:14,16,20-22; feature-build.prompt.md:17; spec-build.prompt.md:14 | `RECOMPUTE` · `MATERIALIZED` · `DISPOSITION` · `You NEVER run` · `trust lives ONLY` | G1a CAPS density | 8–12 CAPS tokens per 20-line prompt; real hard gates no longer stand out. | Medium | rewrite to sentence case, backticks for identifiers, bold reserved for `never_without_human` items. |
| heal-loop.md:123-238 | `### Step 1: Parse Violation Output … For add_import: 1. Check… 2. Find… 3. Add…` | G1c choreography for non-fragile work | Micro-scripts per strategy degrade it; decision/strategy tables stay. | Medium | rewrite → "Given the violation and its rule (grep the id in `docs/contracts/*.yml` → patterns, auto_fix, scope, example_compliant), make the smallest edit that satisfies the rule using the tables below; do not refactor around it. With no auto_fix, fix only when the diff from example_compliant is direct; otherwise escalate." Keep tables, Step 7, Step 9. |
| journey-tester.md:59-99, 117-218 | 100-line e-commerce gold spec + 40-line prose retelling | G1c example over-indexing | Every generated journey test shaped like a checkout. 59-99 duplicates 38-55. | Medium | rewrite: delete 59-99; shrink 117-218 to an illustrative `test.describe` skeleton with `test.step` per contract step, labeled illustrative. |
| journey-tester.md:289 | `## Assertion identity rule (pipeline-hardening #60)` | G2 incident id in heading | Archaeology. | Medium | rewrite heading → `## Assertion identity rule` |
| agents/README.md:166-186; heal-loop.md:6; journey-tester.md:6-7 | routing table with `opus`/`sonnet`/`haiku` tier aliases | G2 pinned model names (20 places) | Nothing re-checks them; per-agent rows duplicate the README table. | Medium | rewrite: route by capability class (`reasoning`/`generation`/`scan`), map classes to model ids in one place; per-agent lines become `Routing class:` (or frontmatter per part A/B). |
| agents/README.md:438-442 | `- **Process**: Step-by-step with examples` | G1c institutionalises choreography | Template tells authors to write the degrading pattern. | Medium | rewrite → "- **Process**: outcomes, constraints, and how to verify; numbered steps only where order is load-bearing (gates, destructive commands, exact test invocations)". |
| templates/loops/adversary-mandate.md:22, 46 | `Supersedes @v1 … Everything in @v1 holds, plus …` · `(the generalization of the v1 catch…)` | G1d migration-relative + G2 history narrative | Critic reads a diff-of-diffs across three stacked versions. | Medium | flag (versioned artifact): next version = one self-contained mandate; changelog outside the mandate text. |
| adversary-mandate.md:1/20/44 vs spec-build.yaml:38 (`@v2`) vs adversary-spawn.cjs:20 (`DEFAULT_MANDATE_REF = 'adversary-mandate@v1'`); templates/QA/loops copies differ | file stacks v1, v2, v3; YAML says v2; spawner defaults v1 | G2 duplicates that disagree + G4 architecture | The mandate id the verdict records is not the one the critic reads. Versioning only works if references agree. verify-seed checks the id shape, not the mandate bytes. | High that they differ | ticket: align spec-build.yaml and adversary-spawn.cjs on the current id; one canonical copy (other generated by installer). |
| skills/specflow-audit/SKILL.md:3 | `It is the reliable replacement for ad-hoc inline "make it compliant" edits…` | G2 provenance in trigger text | Trigger text may carry urgency; this sentence is history. | Low | flag |
| skills/specflow-simulate/SKILL.md:3 | five near-synonym trigger phrases | G2 trigger-case enumeration | Only a finding if it grows. | Low | flag |
| skills/specflow-loop-selector/SKILL.md:3 | `Compatible with Claude Code, Codex, K2.7, and other agents` | G2 pinned runtime names | Names rot. | Low | flag |
| skills/specflow-loop-selector/SKILL.md:53, 75, 91, 92 | durable-evidence rule ×4 | G1c repetition | Keeper, stated 4×. | Low | flag |
| heal-loop.md:31 | `**When in doubt, escalate.**` | G1a if-in-doubt default | Carries its reason. | Low | flag |
| heal-loop.md:361-400 | Examples 3–5 all end "Immediately escalate" | G1c padding | Re-teach the scope table. | Low | flag |
| heal-loop.md:441-450 | `Forge's Failure Analyzer (Sonnet) and Bug Fixer (Opus)… up to 10 iterations` | G2 history with pinned tiers + second iteration count | 10 vs the agent's 3. | Low | move to Attribution in agents/README.md |
| agents/README.md:190 | `~40-60% token cost reduction vs all-Opus.` | G2 unverifiable claim | Rots. | Low | flag |

**Kept deliberately (C):** every `never_without_human` block and hard-gate stop rules in all four prompts; exact commands (`teardown-gate.cjs check|sign`, `specflow run … --confirm-models`, the jest invocation); the "Hard rules from the path" recap in each loop prompt including the `<1000 lines` slice constraint; adversary-mandate.md:32-40 banned failure modes and journey-tester.md:291 assertion-identity body; specflow-audit/SKILL.md:43-58 Journey = Definition of Done with its reason; loop-selector's "budget cap / quota guard" wording rule and the `Model routing active:` field list.

## Proposed diff (Step 6)

One finding per hunk. High-confidence findings with exact text are given as hunks; High findings that require new code (script extraction, agent merge) and all Medium findings are given as replacement text in the tables above and are applied on acceptance. Nothing here has been applied.

### H1. Model pin → frontmatter (19 agents; example shown, same shape for each)

```diff
--- a/agents/pre-flight-simulator.md
+++ b/agents/pre-flight-simulator.md
@@ -1,9 +1,10 @@
+---
+name: pre-flight-simulator
+description: Read-only structural, schema, and dependency simulation of ticket specs and wave batches. Returns findings; never writes.
+model: inherit
+effort: high
+---
 # Agent: pre-flight-simulator

 ## Role
 ...
-## Recommended Model
-
-`sonnet` — Multi-lens analysis across tickets and contracts; structured output generation
```

Effort by class: mechanical agents (board-auditor, contract-validator, e2e-test-auditor, journey-enforcer, test-runner, ticket-closer) `effort: low`; generation and orchestration agents `effort: medium`; judgment agents (pre-flight-simulator, specflow-writer, heal-loop) `effort: high`. `model: inherit` everywhere; tier selection stays in the routing policy. Frontmatter is read only when the file is installed under `.claude/agents/`; `agents/README.md` must say so and its Routing Table (165-185) points at the frontmatter. Also remove `model="…"` args at `waves-controller.md:696,760-764`.

### H2. pre-flight-simulator.md:243 — update suppressor

```diff
-After all applicable lenses have run, produce the machine-readable report below. Do not produce partial output — wait until all lenses complete, then output once.
+After all applicable lenses have run, produce the machine-readable report below. The report is one contiguous block, because waves-controller parses `simulation_status` out of it, so emit it once and complete. Brief progress notes to the caller before the report are fine.
```

### H3. pre-flight-simulator.md:399-400 — v1 fossils

```diff
-- Does NOT implement `confidence_score` — deferred from v1 (SIM-012 cut).
-- Does NOT auto-rerun on ticket edit — SIM-004 is cut from v1; re-simulation on edit is manual.
+- There is no confidence score and no automatic re-run on edit; the caller re-invokes simulation.
```

### H4. specflow-writer.md:25-49 — builder reconnaissance block in a spec-writing agent

Replace lines 25-49 (from `## MANDATORY PRE-CODE RECONNAISSANCE` through the end of that section) with one line under Step 1:

```diff
-## MANDATORY PRE-CODE RECONNAISSANCE
-
-**Before writing any implementation, you MUST complete reconnaissance and output it as Q7 in the pre-flight packet.**
-
-The LLM is a next-token predictor. It writes code for surfaces it hasn't probed, ...
-(lines 25-49)
+Read the code, tests, and config around the surface being specified so the spec names real files, existing helpers, and constraints rather than guesses. (The Q7 reconnaissance checklist for builders lives in `agents/builder-guidance.md`.)
```

### H5. specflow-writer.md:84-91 — origin-project paths and personas

```diff
 ### Step 1: Understand the Domain
-1. Read relevant product docs in `docs/product/`, `docs/PTO.md`, `docs/meetings/`
-2. Read existing code in `src/` related to the feature (components, hooks, repositories)
-3. Read database schema from `supabase/migrations/` for relevant tables
-4. Read existing GitHub issues for related epics, invariants, or prior art
-5. Identify actors/personas (Employee, Manager, Org Admin, Site Admin, Ops Admin, System)
-6. Identify the bounded context and adjacent features
-7. Check for existing invariant numbering (I-PTO-XXX, I-OPS-XXX, I-ADM-XXX) to continue the sequence
+1. Read the project's product docs and meeting notes.
+2. Read existing code for the feature (components, hooks, repositories).
+3. Read the schema and migrations directory for the relevant tables.
+4. Read existing GitHub issues for related epics, invariants, or prior art.
+5. Take personas, bounded contexts, and the invariant-prefix registry from the Domain Knowledge section below and continue its numbering.
```

Also delete line 202 (the second prefix list; the registry lives at 527-532).

### H6. specflow-writer.md:276-282 and 738-746 — trigger enumeration, twice

```diff
-After formatting the ticket (Step 9 above), you MUST invoke pre-flight-simulator before marking the ticket specflow-compliant. This applies to EVERY write AND edit trigger phrase:
-
-- "write this as a specflow ticket"
-- "update this ticket as a specflow ticket"
-- "edit this ticket as a specflow ticket"
-- "make this ticket specflow-compliant"
-- Any instruction that results in creating OR modifying a ticket body
+After formatting the ticket (Step 9 above), run pre-flight-simulator before marking the ticket specflow-compliant. This applies to every run that creates or modifies a ticket body, however the request is phrased.
```

```diff
-### Trigger phrases that invoke format-then-simulate
-
-ALL of the following trigger both steps — format AND simulate — in that order, every time:
-
-- "write this as a specflow ticket"
-- "update this ticket as a specflow ticket"
-- "edit this ticket as a specflow ticket"
-- "make this ticket specflow-compliant"
-- Any instruction that results in specflow-writer creating or modifying a ticket body
+(removed; stated once at Step 9a)
```

### H7. specflow-writer.md:9-21, 579-654, 656-669 — three required-output lists that disagree

Keep Step 10 (579-654) as the single "Required outputs" list, folding in the three items only the checklist has (index `version` bump; `total_contracts`/`total_journeys`; comment on the issue with journey ID and contract path). Replace 9-21 with:

> Every run produces the artifacts in Step 10, not just issue text. Contract rules live in `docs/contracts/*.yml`, because the verifier and CI read YAML, not markdown, so a ticket whose invariants exist only in the issue body is not compliant.

Remove 656-669. Change `src/__tests__/contracts/{name}_contract.test.ts` (617) to "the project's contract-test directory".

### H8. waves-controller.md:389-392, 700 and SKILL.md:73 — enum parse shouting

```diff
 4. After all ticket bodies are updated, parse `simulation_status` from each ticket's `## Pre-flight Findings` section:
-   - Read the line `**simulation_status:** [value]` — extract the value exactly as written
-   - **NO regex interpretation. NO fuzzy matching. Parse the enum value directly.**
-   - Valid enum values: `passed`, `passed_with_warnings`, `blocked`, `stale`, `override:[any text]`
+   - Read each ticket's `**simulation_status:**` line and compare the value exactly against the enum `passed | passed_with_warnings | blocked | stale | override:<text>`. Any other value counts as `blocked`, so a malformed section can never pass the gate.
```

Delete waves-controller.md:700 (`  - Parse enum directly — no regex, no interpretation`). SKILL.md:73 becomes: `Any value outside this enum is treated as blocked by waves-controller.`

### H9. journey-tester.md:27 and :182

```diff
-**CRITICAL: Always check for existing journey contracts before defining from scratch.**
+Check the issue for an existing journey contract first (the `gh` commands below); define one from the verbal description only when none exists.
```

```diff
-      await expect(page.getByTestId('product-card')).toHaveCount.greaterThan(0)
+      await expect(page.getByTestId('product-card').first()).toBeVisible()
```

### H10. Loop prompts vs loop-selector — one stop rule

Decision required first. If "continue through unblocked stages" wins (the newer text), apply to `spec-build.prompt.md`, `feature-build.prompt.md`, `daily-use-teardown.prompt.md`:

```diff
-3. Advance exactly ONE gate; persist the result to those artifacts (never only to chat).
+3. Advance through every gate that is unblocked this tick; persist each result to those artifacts (never only to chat). Stop only where the path says: a hard gate needing human input, a `never_without_human` action, missing input or evidence, or an external wait.
```

and drop `spec-build.prompt.md:17` "Stop after that gate." If one-gate-per-tick wins, rewrite `skills/specflow-loop-selector/SKILL.md:74,78` instead.

### H11–H14. Code extractions and merge (replacement text in tables; each is its own ticket)

- H11 `scripts/board-audit.cjs` replaces board-auditor Steps 1–3 and 2b.
- H12 `scripts/fix-patterns.cjs` replaces heal-loop confidence arithmetic (also closes the 0.70–0.75 gap).
- H13 `scripts/wave-priority.cjs` replaces waves-controller:269-276 scoring.
- H14 Delete `agents/sprint-executor.md`; fold :41-64 and :111-121 into waves-controller; update nine references.

## Verification plan (Step 7)

1. Take H1, H2, H9 first: mechanical, no behaviour to probe beyond a smoke run of pre-flight-simulator on one ticket.
2. Probe H4–H7 by running specflow-writer on one real story before and after on a scratch branch; compare the produced artifact set against Step 10.
3. H10 is a decision, then a one-line edit; probe with one `specflow run spec-build` tick.
4. H11–H14 are tickets with tests; the contract suite (`npm test -- contracts`) must stay green.
5. Bump the routing template to `claude-fable-5-1` only after 1–3 land.
6. Regenerate `scripts/agents/` from `agents/` after edits; it has already diverged.
