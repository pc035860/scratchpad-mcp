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
}