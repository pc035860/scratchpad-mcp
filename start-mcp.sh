#!/bin/bash

# Change to project directory to ensure correct paths
cd "$(dirname "$0")"

# Set environment variables (if needed)
export SCRATCHPAD_DB_PATH="${SCRATCHPAD_DB_PATH:-./scratchpad.db}"

# Start MCP server
node dist/server.js "$@"