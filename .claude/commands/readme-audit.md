# README Audit

Audit a README's reading flow by treating it as a conversion funnel. Every section is
evaluated against a target reader and a terminal action. Produces a structured audit
blueprint that feeds directly into `/readme-restructure`.

## Before Starting

Establish three things (ask if not provided):

1. **Target reader(s)** — who arrives at the document? If two types, identify the conversion event (e.g. "evaluator becomes implementor")
2. **Terminal action** — what should the reader be able to DO after reading? Must be concrete and specific.
3. **README path** — which file to audit

## Process

### Step 1: Map the Document

Read the entire README. Create a section inventory: title, line range, one-sentence description.
Flag any sections that duplicate content elsewhere in the document.

### Step 2: Audit Each Section

For every section, produce a row:

| # | Section | Lines | Reader Q Answered | Mental State IN → OUT | Content | Flow | Classification |
|---|---------|-------|------------------|-----------------------|---------|------|----------------|

**Reader Q Answered**: What question is the reader asking when they arrive here?
If it answers a question they haven't asked yet, it is mispositioned.

**Mental State IN → OUT**: Short phrase. E.g. "curious → convinced" or "ready to install → confused by options"

**Content** (0.0–1.0): Correct, appropriate density, right detail level for this reader at this moment?

**Flow** (0.0–1.0): Does this section hand the reader off cleanly to the next? Does the reader know where to go next and why?

**Classification**:
- `KEEP` — right content, right location, right density
- `KEEP-SHORTEN` — right location but too long; trim to one line with a link
- `PROMOTE` — good content, wrong location; becomes its own linked doc
- `PROMOTE-MERGE` — good content that should merge with another promoted section
- `REORDER` — right content, wrong position in the flow
- `CUT` — serves neither reader type at any position
- `DUPLICATE` — repeats another section; one instance kept, rest cut

### Step 3: Identify the Conversion Moment

Mark the section that is (or should be) the conversion moment — the first action the reader takes.
Everything before it serves the evaluator. Everything after it serves the implementor.
Rate whether the conversion moment is clear, buried, absent, or repeated.

### Step 4: Produce the Restructure Blueprint

```
CONVERSION MOMENT: [section name] at line [N]
Currently: [buried / clear / absent / repeated N times]

EVALUATOR SECTION (before conversion):
  Reorder to: [sequence of section names]
  Cut: [list]

IMPLEMENTOR SECTION (after conversion):
  Keep: [list]
  Promote to separate docs: [list with suggested doc names and source sections]
  Cut: [list]

DOCS TO CREATE FROM EXISTING CONTENT:
  [doc-name.md] — sourced from: [sections] — reader: [who]
  ...

DUPLICATE CONTENT FOUND:
  [description + which instance to keep]

ESTIMATED README LENGTH AFTER RESTRUCTURE:
  Current: ~N lines / Target: ~N lines
```

### Step 5: Overall Rating

```
OVERALL FLOW RATING: [0.0–1.0]
CRITICAL FLOW BREAKS: [top 3 points where a reader would exit, with line numbers]
PRIMARY STRUCTURAL PROBLEM: [one sentence]
```

## Rating Guidance

- Content 0.9, Flow 0.3 → great info, wrong position — REORDER or PROMOTE
- Content 0.5, Flow 0.9 → weak info but clean handoff — KEEP-SHORTEN
- Content 0.3, Flow 0.2 → CUT
- Content 0.8, Flow 0.8 → KEEP

Flow break signals:
- Reader offered choices before they have context to choose
- Section answers a question not yet asked
- No clear "therefore..." into the next section
- Duplicate of earlier content
