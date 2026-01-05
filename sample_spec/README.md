# chat2repo

Save ChatGPT conversations and web selections to your GitHub repository as organized markdown notes.

## The Problem

You've had an amazing conversation with ChatGPT. You've worked through a complex problem, gotten great explanations, or generated useful code. Then you close the tab, and it's gone. Sure, ChatGPT has history, but:

- It's hard to search
- It's not in your workflow
- You can't link to it from your notes
- You can't version control it
- It disappears when you clear history

**Your knowledge deserves a better home.**

## The Solution

chat2repo is a Chrome extension that lets you send any ChatGPT message (or any selected text on the web) directly to your GitHub repository with one click.

### What You Get

```markdown
---
source: chatgpt
captured_at: 2025-12-03T14:30:00Z
url: https://chatgpt.com/c/abc123
tags:
  - chatgpt
  - javascript
  - debugging
---

**How to debug async/await in Node.js**

Here's a step-by-step approach to debugging async code...
```

Files are automatically organized by date and topic:
```
your-repo/
└── chat-notes/
    └── 2025/
        └── 12/
            └── 03/
                ├── debugging-async-await.md
                ├── react-hooks-explanation.md
                └── python-data-structures.md
```

## Use Cases

### Developers
- Save code explanations and debugging sessions
- Build a personal knowledge base of programming concepts
- Archive solutions to problems you'll encounter again
- Keep a record of architectural decisions discussed with AI

### Researchers
- Capture research findings and AI-generated summaries
- Save reference material from web pages
- Build organized notes for papers and projects

### Writers
- Save inspiration and ideas from AI conversations
- Archive research material with proper metadata
- Build a searchable library of creative prompts

### Students
- Save study explanations in your own words
- Build a revision library organized by topic
- Archive problem-solving sessions

## Installation

### Chrome Web Store (Recommended)
1. Visit [chat2repo on Chrome Web Store](#) <!-- Link when published -->
2. Click "Add to Chrome"
3. Click the extension icon and open Settings
4. Add your GitHub PAT and repository

### Manual Installation (Development)
```bash
# Clone the repository
git clone https://github.com/floutlabs/chat2repo

# Install dependencies
cd chat2repo
npm install

# Build the extension
npm run build:extension

# In Chrome:
# 1. Go to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select packages/extension/dist
```

## How to Use

### Save from ChatGPT
1. Open any ChatGPT conversation
2. Hover over an assistant message
3. Click the paper airplane icon
4. Done - your note is saved to GitHub

### Save from Any Web Page
1. Select text on any web page
2. Right-click
3. Choose "Save to GitHub"
4. Done - captured with source URL

### Configuration
1. Click the extension icon
2. Go to Settings
3. Add your GitHub Personal Access Token
4. Add your repository (owner/repo)
5. Customize the base path (default: `chat-notes`)
6. Add default tags if desired

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Chrome)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Content      │  │ Popup        │  │ Options      │       │
│  │ Script       │  │              │  │ Page         │       │
│  │ (ChatGPT)    │  │              │  │              │       │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘       │
│         │                 │                                  │
│         │  chrome.runtime.sendMessage                        │
│         ▼                 ▼                                  │
│  ┌────────────────────────────────────────────┐             │
│  │         Background Service Worker          │             │
│  │  (Handles all GitHub API calls)            │             │
│  │  (Stores PAT securely)                     │             │
│  └─────────────────────┬──────────────────────┘             │
│                        │                                     │
└────────────────────────┼─────────────────────────────────────┘
                         │ HTTPS
                         ▼
              ┌──────────────────────┐
              │    GitHub API        │
              │   api.github.com     │
              └──────────────────────┘
```

### Package Structure

```
packages/
├── core/           # Pure TypeScript - NO browser APIs
│   ├── types.ts           # Shared types
│   ├── pathUtils.ts       # File path generation
│   ├── markdownBuilder.ts # Markdown with front-matter
│   ├── githubClient.ts    # GitHub API wrapper
│   └── captureOrchestrator.ts
│
└── extension/      # Chrome MV3 extension
    ├── manifest.json
    ├── background/     # Service worker (API calls here only)
    ├── content/        # ChatGPT integration
    ├── popup/          # Quick actions
    └── options/        # Settings page
```

## Contracts (What Must NOT Change)

This project uses **architectural contracts** - rules enforced by automated tests. These protect the stability of the extension and integrations that depend on it.

### Contract Summary

| ID | Rule | Why |
|----|------|-----|
| ARCH-001 | Core package has NO browser APIs | Keeps logic testable and portable |
| ARCH-002 | GitHub API calls ONLY from background | Security - PAT never in content scripts |
| SEC-001 | PAT stored in chrome.storage.local | Standard secure storage |
| SEC-002 | PAT never logged | Prevent accidental exposure |
| SEC-003 | Minimal host_permissions | Only chatgpt.com, api.github.com |
| MV3-001 | Background is service worker | Required for Manifest V3 |
| MD-001 | Front-matter has: source, captured_at, tags | Schema stability |
| MD-002 | Schema is additive only | No breaking changes |

### For Integration Developers

If you're building tools that read chat2repo notes, you can rely on:

```yaml
# Always present:
source: string        # "chatgpt" | "web" | "extension"
captured_at: string   # ISO 8601 timestamp
tags: array           # Always an array, may be empty

# May be present:
url: string           # Source URL
title: string         # Page title
```

### Checking Contracts

```bash
npm run test:contracts
```

All 11 contract tests must pass before merging.

## Extending chat2repo

### Adding New Capture Sources

1. Create a new content script in `packages/extension/src/content/`
2. Use `chrome.runtime.sendMessage` to send to background:
   ```typescript
   chrome.runtime.sendMessage({
     action: 'CAPTURE_TEXT',
     payload: {
       content: selectedText,
       source: 'your-source',
       url: window.location.href,
       title: document.title,
     }
   })
   ```
3. Add the source to manifest.json `content_scripts.matches`

### Adding Front-matter Fields

Per contract MD-002, you may ADD fields but never remove or change existing ones:

```typescript
// In markdownBuilder.ts, add to buildFrontMatter():
const frontMatter = {
  source: note.source,
  captured_at: note.capturedAt,
  url: note.url,
  tags: note.tags,
  // Add new fields here:
  author: note.author,  // New field - OK
  sentiment: note.sentiment,  // New field - OK
}
```

### Building a CLI

The `@chat2repo/core` package is pure TypeScript with no browser dependencies:

```typescript
import { GitHubClient, buildMarkdown, generatePath } from '@chat2repo/core'

const client = new GitHubClient(PAT)
const content = buildMarkdown({
  content: 'My note',
  source: 'cli',
  capturedAt: new Date().toISOString(),
  tags: ['cli', 'automation'],
})
const path = generatePath({ basePath: 'notes', source: 'cli' })

await client.createFile({
  owner: 'myuser',
  repo: 'my-notes',
  path,
  content,
  branch: 'main',
})
```

## Development

### Prerequisites
- Node.js 18+
- npm 9+
- Chrome browser

### Setup
```bash
npm install
```

### Commands
```bash
npm run build           # Build all packages
npm run build:extension # Build extension only
npm test                # Run all tests
npm run test:contracts  # Run contract tests only
npm run test:e2e        # Run E2E tests
```

### Testing Changes
1. Make your changes
2. Run `npm run build:extension`
3. Go to `chrome://extensions`
4. Click "Reload" on the extension
5. Test in ChatGPT

## Privacy

- **No servers** - We don't run any servers
- **No tracking** - No analytics, no telemetry
- **Local storage only** - Your PAT stays in YOUR browser
- **Direct to GitHub** - Content goes straight to your repo

See [Privacy Policy](packages/extension/PRIVACY_POLICY.md) for details.

## Support

- **Email**: support@floutlabs.com
- **Issues**: [GitHub Issues](https://github.com/floutlabs/chat2repo/issues)
- **Privacy concerns**: privacy@floutlabs.com

## License

MIT - See [LICENSE](LICENSE)

---

Made with care by [Flout Labs](https://floutlabs.com)
