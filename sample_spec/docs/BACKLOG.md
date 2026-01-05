# chat2repo Backlog

## In Progress

None

## Ready for Development

### FEAT-001: Extract hashtags from content as tags
**Priority:** High
**Effort:** Small (1-2 hours)

Users can include hashtags in their content like `#ideas #life #work` and we automatically extract them as tags.

**Example:**
```
User captures: "Here's my summary of the meeting #work #decisions #q4"
Result tags: ["chatgpt", "work", "decisions", "q4", ...defaultTags]
```

**Implementation:**
1. Add `extractHashtags(content: string): string[]` to `packages/core/`
2. Call it in `messageHandlers.ts` before building tags array
3. Dedupe with existing tags
4. Optionally: strip hashtags from saved content (configurable?)

**Regex:** `/#([a-zA-Z][a-zA-Z0-9_-]*)/g`

---

### FEAT-002: "Send to GitHub (with tags...)" context menu option
**Priority:** Medium
**Effort:** Large (4-6 hours)

Add second context menu item that opens a modal for customizing tags before save.

**From spec J-WEB-DETAILED:**
1. User selects text on web page
2. User right-clicks, selects "Send to GitHub (with tags...)"
3. Modal appears with repo dropdown, topic, tags prefilled
4. User changes repo, edits topic, adds tags
5. User clicks Save
6. File created in selected repo with edited metadata

**Requires:**
- New context menu item in `contextMenus.ts`
- Modal component (content script injection)
- Message handler for detailed capture

---

### FEAT-003: ChatGPT first-time modal flow
**Priority:** Medium
**Effort:** Large (4-6 hours)

First click on ChatGPT shows modal with options. "Don't ask again" enables quick-send.

**From spec J-CHATGPT-DETAILED:**
1. Fresh install, PAT and repo just configured
2. User clicks "Send to repo" on assistant message
3. Modal appears with repo dropdown, auto-filled topic, tags with `chatgpt`
4. User edits topic and adds tags
5. User ticks "Don't ask again"
6. User clicks Save
7. Next click triggers quick send (no modal)

**Shares modal component with FEAT-002**

---

## GitHub Actions (Teacher Pack)

### ACTION-001: Weekly Summary Email
**Priority:** High
**Effort:** Medium (2-3 hours)
**Persona:** Teachers

Every Sunday evening, send an email summarizing what the teacher saved that week.

**What it does:**
1. Runs on schedule (cron: `0 18 * * 0` - Sunday 6pm)
2. Scans for files created/modified in the last 7 days
3. Groups by tag (`#LessonPlan`, `#ExamQuestions`, `#Homework`, etc.)
4. Generates a friendly summary email

**Example output:**
```
Subject: Your Teaching Week - Dec 2-8

Hi Sarah,

This week you created:
• 3 Lesson Plans (#LessonPlan)
  - Macbeth Act 2 analysis (Year 10)
  - Poetry comparison intro (Year 9)
  - Creative writing workshop (Year 8)

• 5 Exam Questions (#ExamQuestions)
  - All filed in your question bank

• 1 Parent Email template (#ParentEmail)

Your teaching library now has 47 resources.
Keep building! 🎓

View your repo: [link]
```

**Implementation:**
- GitHub Action workflow file
- Script to scan repo and group by tags
- SendGrid or GitHub notification for email delivery
- Template for email formatting

---

### ACTION-002: Quote-Checker for Lesson Plans
**Priority:** High
**Effort:** Medium (3-4 hours)
**Persona:** Teachers

Automatically fact-check lesson plans to catch errors before students do.

**What it does:**
1. Triggers when a file with `#LessonPlan` tag is created/updated
2. Sends content to an AI with a narrow fact-checking prompt
3. Scans for: quotes, dates, names, historical claims, literary attributions
4. Adds a feedback block at the top of the file
5. Commits the updated file

**Example trigger:**
Teacher saves a lesson containing: "Joan of Arc led troops in Galway"

**Example output added to file:**
```markdown
---
quote_check: warning
checked_at: 2025-12-04T10:30:00Z
---

## ⚠️ Quote Check: 1 issue flagged

- ⚠️ "Joan of Arc led troops in Galway" — Joan of Arc was French and fought in France, never Ireland. Did you mean "Joan of Arc at Orléans" or a different historical figure?
- ✅ "Shakespeare wrote Macbeth around 1606" — correct.
- ✅ "The Battle of Hastings was in 1066" — correct.

---

[Original lesson content below...]
```

**Implementation:**
- GitHub Action workflow file
- Triggers on push to paths matching `**/*.md` with `#LessonPlan` in front-matter
- Uses OpenAI/Anthropic API for fact-checking (narrow prompt)
- Parses response and prepends feedback block
- Commits changes back to repo

**AI Prompt (narrow scope):**
```
You are a fact-checker for educational materials.

Scan this lesson plan and find:
1. Direct quotes attributed to people
2. Historical dates and events
3. Names of people, places, literary works
4. Factual claims about science, history, or literature

For each, respond with:
- ✅ if correct
- ⚠️ if possibly wrong, with explanation and suggested fix

Be conservative - only flag things that are clearly wrong or suspicious.
Do not rewrite the lesson. Just check facts.
```

---

## Ideas / Future

### FEAT-010: Multiple repo quick-switch
Allow cycling through repos from popup without opening settings.

### FEAT-011: Keyboard shortcut for capture
`Ctrl+Shift+S` or similar to capture selected text.

### FEAT-012: Capture history in popup
Show last 5-10 captures with links to GitHub files.

### FEAT-013: Obsidian/Logseq format options
Different front-matter formats for different note apps.

### FEAT-014: Auto-title from AI
Use first line or AI summary as topic instead of truncated content.

---

## Completed

- ✅ Basic extension with quick-send
- ✅ ChatGPT button injection
- ✅ Context menu for web pages
- ✅ Open Repo button in popup
- ✅ Improved settings UX with tooltips
