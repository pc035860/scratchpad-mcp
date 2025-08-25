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