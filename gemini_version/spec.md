# Feature: chat2repo

## Overview

Chrome extension (MV3) to send selected text or ChatGPT messages to a GitHub repo as Markdown notes with YAML front-matter.

---

## REQS

### ARCH-001 (MUST)
The codebase MUST use strict layering: `core` package (pure TypeScript, no browser APIs) and `extension` package (Chrome MV3 specific code).

Enforcement:
- `packages/core/` must not import from `chrome.*`, `browser.*`, or any WebExtension APIs
- `packages/extension/` may import from `packages/core/`

### ARCH-002 (MUST)
GitHub API calls MUST only be made from the background service worker. Content scripts and popup MUST NOT make direct GitHub API calls.

Enforcement:
- Files in `content/` and `popup/` must not contain `api.github.com` or `GitHubClient`
- Only `background/` may instantiate or call `GitHubClient`

### ARCH-003 (MUST)
Source files MUST be under 200 lines. Functions MUST be under 80 lines.

Enforcement:
- Automated check for line counts
- Extract helpers if limits exceeded

### SEC-001 (MUST)
GitHub PAT MUST be stored in `chrome.storage.local` and accessible only from the background service worker.

Enforcement:
- PAT must never appear in content script code
- PAT must never be passed in messages to content scripts
- PAT must never be logged

### SEC-002 (MUST)
GitHub PAT MUST never be exposed to content scripts, injected into web pages, or logged.

Enforcement:
- No `console.log` containing token/pat/secret in any file
- Content scripts must not receive PAT in any message payload

### SEC-003 (MUST)
Extension host_permissions MUST be limited to: `https://chatgpt.com/*`, `https://chat.openai.com/*`, `https://api.github.com/*`. No `<all_urls>` unless explicitly documented.

Enforcement:
- manifest.json host_permissions must match exactly
- Any addition requires documented justification

### MV3-001 (MUST)
Background script MUST be a service worker (MV3). No persistent background pages.

Enforcement:
- manifest.json must have `"type": "module"` in background
- No `"persistent": true`

### MV3-002 (MUST)
Background operations MUST be short-lived and stateless (beyond chrome.storage). No long-lived polling or timers.

Enforcement:
- No `setInterval` in background scripts
- No global mutable state that persists between wake-ups

### MD-001 (MUST)
Every note MUST have YAML front-matter with these required fields: `source`, `captured_at`, `tags`.

Enforcement:
- `tags` is always an array (can be empty)
- `source` is one of: `chatgpt`, `web`, `other`
- `captured_at` is ISO UTC format

### MD-002 (MUST)
YAML front-matter schema is stable. New fields MUST be additive and MUST NOT break existing notes or tools.

Enforcement:
- Required fields cannot be removed
- Field types cannot change

### MD-003 (MUST)
The `tags` field MUST always be present and MUST always be an array.

Enforcement:
- markdownBuilder must always output tags array
- Empty array `[]` is valid, missing field is not

### UX-001 (MUST)
If user attempts capture without PAT or repo configured, show toast with message and "Open settings" action. Do NOT show a modal pretending it will work.

Enforcement:
- No GitHub API calls if configuration missing
- Toast must include settings link

### UX-002 (MUST)
Quick send (1-click) MUST NOT show a modal. Only toast feedback.

Enforcement:
- Quick send code path must not trigger modal render

### UX-003 (MUST)
ChatGPT content script MUST only inject buttons on assistant messages, not user messages.

Enforcement:
- DOM selector must filter for assistant role

### ERR-001 (MUST)
GitHub errors (403 rate limit, 5xx) MUST show user-friendly toast without exposing PAT or sensitive details.

Enforcement:
- Error messages must not contain token
- Error messages must be actionable

### ERR-002 (MUST)
If ChatGPT DOM parsing fails (returns null/empty), show fallback toast suggesting text selection. Do NOT attempt to send empty content.

Enforcement:
- Null check before capture
- No API calls with empty content

---

## REQS (SHOULD)

### ARCH-010 (SHOULD)
Consider extracting reusable GitHub client to separate package for CLI/server reuse.

### UX-010 (SHOULD)
Toast should include "Open in GitHub" link on success.

### UX-011 (SHOULD)
Support multiple repo configurations with labels for easy selection.

---

## JOURNEYS

### J-CHATGPT-QUICKSEND

ChatGPT message quick send (configured user):
1. User opens ChatGPT conversation page
2. User hovers over assistant message
3. User clicks "Send to repo" button
4. System sends to GitHub using saved defaults (no modal)
5. Toast appears with success message and "Open" link
6. File exists in repo at `basePath/YYYY/MM/DD/<slug>.md`
7. Front-matter has `source: chatgpt`, correct `captured_at`, `tags` array

### J-CHATGPT-DETAILED

ChatGPT first-time detailed send:
1. Fresh install, PAT and repo just configured
2. User clicks "Send to repo" on assistant message
3. Modal appears with repo dropdown, auto-filled topic, tags with `chatgpt`
4. User edits topic and adds tags
5. User ticks "Don't ask again"
6. User clicks Save
7. Modal closes, toast shows success
8. File created with edited topic and combined tags
9. Next click triggers quick send (no modal)

### J-WEB-QUICKSEND

Web page selection quick send:
1. User on arbitrary web page
2. User selects text
3. User right-clicks, selects "Quick send to GitHub"
4. Toast appears with success
5. File created with `source: web`, selected text as body

### J-WEB-DETAILED

Web selection with tags (detailed):
1. User selects text on web page
2. User right-clicks, selects "Send to GitHub (with tags...)"
3. Modal appears with repo dropdown, topic, tags prefilled
4. User changes repo, edits topic, adds tags
5. User clicks Save
6. File created in selected repo with edited metadata

### J-ERROR-NOCONFIG

Missing configuration error:
1. Extension installed but no PAT configured
2. User tries to capture (ChatGPT or web)
3. Toast: "GitHub is not configured. Open extension options..."
4. "Open settings" button/link shown
5. No network calls made
6. No file created

### J-ERROR-RATELIMIT

GitHub rate limit error:
1. Extension configured
2. User triggers capture
3. GitHub returns 403 rate limit
4. Toast: "Couldn't save to GitHub: rate limit reached. Try again later."
5. No partial files created
6. PAT not exposed in error

### J-ERROR-DOMFAIL

ChatGPT DOM change fallback:
1. ChatGPT DOM changed, parser fails
2. User clicks "Send to repo"
3. `getMessageContent` returns null/empty
4. Toast: "Couldn't detect message content. Select text and use Quick send instead."
5. No file created

### J-PREFERENCES

"Don't ask again" preference:
1. User previously ticked "Don't ask again" in modal
2. User clicks "Send to repo" on new message
3. No modal, quick send with saved defaults
4. User changes defaults in options
5. Next capture uses updated defaults

---

## Changelog

### 2025-12-03 - v1
- Initial spec from chat2repo-spec.md and journeys.md
- 16 MUST requirements, 3 SHOULD guidelines
- 8 user journeys defined
