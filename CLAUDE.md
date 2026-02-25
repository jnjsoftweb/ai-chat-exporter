# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Extension (Manifest V3) that exports AI chat conversations to Markdown files. Supports ChatGPT, Claude, Gemini, Google AI Studio, and Genspark.

Korean-language UI (popup, error messages, exported headers use Korean labels).

## Development Setup

No build system or package manager — plain JavaScript, loaded directly as an unpacked Chrome extension:
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this project folder
4. After code changes, click the refresh icon on the extension card and reload the target AI chat page

## Architecture

**Popup layer** (`popup.html` + `popup.js`): Extension popup UI with a single "download" button. Sends `extract_chat` message to the content script via `chrome.tabs.sendMessage`, receives `{ markdown, title }` back, and triggers a file download.

**Content script** (`content.js`): Injected into all supported AI chat sites. Core flow:
1. `extractChat()` — hostname-based router dispatching to per-site parsers (`parseClaude`, `parseChatGPT`, `parseGemini`, `parseAIStudio`, `parseGenspark`)
2. Each parser queries site-specific DOM selectors to find message elements, determines user vs AI role, and calls shared utilities
3. `convertToMarkdown(element)` — custom HTML-to-Markdown converter that clones DOM, strips UI elements (buttons, SVGs), processes `<pre>` code blocks with language detection, then recursively translates tags via `parseDOMToMarkdown()`
4. `formatTurn(author, content)` — wraps each message as `### Author` with `---` separator

**Key file**: `turndown.js` is a vendored copy of the Turndown library (not currently used in code paths, but bundled).

## Adding Support for a New AI Chat Site

1. Add the URL pattern to `manifest.json` in both `host_permissions` and `content_scripts.matches`
2. Add a new `parseXxx()` function in `content.js` following the existing pattern (query DOM for messages, classify user/AI, call `convertToMarkdown` + `formatTurn`)
3. Add the hostname check to the `extractChat()` router

## Important Patterns

- DOM selectors for each site are fragile and depend on the site's current HTML structure — they may need updating when sites change their markup
- The `convertToMarkdown` function uses a "wrapper climbing" heuristic to remove UI chrome around code blocks (climbs parent elements while text length stays within 50 chars of the code content)
- Message count validation: `extractChat()` throws if the result has fewer than 5 lines, to detect cases where selectors no longer match
