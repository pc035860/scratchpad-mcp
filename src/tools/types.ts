/**
 * MCP tool types and interfaces
 * 
 * PARAMETER USAGE EXAMPLES:
 * 
 * // Get full content
 * { include_content: true }
 * 
 * // Get truncated content
 * { include_content: true, max_content_chars: 500 }
 * 
 * // Get preview mode (smart truncation)
 * { preview_mode: true, max_content_chars: 200 }
 * 
 * // Get no content (just metadata)
 * { include_content: false }
 * 
 * // Smart default: specify char limit (include_content defaults to true)
 * { max_content_chars: 1000 }
 * 
 * // ❌ CONFLICTING (will show warning)
 * { include_content: false, max_content_chars: 500 }
 * // Result: No content + parameter_warning message
 */

export interface ToolHandler<TArgs = Record<string, unknown>, TResult = unknown> {
  (args: TArgs): Promise<TResult>;
}

/**
 * Output control options for managing response size and content
 * 
 * PARAMETER PRIORITY ORDER (higher priority overrides lower):
 * 1. include_content: false → Returns empty content (ignores max_content_chars)
 * 2. preview_mode: true → Uses preview truncation (respects max_content_chars limit)
 * 3. max_content_chars → Standard content truncation
 * 
 * SMART DEFAULTS: If max_content_chars is specified but include_content is undefined,
 * include_content is automatically set to true (user specified char limit implies they want content)
 * 
 * CONFLICT DETECTION: Warning messages are provided when conflicting parameters are used
 */
export interface OutputControlOptions {
  /** Maximum number of items to return (pagination) */
  limit?: number;
  
  /** Number of items to skip (pagination) */
  offset?: number;
  
  /** 
   * Preview mode - returns shortened content with smart truncation (PRIORITY: 2)
   * When true, uses max_content_chars for truncation length (default: 200)
   * Generates both preview_summary and truncated content
   */
  preview_mode?: boolean;
  
  /** 
   * Maximum characters per scratchpad content (PRIORITY: 3)
   * Only applies when include_content is not false
   * If specified while include_content is undefined, include_content defaults to true
   * Example: max_content_chars: 500 will truncate content to 500 characters
   */
  max_content_chars?: number;
  
  /** 
   * Whether to include content in response (PRIORITY: 1 - HIGHEST)
   * - false: Returns empty content string (overrides max_content_chars)
   * - true: Returns content (may be truncated by max_content_chars)
   * - undefined: Smart default based on other parameters
   */
  include_content?: boolean;
}

/**
 * Enhanced scratchpad format that supports content truncation indicators
 */
export interface FormattedScratchpad {
  id: string;
  workflow_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  size_bytes: number;
  /** Indicates if content was truncated due to max_content_chars */
  content_truncated?: boolean;
  /** Original content size before truncation */
  original_size?: number;
  /** Preview summary when in preview_mode */
  preview_summary?: string;
  /** Warning message when parameter conflicts are detected */
  parameter_warning?: string;
  /** Description of applied content control (for debugging and transparency) */
  content_control_applied?: string;
}

export interface CreateWorkflowArgs {
  name: string;
  description?: string;
  project_scope?: string;
}

export interface CreateWorkflowResult {
  workflow: {
    id: string;
    name: string;
    description: string | null;
    created_at: string; // ISO string
    updated_at: string; // ISO string
    scratchpad_count: number;
    is_active: boolean;
    project_scope: string | null;
  };
  message: string;
}

export interface ListWorkflowsArgs extends Partial<OutputControlOptions> {
  project_scope?: string;
}

export interface ListWorkflowsResult {
  workflows: Array<{
    id: string;
    name: string;
    description: string | null;
    created_at: string; // ISO string
    updated_at: string; // ISO string
    scratchpad_count: number;
    is_active: boolean;
    project_scope: string | null;
  }>;
  count: number;
}

export interface CreateScratchpadArgs {
  workflow_id: string;
  title: string;
  content: string;
  /** Whether to return full content in response (default: false, returns metadata only) */
  include_content?: boolean;
}

export interface CreateScratchpadResult {
  scratchpad: {
    id: string;
    workflow_id: string;
    title: string;
    content: string;
    created_at: string; // ISO string
    updated_at: string; // ISO string
    size_bytes: number;
  };
  message: string;
}

export interface GetScratchpadArgs extends Partial<Pick<OutputControlOptions, 'max_content_chars' | 'include_content' | 'preview_mode'>> {
  id: string;
}

export interface GetScratchpadResult {
  scratchpad: {
    id: string;
    workflow_id: string;
    title: string;
    content: string;
    created_at: string; // ISO string
    updated_at: string; // ISO string
    size_bytes: number;
    content_truncated?: boolean;
    original_size?: number;
    preview_summary?: string;
    parameter_warning?: string;
    content_control_applied?: string;
  } | null;
  message?: string;
}

export interface AppendScratchpadArgs {
  id: string;
  content: string;
  /** Whether to return full content in response (default: false, returns metadata only) */
  include_content?: boolean;
}

export interface AppendScratchpadResult {
  scratchpad: {
    id: string;
    workflow_id: string;
    title: string;
    content: string;
    created_at: string; // ISO string
    updated_at: string; // ISO string
    size_bytes: number;
  };
  message: string;
  appended_bytes: number;
}

export interface ListScratchpadsArgs extends Partial<OutputControlOptions> {
  workflow_id: string;
}

export interface ListScratchpadsResult {
  scratchpads: Array<{
    id: string;
    workflow_id: string;
    title: string;
    content: string;
    created_at: string; // ISO string
    updated_at: string; // ISO string
    size_bytes: number;
    content_truncated?: boolean;
    original_size?: number;
    preview_summary?: string;
    parameter_warning?: string;
    content_control_applied?: string;
  }>;
  count: number;
  has_more: boolean;
  message?: string;
}

export interface SearchScratchpadsArgs extends Partial<OutputControlOptions> {
  query: string;
  workflow_id?: string;
  useJieba?: boolean; // Force jieba tokenization (auto-detect by default)
}

export interface SearchScratchpadsResult {
  results: Array<{
    scratchpad: {
      id: string;
      workflow_id: string;
      title: string;
      content: string;
      created_at: string; // ISO string
      updated_at: string; // ISO string
      size_bytes: number;
      content_truncated?: boolean;
      original_size?: number;
      preview_summary?: string;
      parameter_warning?: string;
      content_control_applied?: string;
    };
    workflow: {
      id: string;
      name: string;
      description: string | null;
    };
    rank: number;
    snippet?: string;
  }>;
  count: number;
  query: string;
  search_method: 'fts5' | 'like';
  message?: string;
}

// New tool types for is_active feature
export interface GetLatestActiveWorkflowArgs {
  project_scope?: string;
}

export interface GetLatestActiveWorkflowResult {
  workflow: {
    id: string;
    name: string;
    description: string | null;
    created_at: string; // ISO string
    updated_at: string; // ISO string
    scratchpad_count: number;
    is_active: boolean;
    project_scope: string | null;
  } | null;
  message: string;
}

export interface UpdateWorkflowStatusArgs {
  workflow_id: string;
  is_active: boolean;
}

export interface UpdateWorkflowStatusResult {
  workflow: {
    id: string;
    name: string;
    description: string | null;
    created_at: string; // ISO string
    updated_at: string; // ISO string
    scratchpad_count: number;
    is_active: boolean;
    project_scope: string | null;
  };
  message: string;
  previous_status: boolean;
}

// New tail-scratchpad tool types - SIMPLIFIED DESIGN
export interface TailScratchpadArgs {
  id: string;
  /** Tail size specification - choose either lines OR chars, not both */
  tail_size?: { lines: number } | { chars: number };
  /** Whether to include content in response (default: true) */
  include_content?: boolean;
}

export interface TailScratchpadResult {
  scratchpad: {
    id: string;
    workflow_id: string;
    title: string;
    content: string; // Tail content only
    created_at: string; // ISO string
    updated_at: string; // ISO string
    size_bytes: number; // Total size of original scratchpad
    content_truncated?: boolean;
    original_size?: number;
    preview_summary?: string;
    parameter_warning?: string;
    content_control_applied?: string;
    /** Indicates this is tail content */
    is_tail_content: true;
    /** Number of lines returned */
    tail_lines?: number;
    /** Number of characters returned */
    tail_chars?: number;
    /** Total lines in original content */
    total_lines?: number;
  } | null;
  message?: string;
}