/**
 * Server helper functions for type-safe MCP argument handling
 */

import type {
  CreateWorkflowArgs,
  CreateScratchpadArgs,
  GetScratchpadArgs,
  AppendScratchpadArgs,
  TailScratchpadArgs,
  ListScratchpadsArgs,
  SearchScratchpadsArgs,
  UpdateWorkflowStatusArgs,
  ListWorkflowsArgs,
  GetLatestActiveWorkflowArgs,
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
  
  if (obj['project_scope'] !== undefined) {
    if (typeof obj['project_scope'] !== 'string') {
      throw new Error('Invalid arguments: project_scope must be a string');
    }
    result.project_scope = obj['project_scope'];
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

/**
 * Validate UpdateWorkflowStatusArgs
 */
export function validateUpdateWorkflowStatusArgs(args: unknown): UpdateWorkflowStatusArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;
  
  if (typeof obj['workflow_id'] !== 'string') {
    throw new Error('Invalid arguments: workflow_id must be a string');
  }
  
  if (typeof obj['is_active'] !== 'boolean') {
    throw new Error('Invalid arguments: is_active must be a boolean');
  }
  
  return {
    workflow_id: obj['workflow_id'],
    is_active: obj['is_active'],
  };
}

/**
 * Validate ListWorkflowsArgs
 */
export function validateListWorkflowsArgs(args: unknown): ListWorkflowsArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;
  const result: ListWorkflowsArgs = {};
  
  if (obj['project_scope'] !== undefined) {
    if (typeof obj['project_scope'] !== 'string') {
      throw new Error('Invalid arguments: project_scope must be a string');
    }
    result.project_scope = obj['project_scope'];
  }
  
  return result;
}

/**
 * Validate GetLatestActiveWorkflowArgs
 */
export function validateGetLatestActiveWorkflowArgs(args: unknown): GetLatestActiveWorkflowArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;
  const result: GetLatestActiveWorkflowArgs = {};
  
  if (obj['project_scope'] !== undefined) {
    if (typeof obj['project_scope'] !== 'string') {
      throw new Error('Invalid arguments: project_scope must be a string');
    }
    result.project_scope = obj['project_scope'];
  }
  
  return result;
}

/**
 * Validate TailScratchpadArgs
 */
export function validateTailScratchpadArgs(args: unknown): TailScratchpadArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;
  
  if (typeof obj['id'] !== 'string') {
    throw new Error('Invalid arguments: id must be a string');
  }
  
  const result: TailScratchpadArgs = {
    id: obj['id'],
  };
  
  // Handle tail_size object structure (new simplified design)
  if (obj['tail_size'] !== undefined) {
    if (!obj['tail_size'] || typeof obj['tail_size'] !== 'object') {
      throw new Error('Invalid arguments: tail_size must be an object');
    }
    
    const tailSize = obj['tail_size'] as Record<string, unknown>;
    
    // Validate that only one of lines or chars is specified
    const hasLines = tailSize['lines'] !== undefined;
    const hasChars = tailSize['chars'] !== undefined;
    
    if (hasLines && hasChars) {
      throw new Error('Invalid arguments: tail_size must specify either lines OR chars, not both');
    }
    
    if (hasLines) {
      if (typeof tailSize['lines'] !== 'number' || !Number.isInteger(tailSize['lines']) || tailSize['lines'] < 1) {
        throw new Error('Invalid arguments: tail_size.lines must be a positive integer');
      }
      result.tail_size = { lines: tailSize['lines'] };
    } else if (hasChars) {
      if (typeof tailSize['chars'] !== 'number' || !Number.isInteger(tailSize['chars']) || tailSize['chars'] < 1) {
        throw new Error('Invalid arguments: tail_size.chars must be a positive integer');
      }
      result.tail_size = { chars: tailSize['chars'] };
    }
  }
  
  if (obj['include_content'] !== undefined) {
    if (typeof obj['include_content'] !== 'boolean') {
      throw new Error('Invalid arguments: include_content must be a boolean');
    }
    result.include_content = obj['include_content'];
  }
  
  if (obj['full_content'] !== undefined) {
    if (typeof obj['full_content'] !== 'boolean') {
      throw new Error('Invalid arguments: full_content must be a boolean');
    }
    result.full_content = obj['full_content'];
  }
  
  return result;
}