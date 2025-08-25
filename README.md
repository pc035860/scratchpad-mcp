# Scratchpad MCP v2

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-FTS5-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A **Model Context Protocol (MCP) server** that provides shared scratchpad functionality for Claude Code sub-agents, enabling seamless context sharing and collaboration within workflows.

## ⚠️ Important: Use start-mcp.sh Script

**🚨 Critical Notice**: Always use the provided `start-mcp.sh` script to launch this MCP server. **Direct execution of `dist/server.js` will cause path resolution issues and cross-directory compatibility problems**.

```bash
# ✅ CORRECT - Always use the startup script
./start-mcp.sh

# ❌ INCORRECT - This will cause path resolution issues
node dist/server.js
```

**Why the startup script is essential:**
- **Path Resolution**: Ensures correct working directory for extension loading
- **Cross-Directory Support**: Works correctly when called from any directory  
- **Database Path**: Handles relative database path resolution properly
- **Environment Setup**: Manages environment variables and dependencies correctly

## ✨ Key Features

- **🔄 Context Sharing**: Enable sub-agents to share context and collaborate across workflows
- **🔍 Full-Text Search**: Powerful FTS5-powered search with intelligent LIKE fallback
- **📁 Workflow Organization**: Organize scratchpads into logical workflows with project scope isolation
- **⚡ High Performance**: SQLite WAL mode with <100ms search response times
- **🛡️ Type Safety**: Full TypeScript with strict mode and comprehensive validation
- **📊 Size Management**: Support for 1MB scratchpads, 50 scratchpads per workflow
- **🧪 Comprehensive Testing**: 50+ tests covering database, tools, and performance
- **🌐 Cross-Directory**: Works from any working directory via startup script

### 🎯 Optional Enhancements

- **🧠 Smart Chinese Word Segmentation**: Advanced jieba tokenization for improved Chinese text analysis (optional)

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- SQLite with FTS5 support (automatically handled)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd scratchpad-mcp-v2

# Install dependencies
npm install

# Run type checking
npm run typecheck

# Run tests to verify setup
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

# ❌ DO NOT use dist/server.js directly - causes path resolution issues
```

### Environment Configuration

```bash
# Optional: Set custom database path (relative to project root)
export SCRATCHPAD_DB_PATH="./my-scratchpad.db"

# Or modify start-mcp.sh directly
```

## 🇨🇳 Optional Chinese Text Enhancement

**Enhancement Feature**: For improved Chinese text search accuracy, you can optionally install the `wangfenjin/simple` SQLite extension with **jieba tokenization**. 

**Note**: This is entirely optional - the system works perfectly without it using standard FTS5 and LIKE search fallbacks. The startup script ensures proper path resolution for extension loading when available.

### Installation

1. **Create extensions directory:**
   ```bash
   mkdir -p extensions
   ```

2. **Download the extension for your platform:**
   
   **macOS:**
   ```bash
   # Download libsimple.dylib
   curl -L "https://github.com/wangfenjin/simple/releases/download/v0.5.2/libsimple.dylib" \
        -o extensions/libsimple.dylib
   
   # Download dictionary files
   curl -L "https://github.com/wangfenjin/simple/releases/download/v0.5.2/dict.tar.gz" \
        | tar -xz -C extensions/
   ```
   
   **Linux:**
   ```bash
   # Download libsimple.so
   curl -L "https://github.com/wangfenjin/simple/releases/download/v0.5.2/libsimple.so" \
        -o extensions/libsimple.so
   
   # Download dictionary files  
   curl -L "https://github.com/wangfenjin/simple/releases/download/v0.5.2/dict.tar.gz" \
        | tar -xz -C extensions/
   ```

3. **Create required symlink for jieba dictionaries:**
   ```bash
   # Required for jieba_query() functionality - use absolute path for cross-directory support
   ln -sf "$(pwd)/extensions/dict" ./dict
   ```

4. **Or use the automated installation script:**
   ```bash
   # Run the automated installation script (includes proper symlinks)
   chmod +x scripts/install-chinese-support.sh
   ./scripts/install-chinese-support.sh
   ```

5. **Verify installation:**
   ```bash
   # Check if files and symlink are in place
   ls -la extensions/
   ls -la dict  # Should point to absolute path: extensions/dict
   
   # Test Chinese tokenization (if extensions are installed)
   echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | ./start-mcp.sh
   # Should show: "✅ Simple 中文分詞擴展載入成功" and "✅ Jieba 結巴分詞功能完全可用"
   ```

### Optional Enhancement Features
- **Smart jieba tokenization**: Advanced Chinese word segmentation for improved semantic accuracy (when installed)
- **Intelligent fallback system**: jieba → simple → FTS5 → LIKE search ensures functionality regardless of extensions
- **Automatic mode detection**: System automatically uses best available tokenizer, defaults to standard search
- **Pinyin search support**: Enhanced search using Pinyin romanization (requires extension)
- **Zero-dependency operation**: Full functionality without any extensions installed

### Troubleshooting Extension Loading
- **Issue**: Extensions fail to load or path resolution errors
  - **Cause**: Using `dist/server.js` directly instead of `start-mcp.sh`
  - **Solution**: Always use `./start-mcp.sh` for proper path resolution

- **Issue**: "Simple 擴展載入失敗" warning message
  - **Effect**: System automatically falls back to standard FTS5/LIKE search
  - **Solution**: This is normal if extensions aren't installed - no action needed

**Remember**: All search functionality works without any extensions installed!

## 🔗 Claude Code Integration

### Prerequisites

- Node.js 18.0.0 or higher
- Claude Code CLI installed and configured
- **Built project**: Run `npm run build` before configuration

### ⚠️ Critical Configuration Requirements

**IMPORTANT**: All MCP configurations **must** use the `start-mcp.sh` script path for optimal cross-directory compatibility and proper path resolution.

### Method 1: CLI Installation (Recommended)

```bash
# Build the project first
npm run build

# ✅ CORRECT - Use startup script path
claude mcp add scratchpad-mcp-v2 -- /absolute/path/to/scratchpad-mcp-v2/start-mcp.sh

# ✅ For project scope
claude mcp add scratchpad-mcp-v2 --scope project -- /absolute/path/to/scratchpad-mcp-v2/start-mcp.sh

# ❌ INCORRECT - This causes path resolution and cross-directory issues
claude mcp add scratchpad-mcp-v2 -- node ./dist/server.js
```

### Method 2: Manual Configuration

Create or edit your MCP configuration file:

**Project-level configuration**: Project root `.mcp.json` (recommended)
```json
{
  "mcpServers": {
    "scratchpad-mcp-v2": {
      "command": "/absolute/path/to/scratchpad-mcp-v2/start-mcp.sh"
    }
  }
}
```

**Global user configuration**: `~/.claude.json`
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

**❌ Invalid Configuration Examples (DO NOT USE)**
```json
{
  "mcpServers": {
    "scratchpad-mcp-v2": {
      "command": "node",
      "args": ["./dist/server.js"],          // ❌ Breaks Chinese tokenization
      "cwd": "/path/to/project"               // ❌ 'cwd' is not a valid MCP parameter
    }
  }
}
```

### Cross-Project Usage

The `start-mcp.sh` script enables seamless cross-project usage:

```bash
# Works from any directory - script handles path resolution automatically
cd /some/other/project
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | /path/to/scratchpad-mcp-v2/start-mcp.sh
```

### Verification

```bash
# Check MCP server status
claude mcp list

# View server details
claude mcp get scratchpad-mcp-v2

# Test Chinese tokenization functionality
# Should show successful loading messages:
# ✅ Simple 中文分詞擴展載入成功
# ✅ Jieba 結巴分詞功能完全可用 (if dict installed)
```

### Available MCP Tools

Once properly configured, Claude Code can use these 9 MCP tools:

- `create-workflow` - Create new workflow containers
- `list-workflows` - List all available workflows  
- `get-latest-active-workflow` - Get most recently updated active workflow
- `update-workflow-status` - Activate/deactivate workflows
- `create-scratchpad` - Create scratchpads within workflows
- `get-scratchpad` - Retrieve scratchpad content
- `append-scratchpad` - Append content to existing scratchpads
- `list-scratchpads` - List scratchpads in a workflow
- `search-scratchpads` - Full-text search with intelligent Chinese tokenization

### Usage Example

```typescript
// Typical workflow in Claude Code
const workflow = await mcp.callTool('create-workflow', {
  name: 'AI Research Project',
  description: 'Collaborative research notes and findings',
  project_scope: 'my-ai-project'  // Optional project isolation
});

const scratchpad = await mcp.callTool('create-scratchpad', {
  workflow_id: workflow.id,
  title: 'Model Architecture Notes',
  content: 'Initial transformer research findings...'
});

// Chinese search (automatically uses jieba tokenization)
const results = await mcp.callTool('search-scratchpads', {
  query: '自然語言處理模型架構',  // Intelligent Chinese word segmentation
  limit: 10
});
```

### Troubleshooting

**Issue: MCP server won't start**
- ✅ Check Node.js version is 18+
- ✅ Ensure project is built: `npm run build`
- ✅ Verify `start-mcp.sh` is executable: `chmod +x start-mcp.sh`
- ✅ Use absolute path in MCP configuration

**Issue: Chinese search returns no results**
- ❌ **Most likely cause**: Using `dist/server.js` instead of `start-mcp.sh`
- ✅ **Solution**: Update MCP config to use `start-mcp.sh` script
- ✅ **Verification**: Look for tokenizer loading messages in logs

**Issue: "Simple 擴展載入失敗" or tokenization errors**
- ❌ **Cause**: Path resolution issues when not using startup script
- ✅ **Solution**: Always use `start-mcp.sh` for MCP server launch
- ✅ **Check**: Extensions exist in `extensions/` directory

**Issue: Tools not available**
- ✅ Use `claude mcp list` to check server status
- ✅ Ensure server is running and responding
- ✅ Verify Claude Code has reloaded the configuration
- ✅ Check that startup script path is correct

### Best Practices

- **✅ ALWAYS use `start-mcp.sh`**: Never use `dist/server.js` directly
- **✅ Use absolute paths**: Prevents issues when called from different directories
- **✅ Test Chinese functionality**: Verify tokenizer loading messages appear
- **✅ Include in version control**: Add `.mcp.json` to repos for team sharing
- **✅ Regular updates**: Keep extensions and dictionaries updated

## 🛠️ MCP Tools API

### Workflow Management

#### `create-workflow`
Create a new workflow container for organizing scratchpads.

```typescript
{
  name: string;           // Workflow name (required)
  description?: string;   // Optional description  
  project_scope?: string; // Optional project isolation
}
```

#### `list-workflows`
List all available workflows with their metadata.

```typescript
{
  project_scope?: string; // Optional: filter by project scope
}
```

#### `get-latest-active-workflow`
Get the most recently updated active workflow.

```typescript
{
  project_scope?: string; // Optional: filter by project scope
}
```

#### `update-workflow-status`
Activate or deactivate a workflow. Only active workflows can have scratchpads created.

```typescript
{
  workflow_id: string;    // Workflow ID (required)
  is_active: boolean;     // Activation state (required)
}
```

### Scratchpad Operations

#### `create-scratchpad`
Create a new scratchpad within a workflow.

```typescript
{
  workflow_id: string;    // Target workflow ID (required)
  title: string;          // Scratchpad title (required)
  content: string;        // Initial content (required)
}
```

#### `get-scratchpad`
Retrieve a specific scratchpad by its ID.

```typescript
{
  id: string;             // Scratchpad ID (required)
}
```

#### `append-scratchpad`
Append content to an existing scratchpad.

```typescript
{
  id: string;             // Scratchpad ID (required)
  content: string;        // Content to append (required)
}
```

#### `list-scratchpads`
List scratchpads within a workflow with pagination.

```typescript
{
  workflow_id: string;    // Workflow ID (required)
  limit?: number;         // Max results (default: 50, max: 100)
  offset?: number;        // Skip count (default: 0)
}
```

### Search & Discovery

#### `search-scratchpads`
Search scratchpads using full-text search with intelligent ranking and automatic Chinese tokenization.

```typescript
{
  query: string;          // Search query (required)
  workflow_id?: string;   // Limit to specific workflow (optional)
  limit?: number;         // Max results (default: 20, max: 50)
  useJieba?: boolean;     // Force jieba tokenization (auto-detect by default)
}
```

**Search Intelligence:**
- **Automatic Detection**: Chinese text automatically uses jieba tokenization
- **Fallback Strategy**: jieba → simple → FTS5 → LIKE search
- **Performance**: <100ms response times with proper indexing

## 💻 Development Guide

### Available Scripts

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Run all tests
npm test

# Watch mode testing
npm run test:watch

# Type checking
npm run typecheck

# Code linting
npm run lint
npm run lint:fix

# Code formatting
npm run format

# Clean build artifacts
npm run clean

# Test startup script functionality
./start-mcp.sh < test-input.json
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
├── start-mcp.sh              # ⚠️ CRITICAL: Startup script (ALWAYS USE THIS)
└── install-chinese-support.sh   # Chinese tokenization setup

tests/
├── database.test.ts          # Database layer tests (9/9 passing)
├── mcp-tools.test.ts         # MCP tools integration tests
├── performance.test.ts       # Performance benchmarks
├── mcp-project-scope.test.ts # Project scope isolation tests
└── project-scope.test.ts     # Additional project scope tests

extensions/                   # Chinese tokenization extensions
├── libsimple.dylib          # macOS simple tokenizer
├── libsimple.so             # Linux simple tokenizer
└── dict/                    # Jieba dictionaries
    ├── jieba.dict.utf8
    ├── hmm_model.utf8
    └── ...
```

### Testing Strategy

#### Database Layer Testing
```bash
# Run database-specific tests
npm test -- tests/database.test.ts
```
- ✅ CRUD operations validation
- ✅ FTS5 search functionality with Chinese support
- ✅ Error handling and edge cases
- ✅ Chinese tokenization integration

#### MCP Tools Integration Testing
```bash
# Run MCP tools tests
npm test -- tests/mcp-tools.test.ts
```
- ✅ Parameter validation for all 9 tools
- ✅ Full workflow scenario coverage
- ✅ MCP protocol compliance
- ✅ Error condition handling
- ✅ Chinese search functionality

#### Performance Testing
```bash
# Run performance benchmarks
npm test -- tests/performance.test.ts
```
- ✅ FTS5 search response time (<100ms target)
- ✅ Large content handling (1MB scratchpads)
- ✅ Concurrent access patterns
- ✅ Chinese tokenization performance

#### Project Scope Testing
```bash
# Run project scope isolation tests
npm test -- tests/project-scope.test.ts
```
- ✅ Workflow isolation by project scope
- ✅ Cross-project search limitations
- ✅ Scope-based filtering

### Code Quality Standards

- **TypeScript Strict Mode**: Full type safety with zero `any` types
- **ESLint + Prettier**: Consistent code formatting and linting
- **Comprehensive Testing**: >95% test coverage across all layers
- **Performance Targets**: <100ms search, 1MB content support
- **Path Resolution**: All extensions work via startup script

## 📊 Technical Specifications

### Architecture

- **Server Layer**: MCP protocol implementation with stdio communication
- **Tools Layer**: 9 core tools with comprehensive parameter validation
- **Database Layer**: SQLite with FTS5 full-text search, WAL mode, and Chinese tokenization
- **Extension Layer**: Optional Chinese word segmentation with cross-directory support

### Performance Characteristics

| Metric | Target | Implementation |
|--------|---------|----------------|
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
└── project_scope       # NEW: Project isolation

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
└── tokenize=simple     # With optional jieba integration
```

### Environment Requirements

- **Node.js**: 18.0.0 or higher
- **SQLite**: Version with FTS5 support
- **Memory**: ~50MB typical usage
- **Storage**: Varies by content (1MB per scratchpad limit)
- **Extensions**: Optional libsimple.dylib/.so for Chinese support

### Dependencies

#### Core Dependencies
- `@modelcontextprotocol/sdk`: ^1.0.4 - MCP protocol implementation
- `better-sqlite3`: ^12.0.1 - High-performance SQLite driver

#### Development Dependencies  
- `typescript`: ^5.3.3 - Type checking and compilation
- `tsup`: ^8.0.2 - Fast, zero-config bundling
- `vitest`: ^1.6.0 - Modern testing framework
- `eslint`: ^8.57.0 + TypeScript plugins - Code linting
- `prettier`: ^3.2.5 - Code formatting

## 🔧 Advanced Configuration

### Database Optimization

The server automatically configures SQLite for optimal performance:

- **WAL Mode**: Write-Ahead Logging for better concurrency
- **FTS5 Indexing**: Full-text search with Chinese tokenization support
- **Prepared Statements**: Efficient query execution
- **Connection Pooling**: Single connection with proper cleanup
- **Smart Tokenization**: Automatic Chinese detection with jieba integration

### FTS5 Configuration

- **Conditional Enable**: Automatically disabled in test environments
- **Tokenizer Selection**: Intelligent choice between simple/jieba/standard
- **Fallback Strategy**: Graceful degradation: jieba → simple → FTS5 → LIKE
- **Index Fields**: Both title and content indexed with proper triggers
- **Search Ranking**: Relevance-based result ordering with BM25

### Startup Script Features

The `start-mcp.sh` script provides essential functionality:

```bash
#!/bin/bash

# Change to project directory to ensure correct paths
cd "$(dirname "$0")"

# Set environment variables (if needed)
export SCRATCHPAD_DB_PATH="${SCRATCHPAD_DB_PATH:-./scratchpad.db}"

# Start MCP server
node dist/server.js "$@"
```

**Key Benefits:**
- **Working Directory**: Always executes from project root
- **Path Resolution**: Ensures extensions and dictionaries are found
- **Environment Setup**: Configures database path correctly
- **Cross-Directory**: Works when called from any location

## 📋 Usage Examples

### Basic Workflow

```typescript
// 1. Create a project-scoped workflow
const workflow = await callTool('create-workflow', {
  name: 'ML Research Project',
  description: 'Research notes and experiments',
  project_scope: 'ml-research'  // Project isolation
});

// 2. Create scratchpads with Chinese content
const scratchpad = await callTool('create-scratchpad', {
  workflow_id: workflow.id,
  title: 'Transformer 架構研究',
  content: '初始的自然語言處理模型架構研究，包含注意力機制的詳細分析...'
});

// 3. Intelligent Chinese search (auto-detects and uses jieba)
const results = await callTool('search-scratchpads', {
  query: '注意力機制 自然語言',  // Automatically uses jieba tokenization
  workflow_id: workflow.id,    // Scope to specific workflow
  limit: 10
});

// 4. Force specific tokenization mode
const manualResults = await callTool('search-scratchpads', {
  query: 'transformer attention',
  useJieba: false,  // Force simple/FTS5 mode for English
  limit: 10
});

// 5. Append content with mixed languages
await callTool('append-scratchpad', {
  id: scratchpad.id,
  content: '\n\n## Additional Findings 補充發現\n\nFrom paper XYZ: 從論文XYZ發現...'
});
```

### Project Scope Isolation

```typescript
// Different projects maintain separate workflows
const aiProject = await callTool('create-workflow', {
  name: 'AI Research',
  project_scope: 'ai-research'
});

const webProject = await callTool('create-workflow', {
  name: 'Web Development',  
  project_scope: 'web-dev'
});

// Search only within specific project
const aiResults = await callTool('search-scratchpads', {
  query: '深度學習',
  // Searches only in ai-research workflows
});
```

### Integration with Claude Code

The MCP server integrates seamlessly with Claude Code workflows:

1. **Agent Collaboration**: Multiple agents can share context via workflows
2. **Context Persistence**: Important findings persist across conversations  
3. **Intelligent Search**: Chinese and English content searchable with proper tokenization
4. **Project Organization**: Logical grouping via workflow containers and project scopes
5. **Cross-Directory**: Works from any project directory via startup script

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Install dependencies**: `npm install`
4. **Build project**: `npm run build`
5. **Test startup script**: `./start-mcp.sh` (verify Chinese tokenization loads)
6. **Make changes and add tests**
7. **Run the test suite**: `npm test`
8. **Check code quality**: `npm run typecheck && npm run lint`
9. **Commit changes**: `git commit -m 'feat: add amazing feature'`
10. **Push to branch**: `git push origin feature/amazing-feature`
11. **Open a Pull Request**

### Development Standards

- All new features must include comprehensive tests
- Maintain >95% test coverage
- Follow TypeScript strict mode guidelines
- Use conventional commit messages
- Update documentation for API changes
- Test Chinese tokenization functionality if relevant
- Always use `start-mcp.sh` for manual testing

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Issues**: GitHub Issues for bug reports and feature requests
- **Documentation**: See inline code documentation and tests for examples
- **Performance**: Target <100ms search response times with FTS5
- **Chinese Support**: Enhanced with jieba tokenization via startup script

---

**Remember: Always use `./start-mcp.sh` to launch the MCP server. Direct execution of `dist/server.js` will cause path resolution and cross-directory compatibility issues.**