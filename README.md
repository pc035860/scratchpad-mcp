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
  description: 'Collaborative research notes and findings'
});

await mcp.callTool('create-scratchpad', {
  workflow_id: workflow.id,
  title: 'Model Architecture Notes',
  content: 'Initial transformer research findings...'
});

// Chinese search example (intelligent tokenization)
const results = await mcp.callTool('search-scratchpads', {
  query: '自然語言處理模型架構',
  limit: 10
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

# Or modify start-mcp.sh directly
```

## 🧰 Available MCP Tools
- `create-workflow` - Create workflow containers
- `list-workflows` - List all workflows
- `get-latest-active-workflow` - Get the most recently updated active workflow
- `update-workflow-status` - Activate/deactivate a workflow
- `create-scratchpad` - Create a scratchpad within a workflow
- `get-scratchpad` - Retrieve a scratchpad by ID
- `append-scratchpad` - Append content to an existing scratchpad
- `tail-scratchpad` - Tail content, or set `full_content=true` to get full content
- `list-scratchpads` - List scratchpads in a workflow
- `search-scratchpads` - Full-text search (with intelligent Chinese tokenization)

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
      "args": ["./dist/server.js"],          // Breaks Chinese tokenization and path resolution
      "cwd": "/path/to/project"               // 'cwd' is not a valid MCP parameter
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
1) Create an `extensions` directory
```bash
mkdir -p extensions
```

2) Download the extension and dictionaries for your platform

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

3) Create the required symlink for jieba dictionaries (use absolute path)
```bash
ln -sf "$(pwd)/extensions/dict" ./dict
```

4) Use the automated installation script (includes proper symlinks)
```bash
chmod +x scripts/install-chinese-support.sh
./scripts/install-chinese-support.sh
```

5) Verify
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
  project_scope?: string; // optional
}
```

#### `update-workflow-status`
Activate or deactivate a workflow.
```typescript
{
  workflow_id: string;    // required
  is_active: boolean;     // required
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
Retrieve a specific scratchpad.
```typescript
{
  id: string; // required
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
Tail content, or return full content with `full_content=true`.
```typescript
{
  id: string;             // required
  tail_size?: {           // choose either lines or chars
    lines?: number;       // >= 1
    chars?: number;       // >= 1
  };
  include_content?: boolean; // default: true
  full_content?: boolean;    // overrides tail_size
}
```

Parameter priority: `full_content` > `tail_size` > default (50 lines)

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

#### `search-scratchpads`
Full-text search with automatic Chinese tokenization and graceful fallbacks.
```typescript
{
  query: string;          // required
  workflow_id?: string;   // optional
  limit?: number;         // default: 10, max: 20
  offset?: number;        // default: 0
  preview_mode?: boolean;
  max_content_chars?: number;
  include_content?: boolean;
  useJieba?: boolean;     // defaults to auto detection
}
```

Search intelligence: automatic detection → jieba → simple → FTS5 → LIKE; target <100ms.

---

## 📋 Usage Examples (more)

### Basic Workflow
```typescript
// 1) Create a project-scoped workflow
const workflow = await callTool('create-workflow', {
  name: 'ML Research Project',
  description: 'Research notes and experiments',
  project_scope: 'ml-research'
});

// 2) Create a scratchpad with Chinese content
const scratchpad = await callTool('create-scratchpad', {
  workflow_id: workflow.id,
  title: 'Transformer 架構研究',
  content: '初始的自然語言處理模型架構研究，包含注意力機制的詳細分析...'
});

// 3) Intelligent Chinese search (auto-detected jieba)
const results = await callTool('search-scratchpads', {
  query: '注意力機制 自然語言',
  workflow_id: workflow.id,
  limit: 10
});

// 4) Force tokenizer mode (English scenario)
const manualResults = await callTool('search-scratchpads', {
  query: 'transformer attention',
  useJieba: false,
  limit: 10
});

// 5) Append mixed-language content
await callTool('append-scratchpad', {
  id: scratchpad.id,
  content: '\n\n## Additional Findings\n\nFrom paper XYZ: 新發現...'
});

// 6) Get full content via tail-scratchpad (alternative to get-scratchpad)
const fullContent = await callTool('tail-scratchpad', {
  id: scratchpad.id,
  full_content: true
});

// 7) Traditional tail mode
const recentContent = await callTool('tail-scratchpad', {
  id: scratchpad.id,
  tail_size: { lines: 10 }
});

// 8) Full content but metadata only
const controlledContent = await callTool('tail-scratchpad', {
  id: scratchpad.id,
  full_content: true,
  include_content: false
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
npm run typecheck
npm run lint && npm run lint:fix
npm run format
npm run clean
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
├── start-mcp.sh              # ⚠️ Startup script (ALWAYS use this)
└── install-chinese-support.sh   # Chinese tokenization setup

tests/
├── database.test.ts          # Database layer tests (9/9 passing)
├── mcp-tools.test.ts         # MCP tools integration tests
├── performance.test.ts       # Performance benchmarks
├── mcp-project-scope.test.ts # Project scope isolation tests
└── project-scope.test.ts     # Additional project scope tests

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
- MCP tools integration: 11 tools parameter validation, scenarios, protocol compliance
- Performance: FTS5 <100ms, 1MB content, concurrent access, tokenization performance
- Project scope: workflow isolation, cross-project restrictions

### Code Quality Standards
- TypeScript strict mode (no `any`)
- ESLint + Prettier
- >95% test coverage
- Targets: <100ms search, 1MB content
- Path resolution via the startup script

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
- Tools: 11 core tools with comprehensive parameter validation
- Database: SQLite with FTS5 full-text search, WAL mode, optional Chinese tokenization
- Extension layer: optional Chinese word segmentation with cross-directory support

### Performance Characteristics
| Metric | Target | Implementation |
|--------|--------|----------------|
| Search Response | <100ms | FTS5 indexing with prepared statements |
| Chinese Search | <150ms | Jieba tokenization with fallback strategy |
| Content Limit | 1MB per scratchpad | Validated at tool level |
| Workflow Capacity | 50 scratchpads | Enforced by database constraints |
| Concurrent Access | Thread-safe | SQLite WAL mode |
| Cross-Directory | ✅ Supported | Via startup script path resolution |

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

### Environment Requirements
- Node.js 18+
- SQLite with FTS5
- Memory ~50MB
- Storage varies (1MB per scratchpad limit)
- Optional extensions: libsimple.dylib/.so for Chinese support

### Dependencies
- Core: `@modelcontextprotocol/sdk`, `better-sqlite3`
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