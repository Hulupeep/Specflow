# README Restructure

Execute a `/readme-audit` blueprint. Rewrites the README to the evaluator → conversion → links structure and creates linked docs by extracting and reorganising existing content.

**This skill modifies files.** Always run `/readme-audit` first and confirm the blueprint before running this.

## Before Starting

Confirm:
1. `/readme-audit` has been run and produced a blueprint (or paste one)
2. Which promoted sections map to existing docs vs need to be created
3. README path
4. Output directory for new docs (default: `docs/`)

## Process

### Step 1: Confirm Before Touching Files

Print a summary of planned changes and wait for user confirmation:

```
PLANNED CHANGES:
  README.md: ~[N] lines → ~[N] lines

  Creating [N] new docs:
    docs/[name].md — from [source sections]
    ...

  Sections being cut: [list]
  Sections being merged into: [list]

  Confirm? (yes to proceed)
```

### Step 2: Create the Extracted Docs

For each doc in the blueprint:
1. Read all source sections from the original README
2. Write a short intro (1–2 sentences) so the doc works standalone
3. Include all relevant content, removing internal duplication
4. Add a back-link to the README at the bottom
5. Write to the output directory using kebab-case filenames

Do NOT copy-paste sections raw. Synthesise so each doc reads coherently as a standalone document.

### Step 3: Rewrite the README

Target structure:

```markdown
# [Product Name]
[tagline]

[Evaluator content — max 3 sections, max 10 lines each]

---

## Get Started

[One install command or one clear action — the conversion moment]

---

## What do you need?

| I want to... | Go here |
|---|---|
| [path] | [link] |
...

---
[License]
```

Rules:
- Evaluator section: max 3 sections, max 10 lines each
- Conversion moment: single command or single clear action
- Links table covers ALL reader paths — no orphaned content
- Nothing appears in both the README and a linked doc
- No section requires prior product knowledge to understand

### Step 4: Update Indexes

If `agents/README.md` or `docs/README.md` exists, add entries for newly created docs. Add only — do not rewrite.

### Step 5: Report

```
RESTRUCTURE COMPLETE

README: [N] lines → [N] lines ([% reduction])

Docs created:
  docs/[name].md ([N] lines)
  ...

Sections cut: [list]
Sections merged into: [list]

Reading path:
  Evaluator: [section] → [section] → conversion
  Implementor: conversion → [doc] → [doc] → [doc]

Next: Review the new README and linked docs, then commit.
```

## Quality Checks Before Reporting Complete

1. No orphaned content — every old section is in new README, a linked doc, or explicitly cut
2. All links in the new README resolve to files that exist
3. Conversion moment visible within 30 seconds of opening the README
4. No content duplicated between README and linked docs
5. Each extracted doc reads coherently without the README as context
