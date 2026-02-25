---
name: readme-audit
description: Flow audit a README for a defined target reader and terminal action
version: 1.0.0
invoke: /readme-audit
---

# README Audit Skill

Audits a README's reading flow by treating it as a conversion funnel. Every section is
evaluated against a target reader and a terminal action. Produces a structured audit
that feeds directly into `/readme-restructure`.

## When Activated

Run this skill when:
- A README is too long and readers get lost
- A document serves multiple audiences without clarity on who reads what
- The install/setup is buried or repeated
- Sections feel like they were added over time without a through-line

## Required Inputs

Before auditing, establish three things (ask if not provided):

1. **Target reader(s)** — who arrives at the document?
   - If there are two reader types, identify the conversion event (e.g. "evaluator becomes implementor")
   - Name the mental state of each reader type at entry
2. **Terminal action** — what should the reader be able to DO after reading?
   - Must be concrete: not "understand Specflow" but "have installed hooks and committed with contracts enforcing"
3. **README path** — which file to audit

## Process

### Step 1: Map the Document

Read the entire README. Create a section inventory with:
- Section title
- Line range
- One-sentence description of content

Note: flag any sections that appear to duplicate content from elsewhere in the document.

### Step 2: Audit Each Section

For every section, produce a row in the audit table:

| # | Section | Lines | Reader Q Answered | Mental State IN → OUT | Content | Flow | Classification |
|---|---------|-------|------------------|-----------------------|---------|------|----------------|

**Reader Q Answered**: What question is the reader asking when they arrive at this section?
If the section answers a question the reader hasn't asked yet, it's mispositioned.

**Mental State IN → OUT**: Short phrase. E.g. "curious → convinced" or "ready to install → confused by options"

**Content rating** (0.0–1.0): Is the content correct, appropriate density, right detail level for this reader at this moment?

**Flow rating** (0.0–1.0): Does this section hand the reader off cleanly to the next? Does the reader know where to go next and why?

**Classification**:
- `KEEP` — earns its place, right location, right density
- `KEEP-SHORTEN` — right location but too long; trim to one line or one paragraph with link
- `PROMOTE` — good content, wrong location; becomes its own linked doc
- `PROMOTE-MERGE` — good content that should merge with another promoted section
- `REORDER` — right content, wrong position in the flow
- `CUT` — serves neither reader type at any position; accumulated without purpose
- `DUPLICATE` — repeats content from another section; one instance kept, rest cut

### Step 3: Identify the Conversion Moment

Mark the section that should be the conversion moment (the install command or first-action the reader takes). Everything before it serves the evaluator. Everything after it serves the implementor.

Rate whether the current document has a clear conversion moment or whether it's buried, repeated, or absent.

### Step 4: Produce the Restructure Blueprint

Output:

```
CONVERSION MOMENT: [section name] at line [N]
Currently: [buried / clear / absent / repeated N times]

EVALUATOR SECTION (before conversion):
  Keep: [list]
  Cut: [list]
  Reorder to: [sequence]

IMPLEMENTOR SECTION (after conversion):
  Keep: [list]
  Promote to separate docs: [list with suggested doc names]
  Cut: [list]

DOCS TO CREATE FROM EXISTING CONTENT:
  [doc-name.md] — sourced from: [section names] — reader: [implementor type]
  ...

DUPLICATE CONTENT FOUND:
  [description of duplicate + which instance to keep]

ESTIMATED README LENGTH AFTER RESTRUCTURE:
  Current: ~N lines
  Target:  ~N lines (evaluator + conversion + links only)
```

### Step 5: Rate the Overall Document

```
OVERALL FLOW RATING: [0.0–1.0]
CRITICAL FLOW BREAKS: [list the 3 worst points where a reader would exit]
PRIMARY STRUCTURAL PROBLEM: [one sentence]
```

## Output Format

Produce the full audit as a markdown document. Do not modify any files — this is read-only analysis.

If invoked as `/readme-audit` without arguments, ask for the three required inputs before proceeding.

## Example Rating Guidance

- **Content 0.9, Flow 0.3** = great information, wrong position — reader arrives before they care
- **Content 0.5, Flow 0.9** = weak information but it hands off cleanly — shorten it, keep it
- **Content 0.3, Flow 0.2** = candidate for CUT
- **Content 0.8, Flow 0.8** = KEEP as-is

Flow break signals:
- Reader is offered choices before they have enough context to choose
- Section answers a question the reader hasn't asked yet
- No clear "therefore..." connecting to the next section
- Section title implies one thing, content delivers another
- Duplicate of earlier content (reader wonders if they misread something)
