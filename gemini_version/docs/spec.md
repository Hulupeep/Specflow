 
# A. `chat2repo-spec.md`

**(Spec + UX + Testing)**

## 1. Overview

**Working name:** `chat2repo`
**Goal:** From any web page (especially ChatGPT), send selected text or a specific ChatGPT message to a GitHub repo as a Markdown note with YAML front-matter. This should feel almost “fire-and-forget” once configured.

### Core capabilities

1. **Selection → Repo note**

   * User selects text anywhere.
   * Uses a context menu to:

     * Quickly send to GitHub using defaults, or
     * Send with tags/topic using a small form.

2. **ChatGPT message → Repo note**

   * On ChatGPT, each assistant message has a tiny “Send to repo” affordance.
   * First use can show a form; subsequent uses can be one-click with saved defaults.

3. **Configuration**

   * Extension options to configure:

     * GitHub PAT.
     * One or more repos (owner, name, branch, base path).
     * Defaults for tags, topic behavior, and “quick send” preferences.

---

## 2. Non-Negotiable Design Constraints

These are **hard rules** for any implementation (human or LLM).

### 2.1 Architecture invariants

1. **Strict layering**

   * `core` package: pure TypeScript (no browser APIs), holds:

     * Types
     * Markdown builder
     * Path builder
     * GitHub client (generic `fetch`)
   * `extension` package:

     * Background service worker (MV3)
     * Content scripts (ChatGPT integration)
     * Popup & Options UI
   * **No GitHub calls** from content scripts or popup. Only background.

2. **Secrets isolation**

   * GitHub PAT:

     * Stored in `chrome.storage.local`.
     * Accessible only in background.
     * Never exposed to content scripts or injected into web pages.
     * Never logged.

3. **Small, focused modules**

   * Aim for:

     * < 200 lines per file.
     * < 80 lines per function.
   * If the model produces something larger, refactor by extracting helpers.

4. **Stable Markdown format**

   * YAML front-matter schema is stable once defined.
   * New fields must be **additive** and not break existing notes or tools.

5. **MV3 compatibility**

   * No long-lived background polling or timers.
   * Background operations must be short-lived and stateless (beyond `chrome.storage`).

6. **Permissions hygiene**

   * `host_permissions`:

     * Only:

       * `https://chatgpt.com/*`
       * `https://chat.openai.com/*`
       * `https://api.github.com/*`
   * No `<all_urls>` unless explicitly justified and documented.

---

## 3. UX & Flow

### 3.1 High-level UX principles

* **Fast path first:** Common action = one click (once configured).
* **Detailed path exists but doesn’t block flow.**
* **Minimal UI injection:** Don’t clutter ChatGPT or pages.
* **Reliable feedback:** Every capture shows clear success or error.

### 3.2 UX States

#### 3.2.1 First-time state (unconfigured)

* If user tries to capture without PAT or repo configured:

  * Show a toast:
    `“Set up GitHub in the extension options before sending notes.”`
  * Provide a button/link: `Open settings`.
* Options page guides them to:

  * Paste PAT.
  * Add at least one repo.
  * Choose a default repo and base path (e.g. `chat-notes`).

#### 3.2.2 Normal state (configured)

Two UX paths:

1. **Quick send (1-click)**

   * Context menu: `Quick send to GitHub`.
   * ChatGPT message button: one click if “don’t ask again” is enabled.
   * Uses:

     * Last used repo for that source (ChatGPT vs web).
     * Auto topic = first 80 chars of content (cleaned).
     * Tags:

       * Always includes: `["chatgpt"]` or `["web"]`.
       * Optional default tags from settings.
   * UI:

     * No modal.
     * Show toast:

       * Success:
         `“Saved to colm/tab-notes: chat-notes/2025/12/02/autosave-regression.md”`

         * link “Open in GitHub”.
       * Error: short explanation, with option to see details.

2. **Detailed send (with tweaks)**

   * Context menu: `Send to GitHub (with tags…)`.
   * ChatGPT message button (first time) will open this too.
   * In-page or popup modal contains:

     * Repo dropdown (label + owner/repo).
     * Topic (prefilled, editable).
     * Tags:

       * Text field with chips OR simple comma-separated input.
       * Pre-populated with source tag (`chatgpt`/`web`) + defaults.
     * Checkbox: `[] Don’t ask again, use these defaults for quick send`.
   * Buttons:

     * `Save` (perform capture).
     * `Cancel`.

### 3.3 Context Menu UX

* Contexts: `["selection"]`.
* Menu entries:

  * `Quick send to GitHub`
  * Separator
  * `Send to GitHub (with tags…)`

Behavior:

* If extension not configured → show “configure first” toast.
* If configured:

  * Quick send: direct capture with defaults.
  * With tags: open detailed modal (selection text prefilled in preview).

### 3.4 ChatGPT UX

* Content script injects a **small icon button** on assistant messages only.

* Icon style:

  * Small, discreet (e.g., a tiny repo or “save” icon).
  * Tooltip: “Send to repo”.

* Behavior:

  * First click:

    * Open detailed modal (as above).
    * Allow “Don’t ask again”.
  * After “Don’t ask again”:

    * One-click quick send with saved defaults.
    * Toast feedback as usual.

* Fail-safe:

  * If the message DOM can’t be parsed reliably:

    * Show toast:
      `“Couldn’t detect message content. Select the text and use ‘Quick send to GitHub’ instead.”`

---

## 4. Data Model & Markdown Format

### 4.1 Types (`packages/core/src/types.ts`)

```ts
export type SourceType = "chatgpt" | "web" | "other";

export interface GitHubRepoConfig {
  id: string;             // uuid
  label: string;          // "TabStax Notes"
  owner: string;          // "colmbyrne"
  repo: string;           // "tabstax"
  defaultBranch: string;  // "main"
  basePath: string;       // "chat-notes"
}

export interface CaptureMetadata {
  source: SourceType;
  capturedAt: string;     // ISO UTC string
  sourceUrl?: string;
  sourceTitle?: string;
  pageContext?: string;   // e.g. Chat title, partial breadcrumbs
  repoLabel?: string;
}

export interface CaptureRequest {
  repoId: string;
  content: string;        // plain text or markdown snippet
  topic: string;
  tags: string[];         // must always be an array
  metadata: CaptureMetadata;
}

export interface FileDescriptor {
  path: string;           // "chat-notes/2025/12/02/topic-slug-xyz.md"
  commitMessage: string;
  body: string;           // final markdown with front-matter + content
}

export interface CaptureResult {
  htmlUrl: string;        // GitHub URL
  path: string;
}
```

### 4.2 Front-matter format (stable contract)

Every note:

```md
---
source: chatgpt
captured_at: 2025-12-02T12:34:56Z
url: "https://chatgpt.com/c/..."
page_title: "TabStax autosave debugging"
page_context: "Conversation: Cardano sync refactor"
repo_label: "TabStax Notes"
topic: "Autosave regression strategy"
tags:
  - chatgpt
  - tabstax
  - autosave
  - architecture
---

<markdown content here>
```

Rules:

* `tags` is **always** present and is always an array (can be empty).
* `source` ∈ `["chatgpt","web","other"]`.
* `captured_at` is ISO UTC.

---

## 5. Architecture

### 5.1 Monorepo layout

```txt
/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json

  /packages
    /core        // pure TS, no browser APIs
    /extension   // Chrome MV3 extension
    /cli         // (future) Node CLI
    /server      // (future) backend for OAuth/GitHub App
```

### 5.2 `packages/core`

**Responsibilities:**

* Types & interfaces.
* Path generation.
* Front-matter and markdown body construction.
* GitHub client (generic `fetch`).
* A `CaptureOrchestrator` that glues builder + GitHub client (for easy testing).

**Modules:**

* `src/types.ts` – types above.

* `src/pathUtils.ts` – create note path:

  ```ts
  export function createNotePath(
    basePath: string,
    topic: string,
    capturedAt: string
  ): string;
  ```

* `src/markdownBuilder.ts` – build `FileDescriptor` from `CaptureRequest` + `GitHubRepoConfig`.

* `src/githubClient.ts` – class:

  ```ts
  class GitHubClient {
    constructor(private token: string) {}

    async createFile(
      config: GitHubRepoConfig,
      file: FileDescriptor
    ): Promise<CaptureResult>;
  }
  ```

  * Handles:

    * `409` (file exists) → try `-1`, `-2`, up to N.
    * `403`/rate limit → throw descriptive error.
    * `5xx` → one simple retry, then throw.

* `src/captureOrchestrator.ts` – orchestrates:

  ```ts
  interface CaptureDependencies {
    findRepoConfig(repoId: string): Promise<GitHubRepoConfig | undefined>;
    githubClientFactory(): GitHubClient;
  }

  export class CaptureOrchestrator {
    constructor(private deps: CaptureDependencies) {}

    async performCapture(request: CaptureRequest): Promise<CaptureResult>;
  }
  ```

* `src/index.ts` – re-exports.

### 5.3 `packages/extension`

**Structure:**

```txt
/packages/extension/src
  manifest.json

  background/
    index.ts
    messageHandlers.ts
    contextMenus.ts
    githubService.ts
    storage.ts

  content/
    chatgptContentScript.ts
    chatgptDom.ts
    ui/
      captureModal.tsx
      modalRoot.ts
      toast.tsx

  popup/
    Popup.tsx

  options/
    OptionsPage.tsx

  shared/
    messages.ts
    types.ts      // thin wrappers that reference core types
```

#### Background

* Creates context menus on install.

* Handles messages:

  * `get-repo-configs`
  * `perform-capture` (delegates to `CaptureOrchestrator`).
  * `quick-capture-selection` (constructs `CaptureRequest` from selection metadata).
  * `quick-capture-chatgpt-message`.

* Reads/writes `chrome.storage.local` via small `storage.ts` module.

#### Content script (ChatGPT)

* `chatgptDom.ts`:

  * Centralizes DOM selectors and heuristics.
  * Exposes:

    * `findAssistantMessages()`.
    * `getMessageContent(messageElement): string`.
* `chatgptContentScript.ts`:

  * Observes DOM for new messages.
  * Injects button into each assistant message header/footer.
  * Listens for button clicks.
  * On click:

    * Extracts content.
    * Sends message to background to either:

      * Open detailed modal, or
      * Perform quick send using saved defaults.

#### Modal / UI

* Modal is rendered by content script in-page using React.
* Background and content script coordinate via messages:

  * Background provides repo list + defaults.
  * Content script collects user choices, sends back `CaptureRequest`.

---

## 6. TDD & Testing Strategy

### 6.1 Test layers

1. **Unit tests (core):**

   * `markdownBuilder.test.ts`
   * `pathUtils.test.ts`
   * `captureOrchestrator.test.ts`
   * `githubClient.test.ts` (with mocked `fetch`)

2. **Integration tests (extension logic with mocked Chrome APIs):**

   * `background/messageHandlers.test.ts`
   * `background/contextMenus.test.ts`

3. **End-to-end journey tests (Playwright or Puppeteer):**

   * With a test GitHub repo and PAT.
   * Covers key user journeys from `journeys.md`.

### 6.2 London TDD style

For core:

1. Write failing tests for `CaptureOrchestrator.performCapture`:

   * Valid flow calls markdown builder + GitHub client.
   * Missing PAT / repo config throws typed errors.
   * 409 conflict triggers path adjustment and retry.

2. Implement orchestrator using mocked dependencies.

3. Then implement `markdownBuilder`, `pathUtils`, `githubClient` separately, with their own tests.

### 6.3 Unit test expectations

**`markdownBuilder`:**

* Generates front-matter with required keys.
* Always includes `tags`.
* Slugifies `topic` safely.
* Uses `capturedAt` for date-based path.
* Handles Unicode and special characters.

**`githubClient`:**

* For 201 Created:

  * Returns correct `CaptureResult` (path + htmlUrl from GitHub).
* For 409:

  * Retries with suffixed filename.
* For 403 with rate limit headers:

  * Throws specific error type like `RateLimitError`.
* For 5xx:

  * Retries once; if fails, throws `GitHubError`.

### 6.4 Integration tests (background)

* `perform-capture` handler:

  * With valid data and config:

    * Reads PAT & repo configs from storage.
    * Calls orchestrator.
    * Returns success payload.

  * No PAT:

    * Returns error with message: “GitHub token not configured.”

  * Missing repo:

    * Returns error: “Repository configuration not found.”

### 6.5 Journey tests

See `journeys.md` for concrete flows.

At minimum, set up Playwright tests to:

* Load a test page mimicking ChatGPT.
* Install the extension.
* Interact with the injected button / context menu.
* Verify notes appear in test GitHub repo with correct front-matter.

---

## 7. Future Extensions (Design Hooks Only)

* `packages/cli`:

  * Use `core` to list notes from repo and pass them to LLMs for analysis.
* `packages/server`:

  * GitHub OAuth or App-based auth instead of PAT.
* Additional providers:

  * Notion, Obsidian, local files via backend pipeline.

The current design should not preclude any of these.

-- 

