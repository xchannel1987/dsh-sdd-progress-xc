# dsh-sdd-progress-xc

[![npm version](https://img.shields.io/npm/v/dsh-sdd-progress-xc.svg)](https://www.npmjs.com/package/dsh-sdd-progress-xc)
[![license](https://img.shields.io/npm/l/dsh-sdd-progress-xc.svg)](https://github.com/xchannel1987/dsh-sdd-progress-xc/blob/main/LICENSE)
[![downloads](https://img.shields.io/npm/dm/dsh-sdd-progress-xc.svg)](https://www.npmjs.com/package/dsh-sdd-progress-xc)
[![DSH](https://img.shields.io/badge/DeepSeek-Harness-blue)](https://github.com/deepseek-ai/DeepSeek-Harness)

[中文](README.md) | [English](README_EN.md)

**DSH SDD Progress Plugin** — Displays Subagent-Driven Development task progress (todos) and progress ledger (progress.md) in the right sidebar, with real-time refresh and Markdown rendering.

## ✨ Core Features

### 📋 Task Progress (Tasks Tab)
- **Live stats**: Completed / in-progress / pending task counts
- **Status icons**: ✓ done / ⏳ in-progress / ○ pending
- **Auto-refresh**: 5-second polling reflects changes instantly
- **Session-bound**: Automatically associates todo data with the current session

### 📖 Progress Ledger (Ledger Tab)
- **Markdown rendering**: Uses DSH official `MarkdownText` — GFM / KaTeX math / code highlighting / copy buttons
- **Auto-location**: Extracts `sdd/progress.md` path from session content, no manual config
- **Root-agnostic**: Works with any directory layout
- **Safe rendering**: Raw HTML / relative links / dangerous protocols disabled (XSS protection)

### 🔄 Real-Time Refresh
- **Header refresh button**: Shared by Tasks and Ledger tabs
- **Auto-polling**: 5-second interval, zero manual effort
- **Manual override**: Click refresh for instant update

### 🎯 Session Binding
- **Auto-detect**: Locates requirement directory via path references in session content
- **Multi-requirement**: View different requirements in the same DSH instance
- **Session switch**: Auto-loads progress when switching sessions

### 📝 Markdown Rendering
- **Official component**: `@deepseek-ai/dsh-client-ui-primitives`'s `MarkdownText`
- **Full capability**: GFM / KaTeX / code highlighting + copy / footnotes
- **Streaming optimized**: Incremental parse, frozen stable blocks, tail-only re-parse
- **Security sandbox**: Built for untrusted content, XSS-safe by default

## 🔧 How It Works

```
User opens SDD Progress tab
    ↓
Client fetches /api/dsh-sdd-progress-xc/progress?sessionId=...
    ↓
Server reads session.v3.jsonl.zstd (multi-frame zstd)
    ↓
Parses session content:
  - Extracts cwd + sessionId
  - Extracts latest todo/write events
  - Scans path references, matches sdd/progress.md
    ↓
Returns { requirementName, todos, ledger }
    ↓
Client renders:
  - Tasks tab: stats + task list
  - Ledger tab: MarkdownText-rendered ledger
```

**Multi-frame zstd decoding**: DSH session logs are concatenated zstd frames; single-frame `zstdDecompressSync` only decodes the first frame. The plugin implements `scanZstdFrames` to scan frame boundaries and decompress frame-by-frame.

**Requirement extraction**: Regex matches `((?:drive-optional)?root/<name>/sdd/progress.md)` paths in session content, extracting `<name>` as requirement. Supports Windows (`D:\\workspace\\...`) and Unix paths.

## 📦 Installation

```bash
# Using DSH CLI
dsh plugin --profile web add dsh-sdd-progress-xc

# Or using npm
npm install dsh-sdd-progress-xc
```

Restart DSH after installation; an "SDD Progress" tab appears in the right sidebar.

## ⚙️ Configuration

| Option | Default | Description |
|--------|---------|-------------|
| requirementsRoot | '' (empty) | Optional fallback root for relative paths; usually unnecessary |

**Why no config by default?**  
The plugin extracts full paths directly from session content (e.g. `D:/workspace/requirements/aiAssistant/sdd/progress.md`), independent of any fixed root.

## 🎮 Usage

### View task progress
1. Open the right sidebar
2. Click "SDD Progress" tab
3. "Tasks" tab shows stats + list; click "Progress Ledger" for the ledger

### Refresh data
- **Auto**: 5-second polling
- **Manual**: Click "↻ Refresh" in the header

### Switch sessions
- SDD Progress auto-loads the current session's progress
- Each session is independent

## 🔒 Security Design

- **Markdown rendering**: Official `MarkdownText`, raw HTML / relative links / dangerous protocols disabled
- **Path extraction**: Session content only, no filesystem scanning
- **zstd decoding**: Frame-by-frame, skips corrupt frames without crashing

## 📄 License

[MIT](LICENSE)

## 🔗 Links

- [GitHub](https://github.com/xchannel1987/dsh-sdd-progress-xc)
- [npm](https://www.npmjs.com/package/dsh-sdd-progress-xc)
- [Issues](https://github.com/xchannel1987/dsh-sdd-progress-xc/issues)
