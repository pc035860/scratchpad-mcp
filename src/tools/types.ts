/**
 * MCP tool types and interfaces
 */

export interface ToolHandler<TArgs = Record<string, unknown>, TResult = unknown> {
  (args: TArgs): Promise<TResult>;
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

export interface ListWorkflowsArgs {
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

export interface GetScratchpadArgs {
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
  } | null;
}

export interface AppendScratchpadArgs {
  id: string;
  content: string;
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

export interface ListScratchpadsArgs {
  workflow_id: string;
  limit?: number;
  offset?: number;
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
  }>;
  count: number;
  has_more: boolean;
}

export interface SearchScratchpadsArgs {
  query: string;
  workflow_id?: string;
  limit?: number;
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