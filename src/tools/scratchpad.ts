/**
 * Scratchpad CRUD tools
 */
import type { ScratchpadDatabase } from '../database/index.js';
import type {
  ToolHandler,
  CreateScratchpadArgs,
  CreateScratchpadResult,
  GetScratchpadArgs,
  GetScratchpadResult,
  AppendScratchpadArgs,
  AppendScratchpadResult,
  ListScratchpadsArgs,
  ListScratchpadsResult,
} from './types.js';

/**
 * Convert Unix timestamp to local timezone ISO string
 */
const formatTimestamp = (unixTimestamp: number): string => {
  return new Date(unixTimestamp * 1000).toISOString();
};

/**
 * Format scratchpad object with ISO timestamp strings
 */
const formatScratchpad = (scratchpad: any) => ({
  ...scratchpad,
  created_at: formatTimestamp(scratchpad.created_at),
  updated_at: formatTimestamp(scratchpad.updated_at),
});

/**
 * Create a new scratchpad
 */
export const createScratchpadTool = (db: ScratchpadDatabase): ToolHandler<CreateScratchpadArgs, CreateScratchpadResult> => {
  return async (args: CreateScratchpadArgs): Promise<CreateScratchpadResult> => {
    try {
      const scratchpad = db.createScratchpad({
        workflow_id: args.workflow_id,
        title: args.title,
        content: args.content,
      });

      return {
        scratchpad: formatScratchpad(scratchpad),
        message: `Created scratchpad "${scratchpad.title}" (${scratchpad.size_bytes} bytes) in workflow ${scratchpad.workflow_id}`,
      };
    } catch (error) {
      throw new Error(`Failed to create scratchpad: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
};

/**
 * Get scratchpad by ID
 */
export const getScratchpadTool = (db: ScratchpadDatabase): ToolHandler<GetScratchpadArgs, GetScratchpadResult> => {
  return async (args: GetScratchpadArgs): Promise<GetScratchpadResult> => {
    try {
      const scratchpad = db.getScratchpadById(args.id);

      return {
        scratchpad: scratchpad ? formatScratchpad(scratchpad) : null,
      };
    } catch (error) {
      throw new Error(`Failed to get scratchpad: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
};

/**
 * Append content to existing scratchpad
 */
export const appendScratchpadTool = (db: ScratchpadDatabase): ToolHandler<AppendScratchpadArgs, AppendScratchpadResult> => {
  return async (args: AppendScratchpadArgs): Promise<AppendScratchpadResult> => {
    try {
      const originalScratchpad = db.getScratchpadById(args.id);
      if (!originalScratchpad) {
        throw new Error(`Scratchpad not found: ${args.id}`);
      }

      const updatedScratchpad = db.appendToScratchpad({
        id: args.id,
        content: args.content,
      });

      const appendedBytes = updatedScratchpad.size_bytes - originalScratchpad.size_bytes;

      return {
        scratchpad: formatScratchpad(updatedScratchpad),
        message: `Appended ${appendedBytes} bytes to scratchpad "${updatedScratchpad.title}" (total: ${updatedScratchpad.size_bytes} bytes)`,
        appended_bytes: appendedBytes,
      };
    } catch (error) {
      throw new Error(`Failed to append to scratchpad: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
};

/**
 * List scratchpads in a workflow
 */
export const listScratchpadsTool = (db: ScratchpadDatabase): ToolHandler<ListScratchpadsArgs, ListScratchpadsResult> => {
  return async (args: ListScratchpadsArgs): Promise<ListScratchpadsResult> => {
    try {
      const limit = Math.min(args.limit ?? 50, 100);
      const offset = args.offset ?? 0;

      const scratchpads = db.listScratchpads({
        workflow_id: args.workflow_id,
        limit: limit + 1, // Get one extra to check if there are more
        offset,
      });

      const hasMore = scratchpads.length > limit;
      const resultScratchpads = hasMore ? scratchpads.slice(0, limit) : scratchpads;

      return {
        scratchpads: resultScratchpads.map(formatScratchpad),
        count: resultScratchpads.length,
        has_more: hasMore,
      };
    } catch (error) {
      throw new Error(`Failed to list scratchpads: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
};