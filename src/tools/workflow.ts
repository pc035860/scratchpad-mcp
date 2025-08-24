/**
 * Workflow management tools
 */
import type { ScratchpadDatabase } from '../database/index.js';
import type {
  ToolHandler,
  CreateWorkflowArgs,
  CreateWorkflowResult,
  ListWorkflowsArgs,
  ListWorkflowsResult,
  GetLatestActiveWorkflowArgs,
  GetLatestActiveWorkflowResult,
  UpdateWorkflowStatusArgs,
  UpdateWorkflowStatusResult,
} from './types.js';

/**
 * Convert Unix timestamp to local timezone ISO string
 */
const formatTimestamp = (unixTimestamp: number): string => {
  return new Date(unixTimestamp * 1000).toISOString();
};

/**
 * Format workflow object with ISO timestamp strings
 */
const formatWorkflow = (workflow: any) => ({
  ...workflow,
  created_at: formatTimestamp(workflow.created_at),
  updated_at: formatTimestamp(workflow.updated_at),
});

/**
 * Create a new workflow
 */
export const createWorkflowTool = (db: ScratchpadDatabase): ToolHandler<CreateWorkflowArgs, CreateWorkflowResult> => {
  return async (args: CreateWorkflowArgs): Promise<CreateWorkflowResult> => {
    try {
      const workflow = db.createWorkflow({
        name: args.name,
        description: args.description ?? undefined,
        project_scope: args.project_scope ?? undefined,
      });

      return {
        workflow: formatWorkflow(workflow),
        message: `Created workflow "${workflow.name}" with ID ${workflow.id}${args.project_scope ? ` (scope: ${args.project_scope})` : ''}`,
      };
    } catch (error) {
      throw new Error(`Failed to create workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
};

/**
 * List all workflows
 */
export const listWorkflowsTool = (db: ScratchpadDatabase): ToolHandler<ListWorkflowsArgs, ListWorkflowsResult> => {
  return async (args: ListWorkflowsArgs): Promise<ListWorkflowsResult> => {
    try {
      const workflows = db.getWorkflows(args.project_scope);

      return {
        workflows: workflows.map(formatWorkflow),
        count: workflows.length,
      };
    } catch (error) {
      throw new Error(`Failed to list workflows: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
};

/**
 * Get the latest active workflow
 */
export const getLatestActiveWorkflowTool = (db: ScratchpadDatabase): ToolHandler<GetLatestActiveWorkflowArgs, GetLatestActiveWorkflowResult> => {
  return async (args: GetLatestActiveWorkflowArgs): Promise<GetLatestActiveWorkflowResult> => {
    try {
      const workflow = db.getLatestActiveWorkflow(args.project_scope);

      if (workflow) {
        const scopeMessage = args.project_scope ? ` (scope: ${args.project_scope})` : '';
        return {
          workflow: formatWorkflow(workflow),
          message: `Found latest active workflow: "${workflow.name}" (${workflow.id})${scopeMessage}`,
        };
      } else {
        const scopeMessage = args.project_scope ? ` in scope "${args.project_scope}"` : '';
        return {
          workflow: null,
          message: `No active workflow found${scopeMessage}`,
        };
      }
    } catch (error) {
      throw new Error(`Failed to get latest active workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
};

/**
 * Update workflow active status
 */
export const updateWorkflowStatusTool = (db: ScratchpadDatabase): ToolHandler<UpdateWorkflowStatusArgs, UpdateWorkflowStatusResult> => {
  return async (args: UpdateWorkflowStatusArgs): Promise<UpdateWorkflowStatusResult> => {
    try {
      // Get current workflow to track previous status
      const currentWorkflow = db.getWorkflowById(args.workflow_id);
      if (!currentWorkflow) {
        throw new Error(`Workflow not found: ${args.workflow_id}`);
      }
      
      const previousStatus = currentWorkflow.is_active;
      
      // Update the status
      const updatedWorkflow = db.setWorkflowActiveStatus(args.workflow_id, args.is_active);
      
      if (!updatedWorkflow) {
        throw new Error(`Failed to update workflow status: ${args.workflow_id}`);
      }

      const statusText = args.is_active ? 'activated' : 'deactivated';
      
      return {
        workflow: formatWorkflow(updatedWorkflow),
        message: `Workflow "${updatedWorkflow.name}" has been ${statusText}`,
        previous_status: previousStatus,
      };
    } catch (error) {
      throw new Error(`Failed to update workflow status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
};