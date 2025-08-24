# Scratchpad MCP v2

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-FTS5-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A **Model Context Protocol (MCP) server** that provides shared scratchpad functionality for Claude Code sub-agents, enabling seamless context sharing and collaboration within workflows.

## ✨ Key Features

- **🔄 Context Sharing**: Enable sub-agents to share context and collaborate across workflows
- **🔍 Full-Text Search**: Powerful FTS5-powered search with intelligent LIKE fallback
- **📁 Workflow Organization**: Organize scratchpads into logical workflows
- **⚡ High Performance**: SQLite WAL mode with <100ms search response times
- **🛡️ Type Safety**: Full TypeScript with strict mode and comprehensive validation
- **📊 Size Management**: Support for 1MB scratchpads, 50 scratchpads per workflow
- **🧪 Comprehensive Testing**: 50+ tests covering database, tools, and performance

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
```

### Running as MCP Server

```bash
# Production mode (after building)
./dist/server.js

# Development mode with hot reload
npm run dev
```

### Environment Configuration

```bash
# Optional: Set custom database path
export SCRATCHPAD_DB_PATH="./my-scratchpad.db"
```

## 🇨🇳 Chinese Text Search Support (Optional)

For enhanced Chinese word segmentation and Pinyin search, you can install the `wangfenjin/simple` SQLite extension:

### Installation

1. **Create extensions directory:**
   ```bash
   mkdir extensions
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

3. **Or use the installation script:**
   ```bash
   # Run the automated installation script
   chmod +x scripts/install-chinese-support.sh
   ./scripts/install-chinese-support.sh
   ```

4. **Verify installation:**
   ```bash
   # Check if files are in place
   ls -la extensions/
   # Should show: libsimple.dylib (or .so) and dict/ directory
   ```

### Features
- **Chinese word segmentation**: Improved search accuracy for Chinese text
- **Pinyin search**: Search Chinese content using Pinyin (e.g., "zhoujielun" → "周杰倫")
- **Automatic fallback**: Falls back to standard FTS5 search if extension not available
- **Multi-tier search**: simple tokenizer → standard FTS5 → LIKE search

### Notes
- The extension is completely optional - the server works without it
- If the extension fails to load, search will automatically fall back to standard FTS5
- Dictionary files (~2MB) improve segmentation accuracy for Chinese text
- Supports both simplified and traditional Chinese characters

## 🔗 Claude Code Integration

### Prerequisites

- Node.js 18.0.0 or higher
- Claude Code CLI installed and configured

### Method 1: CLI Installation (Recommended)

```bash
# Build the project first
npm run build

# Install to local scope (personal use)
claude mcp add scratchpad-mcp-v2 -- node ./dist/server.js

# Or install to project scope (team sharing)
claude mcp add scratchpad-mcp-v2 --scope project -- node ./dist/server.js
```

### Method 2: Manual Configuration

Create or edit your MCP configuration file:

**Project-level configuration**: Project root `.mcp.json` (recommended)
```json
{
  "mcpServers": {
    "scratchpad-mcp-v2": {
      "command": "node",
      "args": ["./dist/server.js"],
      "env": {
        "SCRATCHPAD_DB_PATH": "./scratchpad.db"
      }
    }
  }
}
```

### Verification

```bash
# Check MCP server status
claude mcp list

# View server details
claude mcp get scratchpad-mcp-v2

# Restart Claude Code to apply configuration
```

### Available MCP Tools

Once installed, Claude Code can use these 7 MCP tools:

- `create-workflow` - Create new workflow containers
- `list-workflows` - List all available workflows  
- `create-scratchpad` - Create scratchpads within workflows
- `get-scratchpad` - Retrieve scratchpad content
- `append-scratchpad` - Append content to existing scratchpads
- `list-scratchpads` - List scratchpads in a workflow
- `search-scratchpads` - Full-text search across scratchpad content

### Usage Example

```typescript
// Typical workflow in Claude Code
const workflow = await mcp.callTool('create-workflow', {
  name: 'AI Research Project',
  description: 'Collaborative research notes and findings'
});

const scratchpad = await mcp.callTool('create-scratchpad', {
  workflow_id: workflow.id,
  title: 'Model Architecture Notes',
  content: 'Initial transformer research findings...'
});

const results = await mcp.callTool('search-scratchpads', {
  query: 'transformer architecture',
  limit: 10
});
```

### Troubleshooting

**Issue: MCP server won't start**
- Check Node.js version is 18+
- Ensure project is built correctly: `npm run build`
- Verify file paths and permissions

**Issue: Configuration file invalid**
- Validate JSON syntax using a JSON validator
- Confirm configuration file location is correct
- Restart Claude Code after configuration changes

**Issue: Tools not available**
- Use `claude mcp list` to check server status
- Ensure server is running and responding
- Verify Claude Code has reloaded the configuration

### Best Practices

- **Recommended approach**: Use CLI installation (`claude mcp add`) for simplicity
- **Team collaboration**: Include `.mcp.json` in version control for shared setups
- **Cross-project tools**: Install with `--scope user` flag for global availability
- **Security**: Regularly review and update MCP server configurations

## 🛠️ MCP Tools API

### Workflow Management

#### `create-workflow`
Create a new workflow container for organizing scratchpads.

```typescript
{
  name: string;           // Workflow name (required)
  description?: string;   // Optional description
}
```

#### `list-workflows`
List all available workflows with their metadata.

```typescript
{
  // No parameters required
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
Search scratchpads using full-text search with intelligent ranking.

```typescript
{
  query: string;          // Search query (required)
  workflow_id?: string;   // Limit to specific workflow (optional)
  limit?: number;         // Max results (default: 20, max: 50)
}
```

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

tests/
├── database.test.ts          # Database layer tests (9/9 passing)
├── mcp-tools.test.ts         # MCP tools integration tests
└── performance.test.ts       # Performance benchmarks
```

### Testing Strategy

#### Database Layer Testing
```bash
# Run database-specific tests
npm test -- tests/database.test.ts
```
- ✅ CRUD operations validation
- ✅ FTS5 search functionality  
- ✅ Error handling and edge cases

#### MCP Tools Integration Testing
```bash
# Run MCP tools tests
npm test -- tests/mcp-tools.test.ts
```
- ✅ Parameter validation for all 7 tools
- ✅ Full workflow scenario coverage
- ✅ MCP protocol compliance
- ✅ Error condition handling

#### Performance Testing
```bash
# Run performance benchmarks
npm test -- tests/performance.test.ts
```
- ✅ FTS5 search response time (<100ms target)
- ✅ Large content handling (1MB scratchpads)
- ✅ Concurrent access patterns

### Code Quality Standards

- **TypeScript Strict Mode**: Full type safety with zero `any` types
- **ESLint + Prettier**: Consistent code formatting and linting
- **Comprehensive Testing**: >95% test coverage across all layers
- **Performance Targets**: <100ms search, 1MB content support

## 📊 Technical Specifications

### Architecture

- **Server Layer**: MCP protocol implementation with stdio communication
- **Tools Layer**: 7 core tools with comprehensive parameter validation
- **Database Layer**: SQLite with FTS5 full-text search and WAL mode

### Performance Characteristics

| Metric | Target | Implementation |
|--------|---------|----------------|
| Search Response | <100ms | FTS5 indexing with prepared statements |
| Content Limit | 1MB per scratchpad | Validated at tool level |
| Workflow Capacity | 50 scratchpads | Enforced by database constraints |
| Concurrent Access | Thread-safe | SQLite WAL mode |

### Data Model

```
workflows
├── id (primary key)
├── name
├── description
└── created_at

scratchpads
├── id (primary key)  
├── workflow_id (foreign key)
├── title
├── content
├── size_bytes
├── created_at
└── updated_at

scratchpads_fts (FTS5 virtual table)
├── title
└── content
```

### Environment Requirements

- **Node.js**: 18.0.0 or higher
- **SQLite**: Version with FTS5 support
- **Memory**: ~50MB typical usage
- **Storage**: Varies by content (1MB per scratchpad limit)

### Dependencies

#### Core Dependencies
- `@modelcontextprotocol/sdk`: ^1.17.4 - MCP protocol implementation
- `better-sqlite3`: ^12.2.0 - High-performance SQLite driver

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
- **FTS5 Indexing**: Full-text search with automatic fallback
- **Prepared Statements**: Efficient query execution
- **Connection Pooling**: Single connection with proper cleanup

### FTS5 Configuration

- **Conditional Enable**: Automatically disabled in test environments
- **Fallback Strategy**: LIKE-based search if FTS5 unavailable  
- **Index Fields**: Both title and content indexed
- **Search Ranking**: Relevance-based result ordering

## 📋 Usage Examples

### Basic Workflow

```typescript
// 1. Create a workflow
const workflow = await callTool('create-workflow', {
  name: 'ML Research Project',
  description: 'Research notes and experiments'
});

// 2. Create scratchpads
const scratchpad = await callTool('create-scratchpad', {
  workflow_id: workflow.id,
  title: 'Model Architecture Notes',
  content: 'Initial transformer architecture research...'
});

// 3. Search across content
const results = await callTool('search-scratchpads', {
  query: 'transformer architecture',
  limit: 10
});

// 4. Append to existing scratchpad
await callTool('append-scratchpad', {
  id: scratchpad.id,
  content: '\n\nAdditional findings from paper XYZ...'
});
```

### Integration with Claude Code

The MCP server integrates seamlessly with Claude Code workflows:

1. **Agent Collaboration**: Multiple agents can share context via workflows
2. **Context Persistence**: Important findings persist across conversations  
3. **Searchable History**: Full-text search across all stored content
4. **Organized Workspace**: Logical grouping via workflow containers

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Install dependencies**: `npm install`
4. **Make changes and add tests**
5. **Run the test suite**: `npm test`
6. **Check code quality**: `npm run typecheck && npm run lint`
7. **Commit changes**: `git commit -m 'feat: add amazing feature'`
8. **Push to branch**: `git push origin feature/amazing-feature`
9. **Open a Pull Request**

### Development Standards

- All new features must include comprehensive tests
- Maintain >95% test coverage
- Follow TypeScript strict mode guidelines
- Use conventional commit messages
- Update documentation for API changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Issues**: GitHub Issues for bug reports and feature requests
- **Documentation**: See inline code documentation and tests for examples
- **Performance**: Target <100ms search response times with FTS5
