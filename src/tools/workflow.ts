/**
 * Workflow management tools
 */
import type { ScratchpadDatabase } from '../database/index.js';
import type {
  ToolHandler,
  CreateWorkflowArgs,
  CreateWorkflowResult,
  ListWorkflowsResult,
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
      });

      return {
        workflow: formatWorkflow(workflow),
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
export const getLatestActiveWorkflowTool = (db: ScratchpadDatabase): ToolHandler<Record<string, never>, GetLatestActiveWorkflowResult> => {
  return async (): Promise<GetLatestActiveWorkflowResult> => {
    try {
      const workflow = db.getLatestActiveWorkflow();

      if (workflow) {
        return {
          workflow: formatWorkflow(workflow),
          message: `Found latest active workflow: "${workflow.name}" (${workflow.id})`,
        };
      } else {
        return {
          workflow: null,
          message: 'No active workflow found',
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