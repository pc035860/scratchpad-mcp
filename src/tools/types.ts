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
 *
 * SMART APPEND EXAMPLES:
 *
 * // Traditional: append using scratchpad ID
 * { id: "scratchpad-abc-123", content: "New content..." }
 *
 * // ✨ NEW: append using workflow ID (single scratchpad)
 * { id: "workflow-def-456", content: "Smart append content..." }
 * // → Automatically finds and appends to the only scratchpad in workflow
 *
 * // ⚠️  Multiple scratchpads scenario
 * { id: "workflow-with-many", content: "Content..." }
 * // → Error with helpful list: "Multiple scratchpads found... Please specify:"
 * //   - "task-context" (scratchpad-id-1)
 * //   - "progress-log" (scratchpad-id-2)
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

/**
 * Scratchpad summary information (metadata only, no content)
 * Used in workflow results to provide quick overview without full content
 */
export interface ScratchpadSummary {
  id: string;
  title: string;
  size_bytes: number;
  updated_at: string; // ISO string
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
    /** Enhanced Workflow: Summary of scratchpads in this workflow (optional, new workflows typically have none) */
    scratchpads_summary?: ScratchpadSummary[];
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
    /** Enhanced Workflow: Summary of scratchpads in this workflow */
    scratchpads_summary?: ScratchpadSummary[];
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

export interface GetScratchpadArgs
  extends Partial<
    Pick<OutputControlOptions, 'max_content_chars' | 'include_content' | 'preview_mode'>
  > {
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
  /**
   * Scratchpad ID or Workflow ID (Smart Append)
   *
   * SMART APPEND BEHAVIOR:
   * - If ID matches a scratchpad: appends directly to that scratchpad
   * - If ID matches a workflow with exactly 1 scratchpad: appends to that scratchpad
   * - If ID matches a workflow with 0 scratchpads: throws error with helpful message
   * - If ID matches a workflow with multiple scratchpads: throws error listing all options
   * - If ID matches neither: throws "not found" error
   */
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
    /** Enhanced Workflow: Summary of scratchpads in this workflow */
    scratchpads_summary?: ScratchpadSummary[];
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
    /** Enhanced Workflow: Summary of scratchpads in this workflow */
    scratchpads_summary?: ScratchpadSummary[];
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
  /** Whether to return full content instead of tail (overrides tail_size) */
  full_content?: boolean;
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
    /** Indicates this is tail content (false when full_content=true) */
    is_tail_content: boolean;
    /** Number of lines returned */
    tail_lines?: number;
    /** Number of characters returned */
    tail_chars?: number;
    /** Total lines in original content */
    total_lines?: number;
  } | null;
  message?: string;
}

// GPT-5 Workflow Extraction tool types
export interface ExtractWorkflowInfoArgs {
  workflow_id: string;
  extraction_prompt: string;
  model?: string; // Default: "gpt-5-nano"
  reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high'; // Default: "medium"
}

export interface ExtractWorkflowInfoResult {
  workflow_id: string;
  extraction_result: string;
  model_used: string;
  scratchpads_processed: number;
  message?: string;
}

// Chop Scratchpad tool types
export interface ChopScratchpadArgs {
  id: string;
  lines?: number; // Number of lines to remove from the end (default: 1)
}

export interface ChopScratchpadResult {
  scratchpad: {
    id: string;
    workflow_id: string;
    title: string;
    created_at: string; // ISO string
    updated_at: string; // ISO string
    size_bytes: number; // Updated size after chopping
  };
  message: string;
  chopped_lines: number; // Actual number of lines removed
}
