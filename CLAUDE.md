# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project's name is `scratchpad-mcp-v2` - use this for the graph-memory system.

**Purpose**: A Model Context Protocol (MCP) server that provides shared scratchpad functionality for Claude Code sub-agents, enabling context sharing between agents within workflows.

**Current Status**: ~85% complete - core functionality implemented, integration testing needed.

## Architecture

### Core Components
- **Database Layer**: SQLite with FTS5 full-text search (`src/database/`)
  - `ScratchpadDatabase.ts` - Core database operations
  - `schema.ts` - Table definitions and FTS5 configuration
  - `types.ts` - Database type definitions
- **MCP Tools**: 6 core tools (`src/tools/`)
  - Workflow management: `create-workflow`
  - Scratchpad CRUD: `create-scratchpad`, `get-scratchpad`, `append-scratchpad`
  - Search and listing: `list-scratchpads`, `search-scratchpads`
- **MCP Server**: Main entry point (`src/server.ts`)

### Key Technical Decisions
- **ESM modules**: Uses ES modules, not CommonJS
- **TypeScript strict mode**: Full type safety with strict configuration
- **SQLite WAL mode**: Write-Ahead Logging for better performance
- **FTS5 conditional**: Full-text search disabled in test environment to avoid virtual table issues

## Development Commands

### Building and Development
```bash
# Development with hot reload
npm run dev

# Build for production (outputs to dist/)
npm run build

# Clean build artifacts
npm run clean
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Database tests (currently implemented)
npm test -- tests/database.test.ts
```

### Code Quality
```bash
# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
```

## Project Structure

```
src/
├── server.ts                    # MCP server entry point
├── database/
│   ├── ScratchpadDatabase.ts    # Core database class
│   ├── schema.ts                # SQL schema and FTS5 setup
│   ├── types.ts                 # Database type definitions
│   └── index.ts                 # Database exports
└── tools/
    ├── workflow.ts              # Workflow management tools
    ├── scratchpad.ts            # Scratchpad CRUD tools
    ├── search.ts                # Search and listing tools
    ├── types.ts                 # Tool type definitions
    └── index.ts                 # Tool exports

tests/
└── database.test.ts             # Database layer tests (9/9 passing)
```

## Key Design Patterns

### Data Model
- **Workflows**: Top-level containers for organizing scratchpads
- **Scratchpads**: Content storage with full-text search capabilities
- **Size Limits**: 1MB per scratchpad, 50 scratchpads per workflow

### Error Handling
- Comprehensive parameter validation for all MCP tools
- Graceful fallback from FTS5 to LIKE search if needed
- Type-safe error responses following MCP protocol

### Performance Features
- FTS5 full-text search indexing
- SQLite WAL mode for concurrent access
- In-memory caching for frequently accessed data

## Running the MCP Server

The built server (`dist/server.js`) is executable and designed to run as an MCP server:

```bash
# After building
./dist/server.js

# Or via npm
npm run build && node dist/server.js
```

## Current Development Status

✅ **Completed**:
- Full database layer implementation with tests
- All 6 MCP tools implemented
- TypeScript configuration and build system
- Core functionality working

⏳ **In Progress/Needed**:
- Integration tests for MCP tools (high priority)
- Performance testing for FTS5 search (<100ms target)
- End-to-end MCP protocol testing

## Testing Strategy

### Database Layer
- Located in `tests/database.test.ts`
- All 9 tests passing
- Covers CRUD operations, search, and error handling

### Integration Testing (Needed)
- MCP tool parameter validation
- Full workflow scenarios
- Error condition handling

### Performance Testing (Needed)
- FTS5 search response time validation
- Large data volume testing (1MB scratchpads)
- Concurrent access testing

## Important Notes

### FTS5 Configuration
- FTS5 is conditionally enabled (disabled in test environment)
- Production deployments should verify SQLite FTS5 support
- Fallback to LIKE search available if FTS5 fails

### TypeScript Configuration
- Strict mode enabled with comprehensive type coverage
- ESM module system
- Node.js 18+ target

### Development Tools
- **Build**: tsup (zero-config, fast builds)
- **Test**: Vitest (fast, TypeScript-native)
- **Lint**: ESLint with TypeScript rules
- **Format**: Prettier

## MCP Protocol Integration

This server implements the Model Context Protocol for inter-agent communication. The built executable serves as a standalone MCP server that Claude Code agents can interact with via stdio communication.

### Tool Categories
1. **Workflow Management**: Creating and organizing work contexts
2. **Content Management**: CRUD operations on scratchpads
3. **Search & Discovery**: Finding relevant content across workflows

Each tool follows MCP protocol standards with proper parameter validation and error handling.