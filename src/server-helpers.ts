/**
 * Server helper functions for type-safe MCP argument handling
 */

import type {
  CreateWorkflowArgs,
  CreateScratchpadArgs,
  GetScratchpadArgs,
  AppendScratchpadArgs,
  ListScratchpadsArgs,
  SearchScratchpadsArgs,
} from './tools/index.js';

/**
 * Type guard and validator functions for MCP tool arguments
 */

export function validateCreateWorkflowArgs(args: unknown): CreateWorkflowArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;
  
  if (typeof obj['name'] !== 'string') {
    throw new Error('Invalid arguments: name must be a string');
  }

  const result: CreateWorkflowArgs = {
    name: obj['name'],
  };
  
  if (typeof obj['description'] === 'string') {
    result.description = obj['description'];
  }
  
  return result;
}

export function validateCreateScratchpadArgs(args: unknown): CreateScratchpadArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;
  
  if (typeof obj['workflow_id'] !== 'string') {
    throw new Error('Invalid arguments: workflow_id must be a string');
  }
  
  if (typeof obj['title'] !== 'string') {
    throw new Error('Invalid arguments: title must be a string');
  }
  
  if (typeof obj['content'] !== 'string') {
    throw new Error('Invalid arguments: content must be a string');
  }

  return {
    workflow_id: obj['workflow_id'],
    title: obj['title'],
    content: obj['content'],
  };
}

export function validateGetScratchpadArgs(args: unknown): GetScratchpadArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;
  
  if (typeof obj['id'] !== 'string') {
    throw new Error('Invalid arguments: id must be a string');
  }

  return {
    id: obj['id'],
  };
}

export function validateAppendScratchpadArgs(args: unknown): AppendScratchpadArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;
  
  if (typeof obj['id'] !== 'string') {
    throw new Error('Invalid arguments: id must be a string');
  }
  
  if (typeof obj['content'] !== 'string') {
    throw new Error('Invalid arguments: content must be a string');
  }

  return {
    id: obj['id'],
    content: obj['content'],
  };
}

export function validateListScratchpadsArgs(args: unknown): ListScratchpadsArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;
  
  if (typeof obj['workflow_id'] !== 'string') {
    throw new Error('Invalid arguments: workflow_id must be a string');
  }
  
  const result: ListScratchpadsArgs = {
    workflow_id: obj['workflow_id'],
  };
  
  if (obj['limit'] !== undefined) {
    if (typeof obj['limit'] !== 'number' || !Number.isInteger(obj['limit']) || obj['limit'] < 0) {
      throw new Error('Invalid arguments: limit must be a non-negative integer');
    }
    result.limit = obj['limit'];
  }
  
  if (obj['offset'] !== undefined) {
    if (typeof obj['offset'] !== 'number' || !Number.isInteger(obj['offset']) || obj['offset'] < 0) {
      throw new Error('Invalid arguments: offset must be a non-negative integer');
    }
    result.offset = obj['offset'];
  }

  return result;
}

export function validateSearchScratchpadsArgs(args: unknown): SearchScratchpadsArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;
  
  if (typeof obj['query'] !== 'string') {
    throw new Error('Invalid arguments: query must be a string');
  }
  
  const result: SearchScratchpadsArgs = {
    query: obj['query'],
  };
  
  if (obj['workflow_id'] !== undefined) {
    if (typeof obj['workflow_id'] !== 'string') {
      throw new Error('Invalid arguments: workflow_id must be a string');
    }
    result.workflow_id = obj['workflow_id'];
  }
  
  if (obj['limit'] !== undefined) {
    if (typeof obj['limit'] !== 'number' || !Number.isInteger(obj['limit']) || obj['limit'] < 0) {
      throw new Error('Invalid arguments: limit must be a non-negative integer');
    }
    result.limit = obj['limit'];
  }

  return result;
}

/**
 * Error handling wrapper for MCP tool execution
 */
export function handleToolError(error: unknown, toolName: string): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  return {
    content: [
      {
        type: 'text',
        text: `Error in ${toolName}: ${errorMessage}`,
      },
    ],
    isError: true,
  };
}

/**
 * Success response wrapper for MCP tools
 */
export function createToolResponse(result: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}