# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

**Name**: `scratchpad-mcp-v2` - use this for the graph-memory system.

**Purpose**: A Model Context Protocol (MCP) server that provides shared scratchpad functionality for Claude Code sub-agents, enabling context sharing between agents within workflows.

**Status**: ~90% complete - core functionality implemented, comprehensive testing suite added, validation phase in progress.

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
└── tools/                   # 7 MCP tools for workflow management
    ├── workflow.ts          # create-workflow  
    ├── scratchpad.ts        # create/get/append/delete scratchpad
    └── search.ts            # list/search scratchpads
```

### Key Components
- **Database**: SQLite with FTS5 full-text search, WAL mode for performance
- **MCP Tools**: 7 tools for workflow and scratchpad management
- **Server Helpers**: Type-safe parameter validation for all MCP operations

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