# Specflow User Prompt Template

Copy and customize this prompt when asking an LLM to implement a feature using Specflow.

---

## PROMPT TEMPLATE

```
I want to build [FEATURE NAME]. Here's the problem and requirements:

## Problem
[Describe the problem you're solving. Be specific about pain points.]

## My Requirements (plain English)

1. [First requirement - what MUST happen]
2. [Second requirement - what MUST happen]
3. [Third requirement - what MUST happen]
4. [Optional: what SHOULD happen but isn't critical]

## User Journeys I Need

### Journey 1: [Name]
- [Step 1]
- [Step 2]
- [Step 3]
- Expected result: [What user should see]

### Journey 2: [Name]
- [Step 1]
- [Step 2]
- Expected result: [What user should see]

---

**INSTRUCTIONS TO LLM:**

Use the Specflow methodology. Follow these steps exactly:

1. Read LLM-MASTER-PROMPT.md for your workflow
2. Convert my requirements into SPEC-FORMAT.md with REQ IDs ([PREFIX]-001, [PREFIX]-002)
3. Generate contracts using CONTRACT-SCHEMA.md with forbidden/required patterns
4. Generate tests that reference the REQ IDs
5. Implement the feature following the contracts
6. Run tests and report DOD status
7. Create/update CLAUDE.md for future LLM sessions

**Show me each output file before proceeding to the next step.**

Critical journeys that must pass before release:
- [Journey 1 name]
- [Journey 2 name]
```

---

## EXAMPLE: Bill Splitting App

```
I want to build a fair bill splitting calculator.

## Problem
People order $18 meals but get charged $60 when friends order $45 steaks
and everyone "splits evenly." This causes awkwardness and resentment.

## My Requirements (plain English)

1. Each person must only pay for what they ordered
2. If people share an appetizer, only those people split it - not everyone
3. Tip should be proportional to what each person spent
4. Show a clear breakdown so everyone sees what they owe
5. Round to cents properly - no floating point errors

## User Journeys I Need

### Journey 1: Quick 2-person split
- Open app, see 2 person tabs
- Add $18 pasta to Person 1
- Add $45 steak to Person 2
- Set 20% tip
- Expected: Person 1 = $21.60, Person 2 = $54.00, Total = $75.60

### Journey 2: Shared appetizer
- Open app
- Add $15 nachos shared between Person 1 and 2
- Add $12 burger to Person 1, $10 salad to Person 2
- Set 18% tip
- Expected: Person 1 = $23.01, Person 2 = $20.65

---

**INSTRUCTIONS TO LLM:**

Use Specflow. Follow these steps:

1. Read LLM-MASTER-PROMPT.md
2. Convert requirements to SPEC-FORMAT.md with SPLIT-001, SPLIT-002, etc.
3. Generate contracts with forbidden patterns (e.g., /splitEvenly/)
4. Generate tests referencing SPLIT-001, SPLIT-002
5. Implement calculator and UI
6. Run tests, report DOD status
7. Create CLAUDE.md

Show me each file before proceeding.

Critical journeys: Journey 1, Journey 2
```

---

## KEY POINTS

### What YOU (the user) provide:
- Plain English requirements
- User journeys with expected outcomes
- Which journeys are critical for release

### What the LLM does:
- Converts to spec format with REQ IDs
- Generates contract YAML with patterns
- Creates tests that enforce contracts
- Implements code that passes tests
- Creates CLAUDE.md for future sessions

### What CI enforces:
- Contract tests run on every PR
- Violations block merge
- Even if LLM ignores contracts, CI catches them

---

## VERIFICATION CHECKLIST

After LLM completes, verify:

- [ ] Spec has REQ IDs (SPLIT-001, SPLIT-002, etc.)
- [ ] Contracts have forbidden_patterns and/or required_patterns
- [ ] Tests output `CONTRACT VIOLATION: [REQ-ID]` on failure
- [ ] CLAUDE.md exists with contract section at top
- [ ] All critical journey tests pass
- [ ] DOD status reported as "ready for release"
