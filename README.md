# Scratchpad MCP v2

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-FTS5-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that provides shared scratchpad functionality for Claude Code sub-agents, enabling seamless context sharing and collaboration within workflows.

## 🚀 TL;DR / Try it now

```bash
# Build
npm install && npm run build

# Add to Claude Code (must use startup script)
claude mcp add scratchpad-mcp-v2 -- /absolute/path/to/scratchpad-mcp-v2/start-mcp.sh
```

```typescript
// Quick usage: create a workflow, write, and search
const workflow = await mcp.callTool('create-workflow', {
  name: 'AI Research Project',
  description: 'Collaborative research notes and findings',
});

const scratchpad = await mcp.callTool('create-scratchpad', {
  workflow_id: workflow.id,
  title: 'Model Architecture Notes',
  content: 'Initial transformer research findings...',
});

// Multi-mode editing example
await mcp.callTool('update-scratchpad', {
  id: scratchpad.id,
  mode: 'append_section',
  section_marker: '## Research Findings',
  content: 'New discovery about transformer architecture...',
});

// Block-based operations (NEW: semantic content handling)
const lastBlocks = await mcp.callTool('tail-scratchpad', {
  id: scratchpad.id,
  tail_size: { blocks: 2 }, // Get last 2 semantic blocks
});

await mcp.callTool('chop-scratchpad', {
  id: scratchpad.id,
  blocks: 1, // Remove last block precisely
});

// Chinese search example (intelligent tokenization)
const results = await mcp.callTool('search-scratchpads', {
  query: '自然語言處理模型架構',
  limit: 10,
});
```

### ⚠️ Important: always use start-mcp.sh

```bash
# ✅ CORRECT - use the startup script
./start-mcp.sh

# ❌ INCORRECT - running dist/server.js directly breaks path resolution
node dist/server.js
```

Why the startup script matters:

- Correct path resolution and database path handling
- Cross-directory support (works from any working directory)
- Proper loading of optional Chinese tokenization extensions

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or newer
- SQLite (FTS5 handled automatically)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd scratchpad-mcp-v2

# Install dependencies
npm install

# Type checking
npm run typecheck

# Run tests
npm test

# Build the server
npm run build

# Make startup script executable
chmod +x start-mcp.sh
```

### Running as MCP Server

```bash
# ✅ Production mode - ALWAYS use the startup script
./start-mcp.sh

# ✅ Development mode with hot reload
npm run dev

# ❌ DO NOT run dist/server.js directly
```

### Environment Configuration

```bash
# Optional: set a custom database path (relative to project root)
export SCRATCHPAD_DB_PATH="./my-scratchpad.db"

# Required for AI analysis features: OpenAI API key
export OPENAI_API_KEY="your-openai-api-key"

# Optional: disable specific MCP tools for token optimization
export SCRATCHPAD_DISABLED_TOOLS="get-scratchpad,get-scratchpad-outline"

# Or modify start-mcp.sh directly
```

## 🧰 Available MCP Tools

- `create-workflow` - Create workflow containers
- `list-workflows` - List all workflows
- `get-latest-active-workflow` - Get the most recently updated active workflow
- `update-workflow-status` - Activate/deactivate a workflow
- `create-scratchpad` - Create a scratchpad within a workflow
- `get-scratchpad` - Retrieve a scratchpad by ID with optional line range and context selection
- `get-scratchpad-outline` - Parse markdown headers and return structured outline with line numbers
- `append-scratchpad` - Append content to an existing scratchpad
- `tail-scratchpad` - Tail content with line/char/block modes, or set `full_content=true` to get full content
- `chop-scratchpad` - Remove lines or blocks from the end of a scratchpad (supports semantic block removal)
- `update-scratchpad` - Multi-mode editing tool with replace/insert/replace-lines/append-section modes
- `list-scratchpads` - List scratchpads in a workflow
- `search-scratchpads` - Full-text search with context-aware snippets (grep-like functionality, intelligent Chinese tokenization)
- `search-scratchpad-content` - Search within a single scratchpad content using string/regex patterns (VS Code Ctrl+F style)
- `search-workflows` - 🆕 Search workflows with weighted scoring (5/3/3/1) based on name/description/scratchpads content
- `extract-workflow-info` - Extract specific information from workflows using OpenAI models

---

## 🔗 Claude Code Integration

### Prerequisites

- Node.js 18.0.0 or newer
- Claude Code CLI installed and configured
- Project built: `npm run build`

### ⚠️ Critical configuration

Always use an absolute path to `start-mcp.sh` to ensure correct path resolution and cross-directory compatibility.

### Method 1: CLI installation (recommended)

```bash
# Build the project first
npm run build

# ✅ Use the startup script path
claude mcp add scratchpad-mcp-v2 -- /absolute/path/to/scratchpad-mcp-v2/start-mcp.sh

# ✅ Project scope (optional)
claude mcp add scratchpad-mcp-v2 --scope project -- /absolute/path/to/scratchpad-mcp-v2/start-mcp.sh

# ❌ INCORRECT - causes path resolution and cross-directory issues
claude mcp add scratchpad-mcp-v2 -- node ./dist/server.js
```

### Method 2: Manual configuration

Project-level `.mcp.json` (recommended)

```json
{
  "mcpServers": {
    "scratchpad-mcp-v2": {
      "command": "/absolute/path/to/scratchpad-mcp-v2/start-mcp.sh"
    }
  }
}
```

Global `~/.claude.json`

```json
{
  "mcpServers": {
    "scratchpad-mcp-v2": {
      "command": "/absolute/path/to/scratchpad-mcp-v2/start-mcp.sh",
      "env": {
        "SCRATCHPAD_DB_PATH": "./scratchpad-global.db"
      }
    }
  }
}
```

❌ Invalid configuration examples (do not use)

```json
{
  "mcpServers": {
    "scratchpad-mcp-v2": {
      "command": "node",
      "args": ["./dist/server.js"], // Breaks Chinese tokenization and path resolution
      "cwd": "/path/to/project" // 'cwd' is not a valid MCP parameter
    }
  }
}
```

### Cross-project usage

```bash
# Works from any directory - the script handles path resolution
cd /some/other/project
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | /path/to/scratchpad-mcp-v2/start-mcp.sh
```

### Verification

```bash
# Check MCP server status
claude mcp list

# View server details
claude mcp get scratchpad-mcp-v2

# Test Chinese tokenization functionality (if installed)
# You should see messages like:
# ✅ Simple 中文分詞擴展載入成功
# ✅ Jieba 結巴分詞功能完全可用
```

### Troubleshooting

- Server does not start: verify Node 18+, run `npm run build`, ensure `start-mcp.sh` is executable, use absolute path in MCP config
- Chinese search returns no results: most likely running `dist/server.js` directly — switch to `start-mcp.sh`
- Message "Simple 擴展載入失敗": normal when extensions are not installed; system falls back to FTS5/LIKE
- Tools not available: run `claude mcp list`, reload configuration, verify startup script path

### Best practices

- Always use `start-mcp.sh`
- Prefer absolute paths
- Verify Chinese tokenizer loading messages
- Commit a project-level `.mcp.json` for teams

---

## 🌐 Workflow Web Viewer

A standalone HTTP server to browse scratchpad workflows via a web UI.

### Quick Start

```bash
# Start web viewer (default port 3000)
npm run serve

# Custom port and development mode
npm run serve:dev
# or
node scripts/serve-workflow/server.js --port 3001 --dev
```

### Database path configuration

Priority order:

```bash
# 1. Command line parameter (highest priority)
node scripts/serve-workflow/server.js --db-path "/path/to/database.db"

# 2. Environment variable
export SCRATCHPAD_DB_PATH="/path/to/database.db"
npm run serve

# 3. Default: ./scratchpad.v6.db (lowest priority)
```

### Features

- 🔍 Search & filter: full-text search across workflows and scratchpads
- 🎨 Syntax highlighting: Prism.js with automatic dark/light theme
- 📱 Responsive UI with organization and pagination
- ⚡ Live updates

---

## 🇨🇳 Optional Chinese Text Enhancement

Optional feature to improve Chinese search accuracy (the system works fine without it via FTS5/LIKE fallback).

### Installation

1. Create an `extensions` directory

```bash
mkdir -p extensions
```

2. Download the extension and dictionaries for your platform

macOS

```bash
curl -L "https://github.com/wangfenjin/simple/releases/download/v0.5.2/libsimple.dylib" \
     -o extensions/libsimple.dylib
curl -L "https://github.com/wangfenjin/simple/releases/download/v0.5.2/dict.tar.gz" \
     | tar -xz -C extensions/
```

Linux

```bash
curl -L "https://github.com/wangfenjin/simple/releases/download/v0.5.2/libsimple.so" \
     -o extensions/libsimple.so
curl -L "https://github.com/wangfenjin/simple/releases/download/v0.5.2/dict.tar.gz" \
     | tar -xz -C extensions/
```

3. Create the required symlink for jieba dictionaries (use absolute path)

```bash
ln -sf "$(pwd)/extensions/dict" ./dict
```

4. Use the automated installation script (includes proper symlinks)

```bash
chmod +x scripts/install-chinese-support.sh
./scripts/install-chinese-support.sh
```

5. Verify

```bash
ls -la extensions/
ls -la dict  # Should point to the absolute path of extensions/dict

echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | ./start-mcp.sh
# Expected messages:
# ✅ Simple 中文分詞擴展載入成功
# ✅ Jieba 結巴分詞功能完全可用
```

Note: even without extensions installed, all search features work (fallback to FTS5/LIKE).

---

## 🛠️ MCP Tools API

### Workflow Management

#### `create-workflow`

Create a new workflow container.

```typescript
{
  name: string;           // required
  description?: string;   // optional
  project_scope?: string; // optional
}
```

#### `list-workflows`

List all workflows.

```typescript
{
  project_scope?: string; // optional
}
```

#### `get-latest-active-workflow`

Get the most recently updated active workflow.

```typescript
{
  project_scope: string; // required
}
```

#### `update-workflow-status`

Activate or deactivate a workflow.

```typescript
{
  workflow_id: string; // required
  is_active: boolean; // required
}
```

### Scratchpad Operations

#### `create-scratchpad`

Create a scratchpad within a workflow.

```typescript
{
  workflow_id: string;    // required
  title: string;          // required
  content: string;        // required
  include_content?: boolean; // default: false
}
```

#### `get-scratchpad`

Retrieve a specific scratchpad with optional line range and context selection.

```typescript
{
  id: string;                 // required
  line_range?: {              // optional - select specific line range
    start: number;            // >= 1 - start line number (1-based)
    end: number;              // >= start - end line number (1-based, inclusive)
  };
  line_context?: {            // optional - context lines around range
    before?: number;          // >= 0 - lines before range (default: 0)
    after?: number;           // >= 0 - lines after range (default: 0)
  };
  include_block?: boolean;    // optional - include block-based context (default: false)
}
```

**Range Selection Features:**
- `line_range`: Extract specific line range from scratchpad content
- `line_context`: Add context lines before/after the selected range
- `include_block`: Use semantic block boundaries for more intelligent context extraction

**Parameter Conflicts**: Cannot use `line_range`/`line_context` with `include_block` - they are mutually exclusive.

#### `get-scratchpad-outline`

Parse markdown headers in a scratchpad and return a structured outline with line numbers.

```typescript
{
  id: string;                    // required - scratchpad ID
  max_depth?: number;            // optional - maximum header depth to include (1-6, default: 6)
  include_content?: boolean;     // optional - include full scratchpad content (default: false)
}
```

**Features:**
- Parses markdown headers (# ## ### #### ##### ######) and returns structured outline
- Provides line numbers for each header for precise navigation
- Configurable depth limit to focus on main sections
- Returns hierarchical structure showing header relationships
- Useful for navigation, content organization, and structured content extraction

**Response Format:**
```typescript
{
  outline: Array<{
    level: number;              // Header level (1-6)
    title: string;              // Header text content
    line_number: number;        // Line number in scratchpad (1-based)
  }>;
  header_count: number;         // Total number of headers found
  max_level: number;            // Deepest header level in content
}
```

#### `append-scratchpad`

Append content to an existing scratchpad.

```typescript
{
  id: string;             // required
  content: string;        // required
  include_content?: boolean; // default: false
}
```

#### `tail-scratchpad`

Tail content, or return full content with `full_content=true`. Supports block-based extraction for semantic content handling.

```typescript
{
  id: string;             // required
  tail_size?: {           // choose either lines, chars, or blocks
    lines?: number;       // >= 1 - extract by line count
    chars?: number;       // >= 1 - extract by character count  
    blocks?: number;      // >= 1 - extract by block count (semantic units)
  };
  include_content?: boolean; // default: true
  full_content?: boolean;    // overrides tail_size
}
```

Parameter priority: `full_content` > `tail_size` > default (50 lines)

**Block-based extraction**: Uses the new append splitter format (`---\n<!--- block start --->\n`) to extract semantic content blocks rather than arbitrary lines. Perfect for retrieving complete logical sections.

#### `chop-scratchpad`

Remove content from the end of a scratchpad. Supports both line-based and block-based removal. Does not return content after completion.

```typescript
{
  id: string;         // required - scratchpad ID
  lines?: number;     // optional - number of lines to remove from end (default: 1)
  blocks?: number;    // optional - number of blocks to remove from end (alternative to lines)
}
```

**Block-based removal**: Use `blocks` parameter to remove complete semantic blocks rather than arbitrary lines. Uses the append splitter format to identify block boundaries. Only one of `lines` or `blocks` should be specified.

#### `update-scratchpad`

Multi-mode scratchpad editing tool with four precise editing modes.

```typescript
{
  id: string;                 // required - scratchpad ID
  mode: string;               // required - editing mode: 'replace' | 'insert_at_line' | 'replace_lines' | 'append_section'
  content: string;            // required - content to insert, replace, or append
  include_content?: boolean;  // optional - return content in response (default: false)
  
  // Mode-specific parameters:
  line_number?: number;       // required for 'insert_at_line' - 1-based line number
  start_line?: number;        // required for 'replace_lines' - 1-based start line (inclusive)
  end_line?: number;          // required for 'replace_lines' - 1-based end line (inclusive)
  section_marker?: string;    // required for 'append_section' - markdown section marker (e.g., "## Features")
}
```

**Editing Modes:**

- **`replace`**: Complete content replacement (no additional parameters)
- **`insert_at_line`**: Insert at specific line number (requires `line_number`)
- **`replace_lines`**: Replace line range (requires `start_line` and `end_line`) 
- **`append_section`**: Smart append after markdown section marker (requires `section_marker`)

**Response includes detailed operation feedback:**
- Lines affected count
- Size change in bytes  
- Insertion point (for insert/append modes)
- Replaced range (for replace_lines mode)

#### `list-scratchpads`

List scratchpads with pagination and content control.

```typescript
{
  workflow_id: string;    // required
  limit?: number;         // default: 20, max: 50
  offset?: number;        // default: 0
  preview_mode?: boolean; // return truncated content
  max_content_chars?: number;
  include_content?: boolean;
}
```

Content control priority: `include_content` > `preview_mode` > `max_content_chars`

### Search & Discovery

#### `search-workflows` 🆕

**NEW:** Search workflows with intelligent weighted scoring based on scratchpads content. Perfect for finding relevant workflows across projects.

```typescript
{
  query: string;          // required - supports mixed English/Chinese
  project_scope?: string; // filter by project scope
  page?: number;          // pagination (default: 1)
  limit?: number;         // items per page (default: 5, max: 20)
  useJieba?: boolean;     // force Chinese tokenization
}
```

**Key Features:**
- **Weighted Scoring:** workflows.name (5pts) > workflows.description (3pts) = scratchpads.title (3pts) > scratchpads.content (1pt)
- **Mixed Language:** `"React組件開發"` → English: `["React"]` + Chinese: `["組件開發"]`
- **Project Isolation:** Use `project_scope` for exact match filtering
- **Performance Optimized:** Search workflows first, then load scratchpads for scoring

```typescript
// Basic workflow search
const results = await callTool('search-workflows', {
  query: 'authentication system'
});

// Project-scoped search
const projectResults = await callTool('search-workflows', {
  query: 'user login',
  project_scope: 'myapp'
});

// Mixed language with pagination
const mixedResults = await callTool('search-workflows', {
  query: 'React組件開發',
  page: 2,
  limit: 10
});
```

#### `search-scratchpad-content` 🆕

**NEW:** Search within a single scratchpad content using string or regex patterns. Similar to VS Code Ctrl+F or grep for a single file. Supports context-aware search results with line-based context.

```typescript
{
  id: string;                     // required - scratchpad ID
  
  // Search parameters - exactly one must be provided
  query?: string;                 // string search
  queryRegex?: string;           // regex search pattern
  
  // Context display options
  context_lines?: number;         // lines before & after (shorthand, 0-50)
  context_lines_before?: number;  // lines before each match (0-50)
  context_lines_after?: number;   // lines after each match (0-50)
  
  // Advanced options
  max_context_matches?: number;   // max matches to show context (default: 5, max: 20)
  merge_context?: boolean;        // merge overlapping context ranges (default: true)
  show_line_numbers?: boolean;    // show line numbers in output
  
  // Output control (inherited)
  include_content?: boolean;      // include content in results
  preview_mode?: boolean;         // truncated preview
  max_content_chars?: number;     // character limit
}
```

**Key Features:**
- **VS Code Style Search:** Find-in-file functionality with precise line targeting
- **Dual Search Modes:** String literals (`query`) or regex patterns (`queryRegex`)
- **Context Awareness:** Show surrounding lines like `grep -A -B -C`
- **Smart Snippets:** Character-based or context-based snippet generation
- **Match Details:** Line numbers, character positions, and match text extraction

```typescript
// Basic string search
const stringResults = await callTool('search-scratchpad-content', {
  id: 'scratchpad-123',
  query: 'authentication'
});

// Regex search with context
const regexResults = await callTool('search-scratchpad-content', {
  id: 'scratchpad-123',
  queryRegex: 'function\\s+\\w+Auth',
  context_lines: 3,
  show_line_numbers: true
});

// Advanced context control
const contextResults = await callTool('search-scratchpad-content', {
  id: 'scratchpad-123',
  query: 'TODO',
  context_lines_before: 1,
  context_lines_after: 2,
  max_context_matches: 10
});
```

#### `search-scratchpads`

Full-text search with automatic Chinese tokenization and graceful fallbacks. Supports context-aware search similar to grep -A -B -C.

```typescript
{
  query: string;          // required
  workflow_id: string;    // required
  limit?: number;         // default: 10, max: 20
  offset?: number;        // default: 0
  preview_mode?: boolean;
  max_content_chars?: number;
  include_content?: boolean;
  useJieba?: boolean;     // defaults to auto detection
  
  // Context search parameters (grep-like functionality)
  context_lines_before?: number;    // lines before match (0-50)
  context_lines_after?: number;     // lines after match (0-50)
  context_lines?: number;           // symmetric context (0-50, takes precedence)
  max_context_matches?: number;     // limit matches processed (1-20, default: 5)
  merge_context?: boolean;          // merge overlapping ranges (default: true)
  show_line_numbers?: boolean;      // show line numbers (default: false)
}
```

Search intelligence: automatic detection → jieba → simple → FTS5 → LIKE; target <100ms. Context search provides grep-like functionality with line-based snippets.

### AI Analysis

#### `extract-workflow-info`

Extract specific information from workflows using OpenAI's GPT models.

```typescript
{
  workflow_id: string;          // required - ID of the workflow to analyze
  extraction_prompt: string;   // required - specific prompt describing what to extract
  model?: string;               // optional - OpenAI model (default: "gpt-5-nano")
  reasoning_effort?: string;    // optional - reasoning level (default: "medium")
                                // valid: "minimal" | "low" | "medium" | "high"
}
```

**Prerequisites**: Requires `OPENAI_API_KEY` environment variable.

**Supported Models**: gpt-5-nano, gpt-5-mini, gpt-4o, gpt-4o-mini and other OpenAI models. GPT-5 models support the `reasoning_effort` parameter for enhanced analysis quality.

**Returns**: Structured analysis based on the extraction prompt, including the model used and number of scratchpads processed.

---

## 📋 Usage Examples (more)

### Basic Workflow

```typescript
// 1) Create a project-scoped workflow
const workflow = await callTool('create-workflow', {
  name: 'ML Research Project',
  description: 'Research notes and experiments',
  project_scope: 'ml-research',
});

// 2) Create a scratchpad with Chinese content
const scratchpad = await callTool('create-scratchpad', {
  workflow_id: workflow.id,
  title: 'Transformer 架構研究',
  content: '初始的自然語言處理模型架構研究，包含注意力機制的詳細分析...',
});

// 3) Multi-mode editing examples - demonstrate all four modes
// Replace mode: Complete content replacement
await callTool('update-scratchpad', {
  id: scratchpad.id,
  mode: 'replace',
  content: '## 改進的 Transformer 架構研究\n\n完全重寫的研究筆記，包含最新發現...',
});

// Insert at line mode: Insert at specific position
await callTool('update-scratchpad', {
  id: scratchpad.id,
  mode: 'insert_at_line',
  line_number: 5,
  content: '### 重要發現\n這是一個突破性的發現...',
});

// Replace lines mode: Replace specific line range
await callTool('update-scratchpad', {
  id: scratchpad.id,
  mode: 'replace_lines',
  start_line: 3,
  end_line: 5,
  content: '### 更新的方法論\n使用新的評估標準\n包含最新的實驗結果',
});

// Append section mode: Smart append after markdown marker
await callTool('update-scratchpad', {
  id: scratchpad.id,
  mode: 'append_section',
  section_marker: '## 改進的 Transformer 架構研究',
  content: '\n### 最新實驗結果\n效能提升 15%，準確度達到 97.2%',
});

// 4) Parse document structure with get-scratchpad-outline
const outline = await callTool('get-scratchpad-outline', {
  id: scratchpad.id,
  max_depth: 3,  // Only show main sections (H1-H3)
  include_content: false,
});

// 5) Range-based content extraction with get-scratchpad
const specificSection = await callTool('get-scratchpad', {
  id: scratchpad.id,
  line_range: { start: 5, end: 15 },
  line_context: { before: 2, after: 2 },  // Add context lines
});

// 6) Block-based content extraction (semantic boundaries)
const blockContent = await callTool('get-scratchpad', {
  id: scratchpad.id,
  include_block: true,  // Use semantic block boundaries instead of line ranges
});

// 7) Intelligent Chinese search (auto-detected jieba)
const results = await callTool('search-scratchpads', {
  query: '注意力機制 自然語言',
  workflow_id: workflow.id,
  limit: 10,
});

// 8) Force tokenizer mode (English scenario)
const manualResults = await callTool('search-scratchpads', {
  query: 'transformer attention',
  useJieba: false,
  limit: 10,
});

// 9) Context search - basic (like grep -C 3)
const contextResults = await callTool('search-scratchpads', {
  query: 'error',
  context_lines: 3,
  workflow_id: workflow.id,
});

// 10) Context search - asymmetric (like grep -B 2 -A 5)
const asymmetricResults = await callTool('search-scratchpads', {
  query: 'function',
  context_lines_before: 2,
  context_lines_after: 5,
  show_line_numbers: true,
});

// 11) Context search - with match limits and line numbers
const limitedResults = await callTool('search-scratchpads', {
  query: 'TODO',
  context_lines: 1,
  max_context_matches: 3,
  show_line_numbers: true,
  merge_context: false,
});

// 12) Append mixed-language content
await callTool('append-scratchpad', {
  id: scratchpad.id,
  content: '\n\n## Additional Findings\n\nFrom paper XYZ: 新發現...',
});

// 13) Get full content via tail-scratchpad (alternative to get-scratchpad)
const fullContent = await callTool('tail-scratchpad', {
  id: scratchpad.id,
  full_content: true,
});

// 14) Traditional tail mode
const recentContent = await callTool('tail-scratchpad', {
  id: scratchpad.id,
  tail_size: { lines: 10 },
});

// 15) Block-based tail extraction (NEW: semantic content handling)
const lastTwoBlocks = await callTool('tail-scratchpad', {
  id: scratchpad.id,
  tail_size: { blocks: 2 },
  include_content: true,
});

// 16) Block-based content removal (NEW: semantic content management)
await callTool('chop-scratchpad', {
  id: scratchpad.id,
  blocks: 1, // Remove the last block instead of arbitrary lines
});

// 17) Verify block operations with precise extraction
const remainingBlocks = await callTool('tail-scratchpad', {
  id: scratchpad.id,
  tail_size: { blocks: 3 }, // Get last 3 blocks for verification
});

// 18) Full content but metadata only
const controlledContent = await callTool('tail-scratchpad', {
  id: scratchpad.id,
  full_content: true,
  include_content: false,
});
```

### Integration with Claude Code (highlights)

- Multi-agent collaboration via workflows
- Context persistence across conversations
- Intelligent search for both Chinese and English content
- Project organization through workflows and project scopes
- Cross-directory support via the startup script

---

## 💻 Development Guide

### Available Scripts

```bash
npm run dev       # Development (hot reload)
npm run build     # Build to dist/
npm test          # All tests
npm run test:watch
npm run serve     # Start web workflow viewer
npm run typecheck
npm run lint && npm run lint:fix
npm run format
npm run clean

# Cloud sync and database management
node scripts/live-sync.cjs --cloud-dir=~/Dropbox/scratchpad  # Real-time sync
node scripts/checkpoint-database.cjs --delete-mode           # WAL management
./scripts/install-chinese-support.sh                         # Chinese support

./start-mcp.sh < test-input.json  # Test the startup script
```

### Project Structure

```
src/
├── server.ts              # MCP server entry point
├── server-helpers.ts      # Parameter validation & error handling
├── database/
│   ├── ScratchpadDatabase.ts  # Core database operations
│   ├── schema.ts             # SQL schema & FTS5 configuration
│   ├── types.ts              # Database type definitions
│   └── index.ts              # Database module exports
└── tools/
    ├── workflow.ts           # Workflow management tools
    ├── scratchpad.ts         # Scratchpad CRUD operations
    ├── search.ts             # Search functionality
    ├── types.ts              # Tool type definitions
    └── index.ts              # Tools module exports

scripts/
├── serve-workflow/               # Web UI workflow viewer  
├── start-mcp.sh                 # ⚠️ Startup script (ALWAYS use this)
├── install-chinese-support.sh   # Chinese tokenization setup
├── live-sync.cjs                # 🌩️ Real-time cloud sync (no MCP disconnect needed)
├── checkpoint-database.cjs      # WAL checkpoint management
└── check-search-mode.cjs        # FTS5/LIKE search mode diagnostics

tests/
├── database.test.ts                    # Database layer tests
├── mcp-tools.test.ts                   # MCP tools integration tests
├── performance.test.ts                 # Performance benchmarks
├── update-scratchpad.test.ts           # Multi-mode editing tool tests
├── line-editor.test.ts                 # Line editing algorithm tests  
├── extraction.test.ts                  # AI extraction feature tests
├── chop-scratchpad.test.ts             # Chop functionality tests
├── mcp-project-scope.test.ts           # Project scope isolation tests
├── project-scope.test.ts               # Additional project scope tests
├── output-control.test.ts              # Output control optimization tests
├── parameter-conflict.test.ts          # Parameter validation conflict tests
├── ux-optimization.test.ts             # UX optimization tests
└── critical-fixes-validation-v2.test.ts # Critical fixes validation
# (18 test files total, 750+ tests passing)

extensions/
├── libsimple.dylib          # macOS simple tokenizer
├── libsimple.so             # Linux simple tokenizer
└── dict/                    # Jieba dictionaries
    ├── jieba.dict.utf8
    ├── hmm_model.utf8
    └── ...
```

### Testing Strategy

- Database layer: CRUD, FTS5, error and edge cases, Chinese tokenization
- MCP tools integration: 14 tools parameter validation, scenarios, protocol compliance
- Performance: FTS5 <100ms, 1MB content, concurrent access, tokenization performance
- Project scope: workflow isolation, cross-project restrictions

### Code Quality Standards

- TypeScript strict mode (no `any`)
- ESLint + Prettier
- > 95% test coverage
- Targets: <100ms search, 1MB content
- Path resolution via the startup script

---

## 🌩️ Cloud Sync & Database Tools

### Real-time Cloud Sync (`live-sync.cjs`)

Sync your scratchpad database to cloud storage without disconnecting MCP servers, perfect for multi-machine workflows.

**Key Features:**
- ✅ No MCP Server disconnection required
- ✅ Uses passive checkpoint (non-blocking)
- ✅ Smart sync (only when files change)
- ✅ Automatic backup with rotation
- ✅ Works with WAL mode seamlessly

#### Basic Usage

```bash
# One-time sync
node scripts/live-sync.cjs --cloud-dir=~/Dropbox/scratchpad

# Automated sync (add to crontab)
*/30 * * * * cd /path/to/project && node scripts/live-sync.cjs --cloud-dir=~/Dropbox/scratchpad
```

#### Advanced Options

```bash
# Custom database and backup retention
node scripts/live-sync.cjs --db=scratchpad.v6.db --cloud-dir=~/iCloud/scratchpad --keep=10

# Dry run mode
node scripts/live-sync.cjs --cloud-dir=~/Dropbox/scratchpad --dry-run --verbose
```

#### Multi-machine Setup

```bash
# On other machines, restore from cloud
cp ~/Dropbox/scratchpad/scratchpad.v6.db ./scratchpad.v6.db
```

### Database Management Tools

#### Database Migration (`migrate-workflows-fts.cjs`)

**🆕 NEW:** Migrate existing databases to support the new `search-workflows` tool with weighted scoring.

**Automatic Migration (Recommended):**
- Migration happens automatically when starting the MCP server
- Existing databases are upgraded from v3 → v4 seamlessly  
- No downtime or data loss

**Manual Migration:**
```bash
# Migrate default database
node scripts/migrate-workflows-fts.cjs

# Migrate specific database  
node scripts/migrate-workflows-fts.cjs /path/to/your/database.db
```

**What's Added:**
- ✅ `workflows_fts` virtual table for full-text search
- ✅ Automatic FTS5 triggers for data synchronization
- ✅ `search-workflows` tool with 5/3/3/1 weighted scoring
- ✅ Mixed English/Chinese language support
- ✅ Project scope filtering and smart pagination

**Safety Features:**
- 🔒 Automatic backup before migration (`.backup.timestamp`)
- 🔄 FTS5 graceful fallback to LIKE search if unsupported
- ✅ Data integrity verification after migration
- 🛡️ Rollback support via backup files

#### WAL Checkpoint (`checkpoint-database.cjs`)

Handle WAL files and perform database maintenance:

```bash
# Process WAL files and switch to DELETE mode
node scripts/checkpoint-database.cjs --delete-mode --db-path=scratchpad.v6.db
```

#### Search Mode Diagnostics (`check-search-mode.cjs`)

Check FTS5/LIKE search mode status:

```bash
# Verify search capabilities
node scripts/check-search-mode.cjs
```

---

## 🔧 Advanced Configuration

### Startup Script Features

```bash
#!/bin/bash
# Ensure correct working directory
cd "$(dirname "$0")"
export SCRATCHPAD_DB_PATH="${SCRATCHPAD_DB_PATH:-./scratchpad.db}"
node dist/server.js "$@"
```

Benefits: stable working directory, proper extension/dictionary loading, DB path setup, cross-directory support.

### FTS5 Configuration

- Disabled automatically in test environments
- Tokenizer selection: simple/jieba/standard
- Fallback strategy: jieba → simple → FTS5 → LIKE
- Indexed fields: title and content (with triggers)
- Ranking: BM25

### Database Optimization

- WAL mode, prepared statements, single connection with proper cleanup, smart tokenization

---

## 📊 Technical Specifications

### Architecture

- Server: MCP over stdio
- Tools: 16 core tools with comprehensive parameter validation
- Database: SQLite with FTS5 full-text search, WAL mode, optional Chinese tokenization
- Content Management: Block-based operations with semantic content handling via BlockParser utility
- Append System: Enhanced splitter format (`---\n<!--- block start --->\n`) for clear content separation
- Extension layer: optional Chinese word segmentation with cross-directory support

### Performance Characteristics

| Metric            | Target             | Implementation                            |
| ----------------- | ------------------ | ----------------------------------------- |
| Search Response   | <100ms             | FTS5 indexing with prepared statements    |
| Chinese Search    | <150ms             | Jieba tokenization with fallback strategy |
| Content Limit     | 1MB per scratchpad | Validated at tool level                   |
| Workflow Capacity | 50 scratchpads     | Enforced by database constraints          |
| Concurrent Access | Thread-safe        | SQLite WAL mode                           |
| Cross-Directory   | ✅ Supported       | Via startup script path resolution        |

### Data Model

```
workflows
├── id (primary key)
├── name
├── description
├── created_at
├── updated_at
├── scratchpad_count
├── is_active
└── project_scope

scratchpads
├── id (primary key)
├── workflow_id (foreign key)
├── title
├── content
├── size_bytes
├── created_at
└── updated_at

scratchpads_fts (FTS5 virtual table)
├── id (unindexed)
├── workflow_id (unindexed)
├── title (indexed)
├── content (indexed)
└── tokenize=simple     # with optional jieba
```

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `SCRATCHPAD_DB_PATH` | Database file path (relative to project root) | `./scratchpad.db` | `./my-scratchpad.db` |
| `OPENAI_API_KEY` | OpenAI API key for AI analysis features | - | `sk-...` |
| `SCRATCHPAD_DISABLED_TOOLS` | Comma-separated list of tools to disable for token optimization | `""` (all enabled) | `get-scratchpad,get-scratchpad-outline` |

#### Tool Control Examples

```bash
# Disable get-scratchpad tool only
export SCRATCHPAD_DISABLED_TOOLS="get-scratchpad"

# Disable both tools for maximum token savings
export SCRATCHPAD_DISABLED_TOOLS="get-scratchpad,get-scratchpad-outline"

# Enable all tools (default behavior)
unset SCRATCHPAD_DISABLED_TOOLS
```

**Available tools for disabling:**
- `get-scratchpad` - Retrieve scratchpad content (can be replaced by `tail-scratchpad` with `full_content=true`)
- `get-scratchpad-outline` - Parse markdown headers structure

**Token Savings:**
- Disabling `get-scratchpad`: ~200-300 tokens
- Disabling `get-scratchpad-outline`: ~150-200 tokens
- Total potential savings: ~350-500 tokens

### Environment Requirements

- Node.js 18+
- SQLite with FTS5
- Memory ~50MB
- Storage varies (1MB per scratchpad limit)
- Optional extensions: libsimple.dylib/.so for Chinese support

### Dependencies

- Core: `@modelcontextprotocol/sdk`, `better-sqlite3`
- AI Features: `openai`, `tiktoken`
- Web Viewer: `marked`, `marked-highlight`, `prismjs`
- Dev: `typescript`, `tsup`, `vitest`, `eslint`, `prettier`

---

## 🤝 Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/amazing-feature`
3. Install deps: `npm install`
4. Build: `npm run build`
5. Test startup script: `./start-mcp.sh`
6. Make changes and add tests
7. Run tests: `npm test`
8. Quality checks: `npm run typecheck && npm run lint`
9. Commit: `git commit -m 'feat: add amazing feature'`
10. Push: `git push origin feature/amazing-feature`
11. Open a PR

### Development Standards

- New features must include tests; maintain >95% coverage
- Follow TypeScript strict mode
- Conventional Commits
- Update docs for API changes
- Use `start-mcp.sh` for manual testing

---

## 📄 License

MIT License (see `LICENSE`)

## 📞 Support

- Issues: GitHub Issues for bug reports and feature requests
- Documentation: inline code docs and tests
- Performance: FTS5 target <100ms
- Chinese support: ensure tokenizer is loaded via the startup script

---

Remember: always use `./start-mcp.sh` to launch the MCP server. Running `dist/server.js` directly causes path resolution and cross-directory compatibility issues.
