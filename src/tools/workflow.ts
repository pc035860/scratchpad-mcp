/**
 * Workflow management tools
 */
import type { ScratchpadDatabase } from '../database/index.js';
import type {
  ToolHandler,
  CreateWorkflowArgs,
  CreateWorkflowResult,
  ListWorkflowsResult,
} from './types.js';

/**
 * Create a new workflow
 */
export const createWorkflowTool = (db: ScratchpadDatabase): ToolHandler<CreateWorkflowArgs, CreateWorkflowResult> => {
  return async (args: CreateWorkflowArgs): Promise<CreateWorkflowResult> => {
    try {
      const workflow = db.createWorkflow({
        name: args.name,
        description: args.description ?? undefined,
      });

      return {
        workflow,
        message: `Created workflow "${workflow.name}" with ID ${workflow.id}`,
      };
    } catch (error) {
      throw new Error(`Failed to create workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
};

/**
 * List all workflows
 */
export const listWorkflowsTool = (db: ScratchpadDatabase): ToolHandler<Record<string, never>, ListWorkflowsResult> => {
  return async (): Promise<ListWorkflowsResult> => {
    try {
      const workflows = db.getWorkflows();

      return {
        workflows,
        count: workflows.length,
      };
    } catch (error) {
      throw new Error(`Failed to list workflows: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
};