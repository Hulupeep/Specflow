-

# B. `journeys.md`

**(Canonical User Journeys & Acceptance Criteria)**

This document defines the **canonical journeys** that must always work. Use it for:

* Manual UAT.
* E2E test scenarios (e.g., Playwright).
* Regression checks after refactors.

Each journey describes:

* Context / setup.
* Steps.
* Expected result (including GitHub verification).

---

## Journey 1 – ChatGPT message quick send (post-setup)

### Context

* User has:

  * Installed the extension.
  * Configured PAT and at least one repo in options.
  * Used the detailed modal once and ticked:

    * `Don’t ask again, use these defaults for quick send`.
* There is an existing ChatGPT conversation with multiple assistant messages.

### Steps

1. Open ChatGPT conversation page (real or test fixture with similar DOM).
2. Hover over an assistant message.
3. Click the injected “Send to repo” icon/button.
4. Wait for completion.

### Expected UX results

* A small toast appears in-page (or browser notification):

  * Example:
    `Saved to colm/tab-notes: chat-notes/2025/12/02/autosave-regression.md [Open]`

* No modal appears (quick send flow).

### Expected repo results

* In the configured repo (e.g., `colm/tab-notes`), a new file exists under:

  * `chat-notes/YYYY/MM/DD/<slug>.md`

* File contents:

  * YAML front-matter:

    * `source: chatgpt`
    * `captured_at:` ~ current UTC time.
    * `url:` is the ChatGPT page URL.
    * `page_title:` or `page_context:` reflect the conversation.
    * `topic:` is derived from the first line of the message (truncated if needed).
    * `tags:` array includes at least:

      * `"chatgpt"`
      * Any default tags defined in options.

  * Body contains the assistant message content (text or markdown-equivalent).

---

## Journey 2 – ChatGPT message first-time detailed send

### Context

* Fresh install or cleared extension data.
* PAT and repo have just been configured in options.
* No “don’t ask again” preference saved yet.

### Steps

1. Open ChatGPT conversation.
2. Click “Send to repo” icon on an assistant message.
3. A modal appears for configuration of that capture.
4. Verify:

   * Repo dropdown has the configured repo selected by default.
   * `topic` is auto-filled from the first line of the message.
   * `tags` includes `chatgpt` and any default tags.
5. Edit `topic` and add a couple of tags.
6. Tick `Don’t ask again, use these defaults for quick send`.
7. Click `Save`.

### Expected UX results

* Modal closes after success.
* Toast shows success message with repo + path + “Open” link.

### Expected repo results

* File path and contents as per Journey 1, but:

  * `topic` matches edited value.
  * `tags` includes:

    * `"chatgpt"`
    * Any default tags.
    * The new tags added in the modal.

* Extension state:

  * Next time a “Send to repo” icon is clicked:

    * No modal (journey 1 behavior).
    * Quick send uses these defaults.

---

## Journey 3 – Web page selection quick send

### Context

* Extension configured (PAT + repo + defaults).
* User is on an arbitrary web page (test page recommended) with readable text.

### Steps

1. Navigate to `https://example.com/` (or a dedicated test page).
2. Select a paragraph of text.
3. Right-click to open the context menu.
4. Click `Quick send to GitHub`.
5. Wait for completion.

### Expected UX results

* Toast appears:

  * Example:
    `Saved to colm/tab-notes: chat-notes/2025/12/02/example-dot-com.md [Open]`

### Expected repo results

* File in default repo and path:

  * `chat-notes/YYYY/MM/DD/<slug>.md`

* Front-matter:

  * `source: web`
  * `url:` is the test page URL.
  * `page_title:` is the document title.
  * `tags:` includes `"web"` plus any default tags.

* Body text contains **only** the selected paragraph (not the entire page).

---

## Journey 4 – Web page selection with tags (detailed)

### Context

* Same as Journey 3, but user needs to tweak tags and topic.

### Steps

1. Select a paragraph on a test page.
2. Right-click → `Send to GitHub (with tags…)`.
3. Modal appears showing:

   * Repo dropdown.
   * Topic auto-filled from selected text.
   * `tags` pre-populated with `"web"` + defaults.
4. Change repo (if multiple configured).
5. Change `topic`.
6. Add multiple tags (`"research"`, `"ideas"`).
7. Click `Save`.

### Expected UX results

* Modal closes on success.
* Toast shows success message with chosen repo and path.

### Expected repo results

* File created in the selected repo under:

  * `[basePath]/YYYY/MM/DD/<slug>.md`

* Front-matter:

  * `source: web`
  * `tags` includes `"web"`, `"research"`, `"ideas"`, and any defaults.
  * `topic` matches the edited topic.

---

## Journey 5 – Missing configuration error handling

### Context

* Extension installed but **no PAT** configured yet.
* User tries to capture from ChatGPT or a web page.

### Steps

1. Without configuring options, open ChatGPT.
2. Click “Send to repo” on an assistant message **or**:
3. On any web page, select text and choose `Quick send to GitHub`.

### Expected UX results

* Toast appears:

  * `“GitHub is not configured. Open extension options to add your token and repo.”`
  * Button/link: `Open settings`.

* No further UI appears (no modal that pretends it will work).

### Expected behavior

* No network calls to GitHub.
* No file is created.
* Once PAT and repo are configured, the same action should succeed (see Journey 1/3).

---

## Journey 6 – GitHub error / rate limit

### Context

* Extension configured with a valid PAT and repo.
* Simulate GitHub returning an error (can use a test server or trick to hit rate limit, or stub in tests).

### Steps

1. Trigger a capture (ChatGPT or web selection).
2. Ensure that the GitHub API returns:

   * Either 403 with rate-limit headers, or
   * 5xx error.

### Expected UX results

* Toast appears with a short, friendly message, e.g.:

  * Rate limit:
    `“Couldn’t save to GitHub: rate limit reached. Try again later.”`
  * Network/server error:
    `“Couldn’t save to GitHub due to a network error. Please try again soon.”`

* Optional: `View details` link opens a small log view in the extension or console output (for dev), **without** showing the PAT.

### Expected repo results

* No incomplete or partial files created.
* Errors are logged in a way that helps debugging without leaking secrets.

---

## Journey 7 – DOM change fallback (ChatGPT fails gracefully)

### Context

* Simulate a change in ChatGPT DOM such that `chatgptDom.ts` fails to parse message content cleanly (e.g., tests use a modified HTML fixture).

### Steps

1. Load the modified ChatGPT-like fixture page.
2. Click “Send to repo” on an assistant message (icon still inserted or simulated).
3. Ensure `getMessageContent` returns `null`/empty.

### Expected UX results

* Toast:

  * `“Couldn’t detect message content. Select the text and use ‘Quick send to GitHub’ instead.”`

* No modal; no attempt to send corrupted or empty content.

### Expected repo results

* No file created.

---

## Journey 8 – “Don’t ask again” preference behavior

### Context

* User has used detailed modal once and ticked `Don’t ask again`.
* Preferences are stored in extension storage.

### Steps

1. Click “Send to repo” on a new assistant message (or use a fresh ChatGPT page).
2. Observe that:

   * No modal appears.
   * Quick send happens with previously-chosen defaults.
3. Open options page.
4. Change quick-send defaults (e.g., default tags).
5. Capture again.

### Expected UX results

* Initial quick send uses old defaults.
* After changing settings, the next quick send uses updated defaults.

### Expected repo results

* Files created before and after setting change show the correct tags/topic behavior according to defaults.

---
