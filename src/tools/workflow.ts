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
 * Format workflow object with ISO timestamp strings and optional scratchpads summary
 */
const formatWorkflow = (
  workflow: any,
  db?: ScratchpadDatabase,
  includeScratchpadsSummary: boolean = true
) => {
  const formatted = {
    ...workflow,
    created_at: formatTimestamp(workflow.created_at),
    updated_at: formatTimestamp(workflow.updated_at),
  };

  // Add scratchpads summary if database is provided and feature is enabled
  if (db && includeScratchpadsSummary) {
    try {
      const scratchpads = db.listScratchpads({
        workflow_id: workflow.id,
        limit: 20, // Reasonable limit for summary
      });

      formatted.scratchpads_summary = scratchpads.map((scratchpad) => ({
        id: scratchpad.id,
        title: scratchpad.title,
        size_bytes: scratchpad.size_bytes,
        updated_at: formatTimestamp(scratchpad.updated_at),
      }));
    } catch (error) {
      // Gracefully handle any database errors - don't fail the whole workflow operation
      console.warn(`Failed to load scratchpads summary for workflow ${workflow.id}:`, error);
      formatted.scratchpads_summary = [];
    }
  }

  return formatted;
};

/**
 * Create a new workflow
 */
export const createWorkflowTool = (
  db: ScratchpadDatabase
): ToolHandler<CreateWorkflowArgs, CreateWorkflowResult> => {
  return async (args: CreateWorkflowArgs): Promise<CreateWorkflowResult> => {
    try {
      const workflow = db.createWorkflow({
        name: args.name,
        description: args.description ?? undefined,
        project_scope: args.project_scope ?? undefined,
      });

      return {
        workflow: formatWorkflow(workflow, db, false), // New workflow has no scratchpads yet
        message: `Created workflow "${workflow.name}" with ID ${workflow.id}${args.project_scope ? ` (scope: ${args.project_scope})` : ''}`,
      };
    } catch (error) {
      throw new Error(
        `Failed to create workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };
};

/**
 * List all workflows with pagination and output control
 */
export const listWorkflowsTool = (
  db: ScratchpadDatabase
): ToolHandler<ListWorkflowsArgs, ListWorkflowsResult> => {
  return async (args: ListWorkflowsArgs): Promise<ListWorkflowsResult> => {
    try {
      // Apply output control with sensible defaults
      const limit = Math.min(args.limit ?? 20, 100); // Default 20, max 100
      const offset = args.offset ?? 0;

      const allWorkflows = db.getWorkflows(args.project_scope);

      // Apply pagination
      const paginatedWorkflows = allWorkflows.slice(offset, offset + limit);

      // Apply preview mode or content control
      const formattedWorkflows = paginatedWorkflows.map((workflow) => {
        const formatted = formatWorkflow(workflow, db, true); // Include scratchpads summary

        // Apply content control to description
        if (formatted.description) {
          if (args.preview_mode) {
            const maxDescChars = args.max_content_chars ?? 200;
            if (formatted.description.length > maxDescChars) {
              formatted.description =
                formatted.description.substring(0, maxDescChars) + '...（截斷）';
            }
          } else if (
            args.max_content_chars &&
            formatted.description.length > args.max_content_chars
          ) {
            formatted.description =
              formatted.description.substring(0, args.max_content_chars) + '...（截斷）';
          }
        }

        // If include_content is false, remove description
        if (args.include_content === false) {
          formatted.description = null;
        }

        return formatted;
      });

      return {
        workflows: formattedWorkflows,
        count: formattedWorkflows.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to list workflows: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };
};

/**
 * Get the latest active workflow
 */
export const getLatestActiveWorkflowTool = (
  db: ScratchpadDatabase
): ToolHandler<GetLatestActiveWorkflowArgs, GetLatestActiveWorkflowResult> => {
  return async (args: GetLatestActiveWorkflowArgs): Promise<GetLatestActiveWorkflowResult> => {
    try {
      const workflow = db.getLatestActiveWorkflow(args.project_scope);

      if (workflow) {
        const scopeMessage = args.project_scope ? ` (scope: ${args.project_scope})` : '';
        return {
          workflow: formatWorkflow(workflow, db, true), // Include scratchpads summary
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
      throw new Error(
        `Failed to get latest active workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };
};

/**
 * Update workflow active status
 */
export const updateWorkflowStatusTool = (
  db: ScratchpadDatabase
): ToolHandler<UpdateWorkflowStatusArgs, UpdateWorkflowStatusResult> => {
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
        workflow: formatWorkflow(updatedWorkflow, db, true), // Include scratchpads summary
        message: `Workflow "${updatedWorkflow.name}" has been ${statusText}`,
        previous_status: previousStatus,
      };
    } catch (error) {
      throw new Error(
        `Failed to update workflow status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };
};
