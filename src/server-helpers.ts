/**
 * Server helper functions for type-safe MCP argument handling
 */

import type {
  CreateWorkflowArgs,
  CreateScratchpadArgs,
  GetScratchpadArgs,
  GetScratchpadOutlineArgs,
  AppendScratchpadArgs,
  TailScratchpadArgs,
  ChopScratchpadArgs,
  ListScratchpadsArgs,
  SearchScratchpadsArgs,
  SearchScratchpadContentArgs,
  UpdateWorkflowStatusArgs,
  ListWorkflowsArgs,
  GetLatestActiveWorkflowArgs,
  ExtractWorkflowInfoArgs,
} from './tools/index.js';

import type { EnhancedUpdateScratchpadArgs, EditMode } from './database/types.js';

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

  const result: CreateScratchpadArgs = {
    workflow_id: obj['workflow_id'],
    title: obj['title'],
    content: obj['content'],
  };

  if (obj['include_content'] !== undefined) {
    if (typeof obj['include_content'] !== 'boolean') {
      throw new Error('Invalid arguments: include_content must be a boolean');
    }
    result.include_content = obj['include_content'];
  }

  return result;
}

export function validateRangeParameterConflict(args: Record<string, unknown>, useServerPrefix = true): void {
  const rangeParams = [args['line_range'], args['line_context']].filter(param => param !== undefined);
  if (rangeParams.length > 1) {
    const message = useServerPrefix 
      ? 'Invalid arguments: only one range parameter can be specified: line_range or line_context'
      : 'Only one range parameter can be specified: line_range or line_context';
    throw new Error(message);
  }
}

export function validateGetScratchpadArgs(args: unknown): GetScratchpadArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;

  if (typeof obj['id'] !== 'string') {
    throw new Error('Invalid arguments: id must be a string');
  }

  const result: GetScratchpadArgs = {
    id: obj['id'],
  };

  // Validate range parameters (only one can be specified)
  validateRangeParameterConflict(obj);

  // Validate line_range parameter
  if (obj['line_range'] !== undefined) {
    if (!obj['line_range'] || typeof obj['line_range'] !== 'object') {
      throw new Error('Invalid arguments: line_range must be an object');
    }
    const lineRange = obj['line_range'] as Record<string, unknown>;
    
    if (typeof lineRange['start'] !== 'number' || !Number.isInteger(lineRange['start']) || lineRange['start'] < 1) {
      throw new Error('Invalid arguments: line_range.start must be a positive integer >= 1');
    }
    
    const lineRangeResult: { start: number; end?: number } = { start: lineRange['start'] };
    
    if (lineRange['end'] !== undefined) {
      if (typeof lineRange['end'] !== 'number' || !Number.isInteger(lineRange['end']) || lineRange['end'] < 1) {
        throw new Error('Invalid arguments: line_range.end must be a positive integer >= 1');
      }
      if (lineRange['end'] < lineRange['start']) {
        throw new Error('Invalid arguments: line_range.end must be >= line_range.start');
      }
      lineRangeResult.end = lineRange['end'];
    }
    
    result.line_range = lineRangeResult;
  }

  // Validate line_context parameter
  if (obj['line_context'] !== undefined) {
    if (!obj['line_context'] || typeof obj['line_context'] !== 'object') {
      throw new Error('Invalid arguments: line_context must be an object');
    }
    const lineContext = obj['line_context'] as Record<string, unknown>;
    
    if (typeof lineContext['line'] !== 'number' || !Number.isInteger(lineContext['line']) || lineContext['line'] < 1) {
      throw new Error('Invalid arguments: line_context.line must be a positive integer >= 1');
    }
    
    const lineContextResult: { line: number; before?: number; after?: number; include_block?: boolean } = { 
      line: lineContext['line'] 
    };
    
    if (lineContext['before'] !== undefined) {
      if (typeof lineContext['before'] !== 'number' || !Number.isInteger(lineContext['before']) || lineContext['before'] < 0) {
        throw new Error('Invalid arguments: line_context.before must be a non-negative integer');
      }
      lineContextResult.before = lineContext['before'];
    }
    
    if (lineContext['after'] !== undefined) {
      if (typeof lineContext['after'] !== 'number' || !Number.isInteger(lineContext['after']) || lineContext['after'] < 0) {
        throw new Error('Invalid arguments: line_context.after must be a non-negative integer');
      }
      lineContextResult.after = lineContext['after'];
    }
    
    if (lineContext['include_block'] !== undefined) {
      if (typeof lineContext['include_block'] !== 'boolean') {
        throw new Error('Invalid arguments: line_context.include_block must be a boolean');
      }
      lineContextResult.include_block = lineContext['include_block'];
    }
    
    result.line_context = lineContextResult;
  }

  if (obj['max_content_chars'] !== undefined) {
    if (
      typeof obj['max_content_chars'] !== 'number' ||
      !Number.isInteger(obj['max_content_chars']) ||
      obj['max_content_chars'] < 1
    ) {
      throw new Error('Invalid arguments: max_content_chars must be a positive integer');
    }
    result.max_content_chars = obj['max_content_chars'];
  }

  if (obj['include_content'] !== undefined) {
    if (typeof obj['include_content'] !== 'boolean') {
      throw new Error('Invalid arguments: include_content must be a boolean');
    }
    result.include_content = obj['include_content'];
  }

  if (obj['preview_mode'] !== undefined) {
    if (typeof obj['preview_mode'] !== 'boolean') {
      throw new Error('Invalid arguments: preview_mode must be a boolean');
    }
    result.preview_mode = obj['preview_mode'];
  }

  return result;
}

export function validateGetScratchpadOutlineArgs(args: unknown): GetScratchpadOutlineArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;

  if (typeof obj['id'] !== 'string') {
    throw new Error('Invalid arguments: id must be a string');
  }

  const result: GetScratchpadOutlineArgs = {
    id: obj['id'],
  };

  if (obj['max_depth'] !== undefined) {
    if (typeof obj['max_depth'] !== 'number' || !Number.isInteger(obj['max_depth']) || obj['max_depth'] < 1 || obj['max_depth'] > 6) {
      throw new Error('Invalid arguments: max_depth must be an integer between 1 and 6');
    }
    result.max_depth = obj['max_depth'];
  }

  if (obj['include_line_numbers'] !== undefined) {
    if (typeof obj['include_line_numbers'] !== 'boolean') {
      throw new Error('Invalid arguments: include_line_numbers must be a boolean');
    }
    result.include_line_numbers = obj['include_line_numbers'];
  }

  if (obj['include_content_preview'] !== undefined) {
    if (typeof obj['include_content_preview'] !== 'boolean') {
      throw new Error('Invalid arguments: include_content_preview must be a boolean');
    }
    result.include_content_preview = obj['include_content_preview'];
  }

  return result;
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

  const result: AppendScratchpadArgs = {
    id: obj['id'],
    content: obj['content'],
  };

  if (obj['include_content'] !== undefined) {
    if (typeof obj['include_content'] !== 'boolean') {
      throw new Error('Invalid arguments: include_content must be a boolean');
    }
    result.include_content = obj['include_content'];
  }

  return result;
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
    if (
      typeof obj['offset'] !== 'number' ||
      !Number.isInteger(obj['offset']) ||
      obj['offset'] < 0
    ) {
      throw new Error('Invalid arguments: offset must be a non-negative integer');
    }
    result.offset = obj['offset'];
  }

  if (obj['max_content_chars'] !== undefined) {
    if (
      typeof obj['max_content_chars'] !== 'number' ||
      !Number.isInteger(obj['max_content_chars']) ||
      obj['max_content_chars'] < 1
    ) {
      throw new Error('Invalid arguments: max_content_chars must be a positive integer');
    }
    result.max_content_chars = obj['max_content_chars'];
  }

  if (obj['include_content'] !== undefined) {
    if (typeof obj['include_content'] !== 'boolean') {
      throw new Error('Invalid arguments: include_content must be a boolean');
    }
    result.include_content = obj['include_content'];
  }

  if (obj['preview_mode'] !== undefined) {
    if (typeof obj['preview_mode'] !== 'boolean') {
      throw new Error('Invalid arguments: preview_mode must be a boolean');
    }
    result.preview_mode = obj['preview_mode'];
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

  if (typeof obj['workflow_id'] !== 'string') {
    throw new Error('Invalid arguments: workflow_id must be a string');
  }

  const result: SearchScratchpadsArgs = {
    query: obj['query'],
    workflow_id: obj['workflow_id'],
  };

  if (obj['limit'] !== undefined) {
    if (typeof obj['limit'] !== 'number' || !Number.isInteger(obj['limit']) || obj['limit'] < 0) {
      throw new Error('Invalid arguments: limit must be a non-negative integer');
    }
    result.limit = obj['limit'];
  }

  if (obj['offset'] !== undefined) {
    if (
      typeof obj['offset'] !== 'number' ||
      !Number.isInteger(obj['offset']) ||
      obj['offset'] < 0
    ) {
      throw new Error('Invalid arguments: offset must be a non-negative integer');
    }
    result.offset = obj['offset'];
  }

  if (obj['max_content_chars'] !== undefined) {
    if (
      typeof obj['max_content_chars'] !== 'number' ||
      !Number.isInteger(obj['max_content_chars']) ||
      obj['max_content_chars'] < 1
    ) {
      throw new Error('Invalid arguments: max_content_chars must be a positive integer');
    }
    result.max_content_chars = obj['max_content_chars'];
  }

  if (obj['include_content'] !== undefined) {
    if (typeof obj['include_content'] !== 'boolean') {
      throw new Error('Invalid arguments: include_content must be a boolean');
    }
    result.include_content = obj['include_content'];
  }

  if (obj['preview_mode'] !== undefined) {
    if (typeof obj['preview_mode'] !== 'boolean') {
      throw new Error('Invalid arguments: preview_mode must be a boolean');
    }
    result.preview_mode = obj['preview_mode'];
  }

  if (obj['useJieba'] !== undefined) {
    if (typeof obj['useJieba'] !== 'boolean') {
      throw new Error('Invalid arguments: useJieba must be a boolean');
    }
    result.useJieba = obj['useJieba'];
  }

  // Context lines parameters
  if (obj['context_lines_before'] !== undefined) {
    if (
      typeof obj['context_lines_before'] !== 'number' ||
      !Number.isInteger(obj['context_lines_before']) ||
      obj['context_lines_before'] < 0 ||
      obj['context_lines_before'] > 50
    ) {
      throw new Error(
        'Invalid arguments: context_lines_before must be an integer between 0 and 50'
      );
    }
    result.context_lines_before = obj['context_lines_before'];
  }

  if (obj['context_lines_after'] !== undefined) {
    if (
      typeof obj['context_lines_after'] !== 'number' ||
      !Number.isInteger(obj['context_lines_after']) ||
      obj['context_lines_after'] < 0 ||
      obj['context_lines_after'] > 50
    ) {
      throw new Error('Invalid arguments: context_lines_after must be an integer between 0 and 50');
    }
    result.context_lines_after = obj['context_lines_after'];
  }

  if (obj['context_lines'] !== undefined) {
    if (
      typeof obj['context_lines'] !== 'number' ||
      !Number.isInteger(obj['context_lines']) ||
      obj['context_lines'] < 0 ||
      obj['context_lines'] > 50
    ) {
      throw new Error('Invalid arguments: context_lines must be an integer between 0 and 50');
    }
    result.context_lines = obj['context_lines'];
  }

  if (obj['max_context_matches'] !== undefined) {
    if (
      typeof obj['max_context_matches'] !== 'number' ||
      !Number.isInteger(obj['max_context_matches']) ||
      obj['max_context_matches'] < 1 ||
      obj['max_context_matches'] > 20
    ) {
      throw new Error('Invalid arguments: max_context_matches must be an integer between 1 and 20');
    }
    result.max_context_matches = obj['max_context_matches'];
  }

  if (obj['merge_context'] !== undefined) {
    if (typeof obj['merge_context'] !== 'boolean') {
      throw new Error('Invalid arguments: merge_context must be a boolean');
    }
    result.merge_context = obj['merge_context'];
  }

  if (obj['show_line_numbers'] !== undefined) {
    if (typeof obj['show_line_numbers'] !== 'boolean') {
      throw new Error('Invalid arguments: show_line_numbers must be a boolean');
    }
    result.show_line_numbers = obj['show_line_numbers'];
  }

  return result;
}

/**
 * Error handling wrapper for MCP tool execution
 */
export function handleToolError(
  error: unknown,
  toolName: string
): { content: Array<{ type: 'text'; text: string }>; isError: true } {
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
export function createToolResponse(result: unknown): {
  content: Array<{ type: 'text'; text: string }>;
} {
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

  if (obj['limit'] !== undefined) {
    if (typeof obj['limit'] !== 'number' || !Number.isInteger(obj['limit']) || obj['limit'] < 0) {
      throw new Error('Invalid arguments: limit must be a non-negative integer');
    }
    result.limit = obj['limit'];
  }

  if (obj['offset'] !== undefined) {
    if (
      typeof obj['offset'] !== 'number' ||
      !Number.isInteger(obj['offset']) ||
      obj['offset'] < 0
    ) {
      throw new Error('Invalid arguments: offset must be a non-negative integer');
    }
    result.offset = obj['offset'];
  }

  if (obj['max_content_chars'] !== undefined) {
    if (
      typeof obj['max_content_chars'] !== 'number' ||
      !Number.isInteger(obj['max_content_chars']) ||
      obj['max_content_chars'] < 1
    ) {
      throw new Error('Invalid arguments: max_content_chars must be a positive integer');
    }
    result.max_content_chars = obj['max_content_chars'];
  }

  if (obj['include_content'] !== undefined) {
    if (typeof obj['include_content'] !== 'boolean') {
      throw new Error('Invalid arguments: include_content must be a boolean');
    }
    result.include_content = obj['include_content'];
  }

  if (obj['preview_mode'] !== undefined) {
    if (typeof obj['preview_mode'] !== 'boolean') {
      throw new Error('Invalid arguments: preview_mode must be a boolean');
    }
    result.preview_mode = obj['preview_mode'];
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

  if (typeof obj['project_scope'] !== 'string') {
    throw new Error('Invalid arguments: project_scope must be a string');
  }

  const result: GetLatestActiveWorkflowArgs = {
    project_scope: obj['project_scope'],
  };

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

    // Validate that only one of lines, chars, or blocks is specified
    const hasLines = tailSize['lines'] !== undefined;
    const hasChars = tailSize['chars'] !== undefined;
    const hasBlocks = tailSize['blocks'] !== undefined;

    const specifiedCount = [hasLines, hasChars, hasBlocks].filter(Boolean).length;
    if (specifiedCount > 1) {
      throw new Error(
        'Invalid arguments: tail_size must specify either lines OR chars OR blocks, not multiple'
      );
    }

    if (hasLines) {
      if (
        typeof tailSize['lines'] !== 'number' ||
        !Number.isInteger(tailSize['lines']) ||
        tailSize['lines'] < 1
      ) {
        throw new Error('Invalid arguments: tail_size.lines must be a positive integer');
      }
      result.tail_size = { lines: tailSize['lines'] };
    } else if (hasChars) {
      if (
        typeof tailSize['chars'] !== 'number' ||
        !Number.isInteger(tailSize['chars']) ||
        tailSize['chars'] < 1
      ) {
        throw new Error('Invalid arguments: tail_size.chars must be a positive integer');
      }
      result.tail_size = { chars: tailSize['chars'] };
    } else if (hasBlocks) {
      if (
        typeof tailSize['blocks'] !== 'number' ||
        !Number.isInteger(tailSize['blocks']) ||
        tailSize['blocks'] < 1
      ) {
        throw new Error('Invalid arguments: tail_size.blocks must be a positive integer');
      }
      result.tail_size = { blocks: tailSize['blocks'] };
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

/**
 * Validate ChopScratchpadArgs
 */
export function validateChopScratchpadArgs(args: unknown): ChopScratchpadArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;

  if (typeof obj['id'] !== 'string') {
    throw new Error('Invalid arguments: id must be a string');
  }

  const result: ChopScratchpadArgs = {
    id: obj['id'],
  };

  if (obj['lines'] !== undefined) {
    if (typeof obj['lines'] !== 'number' || !Number.isInteger(obj['lines']) || obj['lines'] < 1) {
      throw new Error('Invalid arguments: lines must be a positive integer');
    }
    result.lines = obj['lines'];
  }

  if (obj['blocks'] !== undefined) {
    if (
      typeof obj['blocks'] !== 'number' ||
      !Number.isInteger(obj['blocks']) ||
      obj['blocks'] < 1
    ) {
      throw new Error('Invalid arguments: blocks must be a positive integer');
    }
    result.blocks = obj['blocks'];
  }

  return result;
}

export function validateExtractWorkflowInfoArgs(args: unknown): ExtractWorkflowInfoArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;

  if (typeof obj['workflow_id'] !== 'string') {
    throw new Error('Invalid arguments: workflow_id must be a string');
  }

  if (typeof obj['extraction_prompt'] !== 'string') {
    throw new Error('Invalid arguments: extraction_prompt must be a string');
  }

  const result: ExtractWorkflowInfoArgs = {
    workflow_id: obj['workflow_id'],
    extraction_prompt: obj['extraction_prompt'],
  };

  if (obj['model'] !== undefined) {
    if (typeof obj['model'] !== 'string') {
      throw new Error('Invalid arguments: model must be a string');
    }
    result.model = obj['model'];
  }

  if (obj['reasoning_effort'] !== undefined) {
    if (typeof obj['reasoning_effort'] !== 'string') {
      throw new Error('Invalid arguments: reasoning_effort must be a string');
    }
    const validEfforts = ['minimal', 'low', 'medium', 'high'];
    if (!validEfforts.includes(obj['reasoning_effort'])) {
      throw new Error(
        `Invalid arguments: reasoning_effort must be one of: ${validEfforts.join(', ')}`
      );
    }
    result.reasoning_effort = obj['reasoning_effort'] as 'minimal' | 'low' | 'medium' | 'high';
  }

  return result;
}

/**
 * Enhanced Update Scratchpad Arguments Validator
 * 增強型編輯工具參數驗證器，支援四種模式的條件驗證
 */
export function validateEnhancedUpdateScratchpadArgs(args: unknown): EnhancedUpdateScratchpadArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;

  // Basic parameter validation
  if (typeof obj['id'] !== 'string' || obj['id'].trim().length === 0) {
    throw new Error('Invalid arguments: id is required and must be a non-empty string');
  }

  if (typeof obj['mode'] !== 'string') {
    throw new Error('Invalid arguments: mode is required and must be a string');
  }

  // Validate edit mode
  const validModes: EditMode[] = ['replace', 'insert_at_line', 'replace_lines', 'append_section'];
  if (!validModes.includes(obj['mode'] as EditMode)) {
    throw new Error(
      `Invalid arguments: mode must be one of: ${validModes.join(', ')}. Got: ${obj['mode']}`
    );
  }

  const mode = obj['mode'] as EditMode;

  if (typeof obj['content'] !== 'string') {
    throw new Error('Invalid arguments: content is required and must be a string');
  }

  // Optional include_content validation
  if (obj['include_content'] !== undefined && typeof obj['include_content'] !== 'boolean') {
    throw new Error('Invalid arguments: include_content must be a boolean if provided');
  }

  const result: EnhancedUpdateScratchpadArgs = {
    id: obj['id'].trim(),
    mode,
    content: obj['content'],
    ...(obj['include_content'] !== undefined && {
      include_content: obj['include_content'] as boolean,
    }),
  };

  // Mode-specific conditional parameter validation
  switch (mode) {
    case 'replace':
      // No additional parameters required for replace mode
      validateNoExtraParameters(obj, ['id', 'mode', 'content', 'include_content'], 'replace');
      break;

    case 'insert_at_line':
      if (typeof obj['line_number'] !== 'number' || !Number.isInteger(obj['line_number'])) {
        throw new Error(
          'Invalid arguments: line_number is required for insert_at_line mode and must be an integer'
        );
      }
      if (obj['line_number'] < 1) {
        throw new Error('Invalid arguments: line_number must be >= 1 (1-based indexing)');
      }
      result.line_number = obj['line_number'];
      validateNoExtraParameters(
        obj,
        ['id', 'mode', 'content', 'include_content', 'line_number'],
        'insert_at_line'
      );
      break;

    case 'replace_lines':
      if (typeof obj['start_line'] !== 'number' || !Number.isInteger(obj['start_line'])) {
        throw new Error(
          'Invalid arguments: start_line is required for replace_lines mode and must be an integer'
        );
      }
      if (typeof obj['end_line'] !== 'number' || !Number.isInteger(obj['end_line'])) {
        throw new Error(
          'Invalid arguments: end_line is required for replace_lines mode and must be an integer'
        );
      }
      if (obj['start_line'] < 1) {
        throw new Error('Invalid arguments: start_line must be >= 1 (1-based indexing)');
      }
      if (obj['end_line'] < 1) {
        throw new Error('Invalid arguments: end_line must be >= 1 (1-based indexing)');
      }
      if (obj['start_line'] > obj['end_line']) {
        throw new Error('Invalid arguments: start_line must be <= end_line');
      }
      result.start_line = obj['start_line'];
      result.end_line = obj['end_line'];
      validateNoExtraParameters(
        obj,
        ['id', 'mode', 'content', 'include_content', 'start_line', 'end_line'],
        'replace_lines'
      );
      break;

    case 'append_section':
      if (typeof obj['section_marker'] !== 'string' || obj['section_marker'].trim().length === 0) {
        throw new Error(
          'Invalid arguments: section_marker is required for append_section mode and must be a non-empty string'
        );
      }
      result.section_marker = obj['section_marker'].trim();
      validateNoExtraParameters(
        obj,
        ['id', 'mode', 'content', 'include_content', 'section_marker'],
        'append_section'
      );
      break;

    default:
      // This should never happen due to mode validation above, but TypeScript requires it
      throw new Error(`Internal error: unhandled edit mode: ${mode}`);
  }

  return result;
}

export function validateSearchScratchpadContentArgs(args: unknown): SearchScratchpadContentArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }

  const obj = args as Record<string, unknown>;

  if (typeof obj['id'] !== 'string') {
    throw new Error('Invalid arguments: id must be a string');
  }

  // Validate search parameters - exactly one must be provided
  const hasQuery = obj['query'] !== undefined;
  const hasQueryRegex = obj['queryRegex'] !== undefined;

  if (!hasQuery && !hasQueryRegex) {
    throw new Error('Invalid arguments: either query or queryRegex must be provided');
  }

  if (hasQuery && hasQueryRegex) {
    throw new Error('Invalid arguments: cannot specify both query and queryRegex - choose one');
  }

  const result: SearchScratchpadContentArgs = {
    id: obj['id'],
  };

  // Validate query parameters
  if (hasQuery) {
    if (typeof obj['query'] !== 'string') {
      throw new Error('Invalid arguments: query must be a string');
    }
    result.query = obj['query'];
  }

  if (hasQueryRegex) {
    if (typeof obj['queryRegex'] !== 'string') {
      throw new Error('Invalid arguments: queryRegex must be a string');
    }
    result.queryRegex = obj['queryRegex'];
  }

  // Validate output control parameters
  if (obj['max_content_chars'] !== undefined) {
    if (
      typeof obj['max_content_chars'] !== 'number' ||
      !Number.isInteger(obj['max_content_chars']) ||
      obj['max_content_chars'] < 1
    ) {
      throw new Error('Invalid arguments: max_content_chars must be a positive integer');
    }
    result.max_content_chars = obj['max_content_chars'];
  }

  if (obj['include_content'] !== undefined) {
    if (typeof obj['include_content'] !== 'boolean') {
      throw new Error('Invalid arguments: include_content must be a boolean');
    }
    result.include_content = obj['include_content'];
  }

  if (obj['preview_mode'] !== undefined) {
    if (typeof obj['preview_mode'] !== 'boolean') {
      throw new Error('Invalid arguments: preview_mode must be a boolean');
    }
    result.preview_mode = obj['preview_mode'];
  }

  // Context lines parameters (same validation as SearchScratchpadsArgs)
  if (obj['context_lines_before'] !== undefined) {
    if (
      typeof obj['context_lines_before'] !== 'number' ||
      !Number.isInteger(obj['context_lines_before']) ||
      obj['context_lines_before'] < 0 ||
      obj['context_lines_before'] > 50
    ) {
      throw new Error(
        'Invalid arguments: context_lines_before must be an integer between 0 and 50'
      );
    }
    result.context_lines_before = obj['context_lines_before'];
  }

  if (obj['context_lines_after'] !== undefined) {
    if (
      typeof obj['context_lines_after'] !== 'number' ||
      !Number.isInteger(obj['context_lines_after']) ||
      obj['context_lines_after'] < 0 ||
      obj['context_lines_after'] > 50
    ) {
      throw new Error('Invalid arguments: context_lines_after must be an integer between 0 and 50');
    }
    result.context_lines_after = obj['context_lines_after'];
  }

  if (obj['context_lines'] !== undefined) {
    if (
      typeof obj['context_lines'] !== 'number' ||
      !Number.isInteger(obj['context_lines']) ||
      obj['context_lines'] < 0 ||
      obj['context_lines'] > 50
    ) {
      throw new Error('Invalid arguments: context_lines must be an integer between 0 and 50');
    }
    result.context_lines = obj['context_lines'];
  }

  if (obj['max_context_matches'] !== undefined) {
    if (
      typeof obj['max_context_matches'] !== 'number' ||
      !Number.isInteger(obj['max_context_matches']) ||
      obj['max_context_matches'] < 1 ||
      obj['max_context_matches'] > 20
    ) {
      throw new Error('Invalid arguments: max_context_matches must be an integer between 1 and 20');
    }
    result.max_context_matches = obj['max_context_matches'];
  }

  if (obj['merge_context'] !== undefined) {
    if (typeof obj['merge_context'] !== 'boolean') {
      throw new Error('Invalid arguments: merge_context must be a boolean');
    }
    result.merge_context = obj['merge_context'];
  }

  if (obj['show_line_numbers'] !== undefined) {
    if (typeof obj['show_line_numbers'] !== 'boolean') {
      throw new Error('Invalid arguments: show_line_numbers must be a boolean');
    }
    result.show_line_numbers = obj['show_line_numbers'];
  }

  return result;
}

/**
 * Helper function to validate that no unexpected parameters are provided
 * 輔助函數：驗證沒有提供未預期的參數
 */
function validateNoExtraParameters(
  obj: Record<string, unknown>,
  allowedParams: string[],
  mode: string
): void {
  const extraParams = Object.keys(obj).filter((key) => !allowedParams.includes(key));
  if (extraParams.length > 0) {
    throw new Error(
      `Invalid arguments for ${mode} mode: unexpected parameters: ${extraParams.join(', ')}. ` +
        `Allowed parameters: ${allowedParams.join(', ')}`
    );
  }
}
