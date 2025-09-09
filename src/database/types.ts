/**
 * Database schema and types for Scratchpad MCP Server
 */

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
  scratchpad_count: number;
  is_active: boolean;
  project_scope: string | null;
}

// Database representation of workflow (is_active as number 0/1)
export interface WorkflowDbRow {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
  scratchpad_count: number;
  is_active: number; // SQLite stores boolean as 0/1
  project_scope: string | null;
}

export interface Scratchpad {
  id: string;
  workflow_id: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
  size_bytes: number;
}

export interface SearchResult {
  scratchpad: Scratchpad;
  workflow: Workflow;
  rank: number;
  snippet?: string;
}

export interface DatabaseConfig {
  filename: string;
  readonly?: boolean;
  timeout?: number;
}

/**
 * Type guard functions for runtime type validation
 * 執行時型別驗證守衛函數，確保資料庫查詢結果的型別安全
 */

/**
 * Type guard to validate if an object is a valid Scratchpad
 */
export function isScratchpad(obj: unknown): obj is Scratchpad {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.workflow_id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.content === 'string' &&
    typeof candidate.created_at === 'number' &&
    typeof candidate.updated_at === 'number' &&
    typeof candidate.size_bytes === 'number'
  );
}

/**
 * Type guard to validate if an object is a valid WorkflowDbRow
 */
export function isWorkflowDbRow(obj: unknown): obj is WorkflowDbRow {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    (candidate.description === null || typeof candidate.description === 'string') &&
    typeof candidate.created_at === 'number' &&
    typeof candidate.updated_at === 'number' &&
    typeof candidate.scratchpad_count === 'number' &&
    typeof candidate.is_active === 'number' && // SQLite boolean as 0/1
    (candidate.project_scope === null || typeof candidate.project_scope === 'string')
  );
}

/**
 * Type guard to validate schema version query result
 */
export function isVersionQueryResult(obj: unknown): obj is { value: string } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof (obj as Record<string, unknown>).value === 'string'
  );
}

/**
 * Safe type assertion with runtime validation for Scratchpad
 * 安全的 Scratchpad 型別斷言，包含執行時驗證
 */
export function assertScratchpad(obj: unknown, context?: string): Scratchpad | null {
  if (obj === undefined || obj === null) {
    return null;
  }

  if (isScratchpad(obj)) {
    return obj;
  }

  const contextMsg = context ? ` in ${context}` : '';
  console.warn(`Invalid Scratchpad data received${contextMsg}:`, obj);
  return null;
}

/**
 * Safe type assertion with runtime validation for WorkflowDbRow
 * 安全的 WorkflowDbRow 型別斷言，包含執行時驗證
 */
export function assertWorkflowDbRow(obj: unknown, context?: string): WorkflowDbRow | null {
  if (obj === undefined || obj === null) {
    return null;
  }

  if (isWorkflowDbRow(obj)) {
    return obj;
  }

  const contextMsg = context ? ` in ${context}` : '';
  console.warn(`Invalid WorkflowDbRow data received${contextMsg}:`, obj);
  return null;
}

/**
 * Safe type assertion with runtime validation for version query results
 * 安全的版本查詢結果型別斷言，包含執行時驗證
 */
export function assertVersionResult(obj: unknown, context?: string): { value: string } | null {
  if (obj === undefined || obj === null) {
    return null;
  }

  if (isVersionQueryResult(obj)) {
    return obj;
  }

  const contextMsg = context ? ` in ${context}` : '';
  console.warn(`Invalid version query result${contextMsg}:`, obj);
  return null;
}

export interface CreateWorkflowParams {
  name: string;
  description?: string | undefined;
  project_scope?: string | undefined;
}

export interface CreateScratchpadParams {
  workflow_id: string;
  title: string;
  content: string;
}

export interface AppendScratchpadParams {
  id: string;
  content: string;
}

export interface ListScratchpadsParams {
  workflow_id: string;
  limit?: number;
  offset?: number;
}

export interface SearchScratchpadsParams {
  query: string;
  workflow_id?: string | undefined;
  limit?: number;
  useJieba?: boolean; // 可選：是否使用 jieba 結巴分詞搜尋
}

export interface ChopScratchpadParams {
  id: string;
  lines?: number; // 可選：要刪除的行數，默認為 1
}

/**
 * Enhanced Update Scratchpad - Multi-mode editing interfaces
 * 增強型多模式編輯介面定義
 */

/**
 * Available edit modes for enhanced scratchpad updates
 * 可用的編輯模式列舉
 */
export type EditMode = 'replace' | 'insert_at_line' | 'replace_lines' | 'append_section';

/**
 * Enhanced Update Scratchpad Arguments
 * 支援四種編輯模式的統一介面
 */
export interface EnhancedUpdateScratchpadArgs {
  /** Scratchpad ID to edit */
  id: string;

  /** Edit mode to use */
  mode: EditMode;

  /** Content to insert, replace, or append */
  content: string;

  /** Whether to include content in response (default: false) */
  include_content?: boolean;

  // Conditional parameters based on mode

  /** Line number for insert_at_line mode (1-based indexing) */
  line_number?: number;

  /** Start line for replace_lines mode (1-based, inclusive) */
  start_line?: number;

  /** End line for replace_lines mode (1-based, inclusive) */
  end_line?: number;

  /** Section marker for append_section mode (e.g., "## Features", "# TODO") */
  section_marker?: string;
}

/**
 * Enhanced Update Scratchpad Result
 * 增強型編輯操作的回傳結果
 */
export interface EnhancedUpdateScratchpadResult {
  /** Updated scratchpad information */
  scratchpad: {
    id: string;
    workflow_id: string;
    title: string;
    content?: string; // Only included if include_content=true
    created_at: string;
    updated_at: string;
    size_bytes: number;
  };

  /** Human-readable operation message */
  message: string;

  /** Detailed operation information */
  operation_details: {
    mode: EditMode;
    lines_affected: number;
    size_change_bytes: number;
    previous_size_bytes: number;
    insertion_point?: number; // For insert_at_line and append_section modes
    replaced_range?: {
      start_line: number;
      end_line: number;
    }; // For replace_lines mode
  };
}
