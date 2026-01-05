# Changelog

All notable changes to chat2repo are documented here.

---

## [1.0.0] - 2025-12-04

### Initial Release

First public release of chat2repo Chrome extension.

**Core Features:**
- One-click capture from ChatGPT messages (paper airplane button)
- Right-click context menu to save any web selection to GitHub
- YAML front-matter with metadata (source, timestamp, URL, tags)
- Date-organized folder structure (`notes/2025/12/04/topic.md`)
- Multiple repository support

**Hashtag Extraction:**
- Automatically extracts hashtags from captured content
- Include `#tags` in your text and they become searchable metadata
- Filters out hex color codes to avoid false positives
- Works with ChatGPT prompts: "Summarize this #idea #project"

**Options Page:**
- Clear, beginner-friendly labels (Nickname, Folder for Notes)
- Info tooltips explaining each field
- Step-by-step setup guide for non-GitHub users
- Default tags configuration
- Tip box with link to tagging instructions
- Support & Legal section with correct issue reporting link

**Popup (Connected State):**
- Gear icon → opens Options page
- Subtitle: "Now your ideas live where your code lives"
- Status pill showing connection state
- Inline paper airplane icon in instructions
- Pro teaser banner with beta waitlist link
- Open Repo button
- Help & Docs link

**Architecture:**
- Chrome MV3 compliant (service worker, no persistent background)
- `packages/core` - Pure TypeScript, no browser APIs
- `packages/extension` - Chrome extension code
- Architectural contracts for LLM-safe development
- PAT stored locally, never exposed to content scripts

**Documentation:**
- Help site: https://hulupeep.github.io/chat2rep-help
- Installation guide (INSTALL.md)
- Usage guide (GUIDE.md)
- Tagging instructions (TAG_SET_UP.md)
- Pro features & beta waitlist (PRO.md)
- Privacy policy & Terms of service

---

## Recent Updates (Pre-release)

### Popup Improvements
- Added gear icon linking to Options page
- Added subtitle tagline
- Added Pro teaser banner with beta waitlist link
- Added inline paper airplane icon in instruction text
- Widened popup to 300px

### Options Page Improvements
- Renamed confusing labels (Base Path → Folder for Notes, Label → Nickname)
- Added info tip tooltips with explanations
- Added green tip box for hashtag feature
- Added "See tagging instructions" link to TAG_SET_UP.md
- Fixed "Report an Issue" link to correct GitHub URL

### Core Features
- Implemented hashtag extraction from content
- Added hex color filtering (prevents `#fff` from becoming a tag)
- Integrated hashtag extraction into quick capture flow

### Documentation
- Created PRO.md with full feature roadmap
- Added "Go Build This" hero feature description
- Added Idea Engine and Automatic Build feature lists
- Updated README with Pro teaser section
- Fixed all issue reporting links
