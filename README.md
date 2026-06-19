# Aevumix Browser

**Aevumix** is an AI-first web browser built on the Firefox engine, featuring intelligent assistance that enhances your browsing experience with cutting-edge AI capabilities.

## ✨ AI Features

### 🤖 AI Chat Sidebar
A built-in AI assistant accessible from the sidebar that can:
- Answer questions about the current page
- Provide general knowledge answers
- Help with coding and writing
- Maintain conversation history
- Support multiple AI models (Default, Fast, Creative, Code)

### 📄 AI Page Summarizer
Instantly summarize any webpage with multiple modes:
- **Brief** - Quick one-paragraph summary
- **Detailed** - Comprehensive multi-paragraph summary
- **Bullets** - Key points as bullet list
- **Key Takeaways** - Most important insights

### 🔍 AI Smart Search
Enhanced URL bar with intelligent search:
- AI-powered search suggestions
- Natural language query detection
- Instant answers for questions
- Search history and caching
- Debounced input for performance

### ✍️ AI Writing Assistant
Right-click AI writing help in any text field:
- Grammar & spelling correction
- Tone adjustment (formal/casual)
- Text expansion and shortening
- Language simplification
- Writing continuation
- Selection translation

### 📑 AI Tab Organizer
Smart tab management powered by AI:
- Auto-group tabs by topic
- Duplicate tab detection
- Smart tab suggestions
- Color-coded tab groups
- Activity-based organization

### 🌐 AI Translator
Intelligent page translation:
- Auto-detect page language
- Full-page translation
- Selection translation via right-click
- 20+ supported languages
- Translation memory and caching
- Never-translate site list

## 🎨 Theme

Aevumix features a modern dark theme with:
- Indigo accent color (#6366f1)
- Smooth animations and transitions
- Clean, minimal UI
- Consistent design language

## 🏗️ Architecture

Aevumix is built as a Firefox fork using the Surfer build system:

```
src/browser/components/aevumix/
├── AevumixBrowser.sys.mjs        # Main controller
├── AIEngine.sys.mjs               # Core AI engine
├── AevumixChatSidebar.sys.mjs     # AI Chat
├── AevumixPageSummarizer.sys.mjs  # Page summarizer
├── AevumixSmartSearch.sys.mjs     # Smart search
├── AevumixWritingAssistant.sys.mjs # Writing assistant
├── AevumixTabOrganizer.sys.mjs    # Tab organizer
├── AevumixTranslator.sys.mjs      # Translator
└── icons/                         # SVG icons

src/browser/themes/shared/aevumix/
└── aevumix-ai.css                 # AI features theme

prefs/aevumix/
└── aevumix-ai.yaml                # All preferences
```

## ⚙️ Configuration

All features can be individually toggled via `about:config` preferences:

| Preference | Default | Description |
|---|---|---|
| `aevumix.ai.enabled` | `true` | Master AI toggle |
| `aevumix.ai.chat.enabled` | `true` | AI Chat Sidebar |
| `aevumix.ai.summarizer.enabled` | `true` | Page Summarizer |
| `aevumix.ai.search.enabled` | `true` | Smart Search |
| `aevumix.ai.writing.enabled` | `true` | Writing Assistant |
| `aevumix.ai.tabs.enabled` | `true` | Tab Organizer |
| `aevumix.ai.translate.enabled` | `true` | AI Translator |

## 🚀 Building

```bash
# Install dependencies
npm install

# Download Firefox source
npm run download

# Import patches
npm run import

# Bootstrap
npm run bootstrap

# Build
npm run build

# Run
npm run start
```

## 📝 License

This project is licensed under the MPL-2.0 License.

## 🌟 About

**Aevumix** — from Latin *aevum* (eternity) + *-ix* (tech suffix) — represents a timeless, powerful approach to browsing. Built with AI at its core, not as an afterthought.
<!--
   - This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/.
   -->
<!-- TODO: Get a job -->
<img src="./docs/assets/zen-dark.svg" width="100px" align="left">

### `Zen Browser`

[![Downloads](https://img.shields.io/github/downloads/zen-browser/desktop/total.svg)](https://github.com/zen-browser/desktop/releases)
[![Crowdin](https://badges.crowdin.net/zen-browser/localized.svg)](https://crowdin.com/project/zen-browser)
[![Zen Release builds](https://github.com/zen-browser/desktop/actions/workflows/build.yml/badge.svg?branch=stable)](https://github.com/zen-browser/desktop/actions/workflows/build.yml)

Zen is a firefox-based browser with the aim of pushing your productivity to a new level!

<div flex="true">
  <a href="https://zen-browser.app/download">
    Download
  </a>
  •
  <a href="https://zen-browser.app">
    Website
  </a>
  •
  <a href="https://docs.zen-browser.app">
    Documentation
  </a>
  •
  <a href="https://zen-browser.app/release-notes/latest">
    Release Notes
  </a>
</div>

### Firefox Versions

- [`Release`](https://zen-browser.app/download) - Is currently built using Firefox version `152.0.1`! 🚀
- [`Twilight`](https://zen-browser.app/download?twilight) - Is currently built using Firefox version `RC 152.0.1`!

### Contributing

If you'd like to report a bug, please do so on our [GitHub Issues page](https://github.com/zen-browser/desktop/issues/) and for feature requests, you can use [GitHub Discussions](https://github.com/zen-browser/desktop/discussions).

Zen is an open-source project, and we welcome contributions from the community! Please take a look at the [contribution guidelines](./docs/contribute.md) before getting started!

#### Partners

Thanks to all the partners of Zen for their support and contributions:

<a href="https://blacksmith.sh">
  <img src="./docs/assets/blacksmith-yellow.png" width="350px"/>
</a>
