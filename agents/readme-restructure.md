---
name: readme-restructure
description: Execute a readme-audit blueprint — shorten the README and create linked docs from existing content
version: 1.0.0
invoke: /readme-restructure
---

# README Restructure Skill

Executes the output of `/readme-audit`. Takes the audit blueprint and:
1. Rewrites the README to the evaluator → conversion → links structure
2. Creates the linked docs by extracting and reorganising existing content

This skill MODIFIES FILES. Always run `/readme-audit` first and confirm the blueprint
before running this skill.

## When Activated

Run only after:
- `/readme-audit` has been run and produced a blueprint
- The user has reviewed and approved (or amended) the blueprint
- The user has confirmed which docs should be created vs linked to existing docs

## Required Inputs

1. **Audit blueprint** — output from `/readme-audit` (or confirm it was just run in this session)
2. **Docs that already exist** — which promoted sections map to existing docs vs need to be created
3. **README path** — file to rewrite
4. **Output directory for new docs** — where to write extracted docs (default: `docs/`)

If any input is missing, ask before proceeding.

## Process

### Step 1: Confirm the Blueprint

Before touching files, print a summary of planned changes:

```
PLANNED CHANGES:
  README.md: ~[N] lines → ~[N] lines

  Creating [N] new docs:
    docs/[name].md — from [source sections]
    ...

  Sections being cut: [list]
  Sections being merged: [list]

  Confirm? (user must say yes before Step 2)
```

### Step 2: Create the Extracted Docs

For each doc in the blueprint's "DOCS TO CREATE" list:

1. Read all source sections from the original README
2. Synthesise into a standalone doc:
   - Write a short intro (1–2 sentences) so the doc works without the README as context
   - Include all relevant content from the source sections
   - Remove duplication within the extracted content
   - Add a "Back to README" link at the bottom
3. Write to the specified output directory
4. Use kebab-case filenames: `getting-started.md`, `how-it-works.md`, etc.

Do NOT simply copy-paste sections. Synthesise: the extracted doc should read coherently
as a standalone document, not as a fragment of a larger README.

### Step 3: Rewrite the README

Structure the new README as:

```
# [Product Name]

[Evaluator content — 1–3 short sections max]

---

## Get Started

[One install command or one-liner action — the conversion moment]

---

## What do you need?

| I want to... | Go here |
|---|---|
| Understand if Specflow is right for me | [Should I use Specflow?](docs/...) |
| Install Specflow | [Installation guide](docs/...) |
| [other path] | [link] |

---

[License badge / brief credit if needed]
```

Rules for the rewritten README:
- Evaluator section: max 3 sections, each max 10 lines
- Conversion moment: must be a single command or a single clear action
- Links table: must cover all reader paths; no orphaned content
- No repeated content — if it's in a linked doc, it's not also in the README
- No section should require prior knowledge of the product to understand

### Step 4: Update Any Doc Indexes

If the repo has an `agents/README.md`, `docs/README.md`, or similar index file,
add entries for any newly created docs. Do not rewrite the index — add entries only.

### Step 5: Report

```
RESTRUCTURE COMPLETE

README: [N] lines → [N] lines ([% reduction])

Docs created:
  docs/[name].md ([N] lines, sourced from [sections])
  ...

Sections cut: [list]
Sections merged into: [list]

Reading path now:
  Evaluator: [section] → [section] → conversion
  Implementor: conversion → links to [doc list]

Next step: Review the new README and linked docs, then commit.
```

## Quality Checks Before Finishing

Run these checks on the rewritten README before reporting complete:

1. **No orphaned content** — every section in the old README is either in the new README, in a linked doc, or explicitly cut
2. **Links resolve** — every link in the new README points to a doc that exists (was just created or already existed)
3. **Conversion moment is visible** — a new reader can find the install command within 30 seconds of opening the README
4. **No duplication** — no content appears in both the README and a linked doc
5. **Docs are standalone** — each extracted doc reads coherently without the README as context

If any check fails, fix before reporting complete.
