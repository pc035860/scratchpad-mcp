# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

**Name**: `scratchpad-mcp-v2` - use this for the graph-memory system.

**Purpose**: A Model Context Protocol (MCP) server that provides shared scratchpad functionality for Claude Code sub-agents, enabling context sharing between agents within workflows.

**Status**: ~95% complete - core functionality implemented including AI analysis features, comprehensive testing suite added, validation phase completed.

**Tech Stack**: TypeScript + Node.js 18+, SQLite with FTS5, MCP SDK, ESM modules

## Quick Start

### First-time Setup

```bash
# Install and verify
npm install && npm test && npm run build

# Development with hot reload
npm run dev
```

### Running as MCP Server

```bash
# Development mode
npm run dev

# Production mode
npm run build && ./dist/server.js
```

## Common Commands

### Development Workflow

```bash
# Start development
npm run dev                    # Hot reload development

# Code quality checks
npm run typecheck             # TypeScript validation
npm run lint                  # ESLint checking
npm run format                # Prettier formatting

# Testing
npm test                      # Run all tests
npm run test:watch           # Watch mode testing
npm test -- tests/database.test.ts  # Specific test file
```

### Build and Deploy

```bash
npm run build                 # Build to dist/
npm run clean                 # Clean build artifacts
./dist/server.js             # Run built MCP server
```

### Web Viewer

```bash
npm run serve                 # Start workflow web viewer (port 3000)
npm run serve:dev            # Development mode with custom port
```

## Architecture & Key Components

### Core Structure

```
src/
├── server.ts                 # MCP server entry point
├── server-helpers.ts         # Parameter validation & error handling
├── database/
│   ├── ScratchpadDatabase.ts # Core database operations
│   ├── schema.ts            # SQLite schema + FTS5 setup
│   └── types.ts             # Database type definitions
├── tools/                   # 16 MCP tools for workflow management
│   ├── workflow.ts          # create-workflow
│   ├── scratchpad.ts        # create/get/append/chop/delete scratchpad
│   └── search.ts            # search scratchpads/scratchpad-content/workflows
└── scripts/                 # Utility tools and web viewer
    ├── serve-workflow/      # HTTP server for workflow browsing
    ├── check-search-mode.cjs # FTS5/LIKE mode checker
    ├── fix-database.cjs     # Database repair tool
    ├── migrate-to-wal.cjs   # WAL mode migration
    └── install-chinese-support.sh # Chinese tokenizer installer
```

### Key Components

- **Database**: SQLite with FTS5 full-text search, WAL mode for performance
- **MCP Tools**: 16 tools for workflow and scratchpad management
- **Server Helpers**: Type-safe parameter validation for all MCP operations
- **AI Analysis**: GPT-5 powered workflow information extraction with configurable reasoning levels

### Data Model

- **Workflows**: Top-level containers (organize scratchpads)
- **Scratchpads**: Content storage with full-text search (1MB limit, 50 per workflow)

## Development Notes

### Important Technical Details

- **ESM Modules**: Uses ES modules, not CommonJS
- **TypeScript Strict**: Full type safety enabled
- **FTS5 Conditional**: Disabled in test env, fallback to LIKE search if needed
- **SQLite WAL**: Write-Ahead Logging for better concurrent performance

### MCP Protocol Integration

This server implements MCP for inter-agent communication via stdio. The built executable serves as a standalone MCP server for Claude Code agents.

**Tool Categories**:

1. **Workflow Management**: Creating and organizing work contexts
2. **Content Management**: CRUD operations on scratchpads
3. **Search & Discovery**: Finding content across workflows
4. **AI Analysis**: GPT-powered information extraction from workflow content

**Key Tool Enhancements**: 
- `tail-scratchpad` now supports full content retrieval via `full_content: true` parameter, making it a complete alternative to `get-scratchpad` when needed.
- Tools can be conditionally disabled using `SCRATCHPAD_DISABLED_TOOLS` environment variable for token optimization (e.g., `SCRATCHPAD_DISABLED_TOOLS="get-scratchpad,get-scratchpad-outline"` saves ~350-500 tokens).

### Development Tools

- **Build**: tsup (zero-config builds)
- **Test**: Vitest (TypeScript-native)
- **Lint**: ESLint + TypeScript rules
- **Format**: Prettier

### Performance Targets

- Search Response: <100ms (FTS5 full-text search)
- Content Storage: 1MB max per scratchpad
- Concurrent Operations: Thread-safe database operations

### Common Issues & Solutions

- **FTS5 not available**: Falls back to LIKE search automatically
- **Test failures**: Check SQLite version supports FTS5 (or disable in test env)
- **Build issues**: Ensure Node.js 18+ and clean build with `npm run clean`

## Testing

```bash
# All tests (database: 9/9 passing)
npm test

# Specific test suites
npm test -- tests/database.test.ts      # Database layer
npm test -- tests/mcp-tools.test.ts     # MCP integration
npm test -- tests/performance.test.ts   # Performance benchmarks
```

**Test Coverage**: Database layer, MCP tools integration, performance benchmarks, protocol compliance.
