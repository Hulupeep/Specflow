---
description: Identify the installed Specflow package and declared native components without changing project state
allowed-tools: Read
---

Read these installed files with the Read tool:

- `${CLAUDE_PLUGIN_ROOT}/package.json`
- `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`
- `${CLAUDE_PLUGIN_ROOT}/scripts/vendor/manifest.json`

Report the observed package name/version, native commands and agent count, and bundled dependency versions. Framework assets belong to `${CLAUDE_PLUGIN_ROOT}`; the project context is `${CLAUDE_PROJECT_DIR}`. Keep those roots distinct.

This command reports installed identity and metadata. It does not verify a feature, pass a gate, grant release authority or establish publication/customer validity. Full workflow commands and owning hooks remain under qualification. Use Read only; do not run a shell, modify files, call another model, contact anyone or copy credentials.
