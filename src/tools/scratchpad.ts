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
  TailScratchpadArgs,
  TailScratchpadResult,
  ChopScratchpadArgs,
  ChopScratchpadResult,
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
 * Generate a preview summary from content
 */
const generatePreview = (content: string, maxLength = 200): string => {
  if (content.length <= maxLength) {
    return content;
  }

  // Try to break at word boundary near the limit
  const truncated = content.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const breakPoint = lastSpace > maxLength * 0.8 ? lastSpace : maxLength;

  return content.substring(0, breakPoint) + '...';
};

/**
 * Format scratchpad object with ISO timestamp strings and optional content control
 */
const formatScratchpad = (
  scratchpad: any,
  options?: {
    preview_mode?: boolean;
    max_content_chars?: number;
    include_content?: boolean;
  }
) => {
  const formatted = {
    ...scratchpad,
    created_at: formatTimestamp(scratchpad.created_at),
    updated_at: formatTimestamp(scratchpad.updated_at),
  };

  // Smart default logic: if max_content_chars is specified but include_content is undefined,
  // assume user wants content (they specified a char limit for a reason)
  let effectiveIncludeContent = options?.include_content;
  if (effectiveIncludeContent === undefined && options?.max_content_chars !== undefined) {
    effectiveIncludeContent = true;
  }

  // Parameter conflict detection and warning
  let parameterWarning: string | undefined;
  if (options?.include_content === false && options?.max_content_chars !== undefined) {
    parameterWarning = `Parameter conflict: max_content_chars (${options.max_content_chars}) ignored due to include_content=false`;
  }

  // Handle content control with improved logic
  if (effectiveIncludeContent === false) {
    formatted.content = '';
    if (parameterWarning) {
      formatted.parameter_warning = parameterWarning;
    }
  } else if (options?.preview_mode) {
    const maxChars = options.max_content_chars ?? 200;
    formatted.preview_summary = generatePreview(formatted.content, maxChars);
    formatted.content = generatePreview(formatted.content, maxChars);
    formatted.content_control_applied = `preview_mode with ${maxChars} chars`;
  } else if (options?.max_content_chars && formatted.content.length > options.max_content_chars) {
    const originalLength = formatted.content.length;
    formatted.content = formatted.content.substring(0, options.max_content_chars) + '...（截斷）';
    formatted.content_truncated = true;
    formatted.original_size = originalLength;
    formatted.content_control_applied = `truncated to ${options.max_content_chars} chars - use higher max_content_chars for more, or tail-scratchpad with full_content=true for complete content`;
  }

  return formatted;
};

/**
 * Create a new scratchpad
 */
export const createScratchpadTool = (
  db: ScratchpadDatabase
): ToolHandler<CreateScratchpadArgs, CreateScratchpadResult> => {
  return async (args: CreateScratchpadArgs): Promise<CreateScratchpadResult> => {
    try {
      const scratchpad = db.createScratchpad({
        workflow_id: args.workflow_id,
        title: args.title,
        content: args.content,
      });

      // Smart content control: default to metadata only, full content only if explicitly requested
      const includeContent = args.include_content ?? false;

      return {
        scratchpad: formatScratchpad(scratchpad, {
          include_content: includeContent,
        }),
        message: `Created scratchpad "${scratchpad.title}" (${scratchpad.size_bytes} bytes) in workflow ${scratchpad.workflow_id}`,
      };
    } catch (error) {
      throw new Error(
        `Failed to create scratchpad: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };
};

/**
 * Get scratchpad by ID
 */
export const getScratchpadTool = (
  db: ScratchpadDatabase
): ToolHandler<GetScratchpadArgs, GetScratchpadResult> => {
  return async (args: GetScratchpadArgs): Promise<GetScratchpadResult> => {
    try {
      const scratchpad = db.getScratchpadById(args.id);

      if (!scratchpad) {
        return { scratchpad: null };
      }

      // Apply content control for single scratchpad retrieval
      const formatOptions: {
        preview_mode?: boolean;
        max_content_chars?: number;
        include_content?: boolean;
      } = {
        ...(args.preview_mode !== undefined && { preview_mode: args.preview_mode }),
        max_content_chars: args.max_content_chars ?? (args.preview_mode ? 500 : 2000), // Higher default for single item
        ...(args.include_content !== undefined && { include_content: args.include_content }),
      };

      const formattedScratchpad = formatScratchpad(scratchpad, formatOptions);

      // Generate informative message about content control applied
      let message = `Retrieved scratchpad "${scratchpad.title}" (${scratchpad.size_bytes} bytes)`;
      if (formattedScratchpad.parameter_warning) {
        message += ` - WARNING: ${formattedScratchpad.parameter_warning}`;
      } else if (formattedScratchpad.content_control_applied) {
        message += ` - Content control: ${formattedScratchpad.content_control_applied}`;
      }

      return {
        scratchpad: formattedScratchpad,
        message,
      };
    } catch (error) {
      throw new Error(
        `Failed to get scratchpad: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };
};

/**
 * Append content to existing scratchpad
 * Supports both scratchpad ID and workflow ID (if workflow has exactly one scratchpad)
 */
export const appendScratchpadTool = (
  db: ScratchpadDatabase
): ToolHandler<AppendScratchpadArgs, AppendScratchpadResult> => {
  return async (args: AppendScratchpadArgs): Promise<AppendScratchpadResult> => {
    try {
      // First, try to get scratchpad by ID directly
      let originalScratchpad = db.getScratchpadById(args.id);

      // If not found, try as workflow ID (Smart Append feature)
      if (!originalScratchpad) {
        const workflow = db.getWorkflowById(args.id);
        if (workflow) {
          // Get all scratchpads in this workflow
          const scratchpads = db.listScratchpads({
            workflow_id: args.id,
            limit: 10, // Limit to avoid unnecessary data load
          });

          if (scratchpads.length === 0) {
            throw new Error(
              `No scratchpads found in workflow "${workflow.name}" (${args.id}). Create a scratchpad first.`
            );
          } else if (scratchpads.length === 1) {
            // Perfect! Use the single scratchpad
            originalScratchpad = scratchpads[0] || null;
          } else {
            // Multiple scratchpads - user needs to be specific
            const scratchpadList = scratchpads.map((s) => `- "${s.title}" (${s.id})`).join('\n');
            throw new Error(
              `Multiple scratchpads found in workflow "${workflow.name}" (${args.id}). Please specify the scratchpad ID:\n${scratchpadList}`
            );
          }
        } else {
          throw new Error(`Neither scratchpad nor workflow found with ID: ${args.id}`);
        }
      }

      // At this point, originalScratchpad must exist (either found directly or via workflow)
      if (!originalScratchpad) {
        throw new Error(`Unable to find scratchpad with ID: ${args.id}`);
      }

      const updatedScratchpad = db.appendToScratchpad({
        id: originalScratchpad.id, // Use the actual scratchpad ID, not args.id
        content: args.content,
      });

      const appendedBytes = updatedScratchpad.size_bytes - originalScratchpad.size_bytes;

      // Smart content control: default to metadata only, full content only if explicitly requested
      const includeContent = args.include_content ?? false;

      return {
        scratchpad: formatScratchpad(updatedScratchpad, {
          include_content: includeContent,
        }),
        message: `Appended ${appendedBytes} bytes to scratchpad "${updatedScratchpad.title}" (total: ${updatedScratchpad.size_bytes} bytes)`,
        appended_bytes: appendedBytes,
      };
    } catch (error) {
      throw new Error(
        `Failed to append to scratchpad: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };
};

/**
 * List scratchpads in a workflow
 */
export const listScratchpadsTool = (
  db: ScratchpadDatabase
): ToolHandler<ListScratchpadsArgs, ListScratchpadsResult> => {
  return async (args: ListScratchpadsArgs): Promise<ListScratchpadsResult> => {
    try {
      // Apply more conservative defaults to prevent context overflow
      const limit = Math.min(args.limit ?? 20, 50); // Reduced from 50 default, 100 max
      const offset = args.offset ?? 0;

      const scratchpads = db.listScratchpads({
        workflow_id: args.workflow_id,
        limit: limit + 1, // Get one extra to check if there are more
        offset,
      });

      const hasMore = scratchpads.length > limit;
      const resultScratchpads = hasMore ? scratchpads.slice(0, limit) : scratchpads;

      // Apply output control options
      const formatOptions: {
        preview_mode?: boolean;
        max_content_chars?: number;
        include_content?: boolean;
      } = {
        ...(args.preview_mode !== undefined && { preview_mode: args.preview_mode }),
        max_content_chars: args.max_content_chars ?? (args.preview_mode ? 300 : 800), // More conservative defaults
        ...(args.include_content !== undefined && { include_content: args.include_content }),
      };

      const formattedScratchpads = resultScratchpads.map((scratchpad) =>
        formatScratchpad(scratchpad, formatOptions)
      );

      // Check if any scratchpads have warnings or content control applied
      const hasWarnings = formattedScratchpads.some((s) => s.parameter_warning);
      const hasContentControl = formattedScratchpads.some((s) => s.content_control_applied);

      let message = `Listed ${resultScratchpads.length} scratchpads`;
      if (hasMore) message += ` (${args.limit! + args.offset!} total, showing first ${args.limit})`;
      if (hasWarnings)
        message += ` - Some items have parameter conflicts (check parameter_warning)`;
      else if (hasContentControl)
        message += ` - Content control applied (check content_control_applied)`;

      return {
        scratchpads: formattedScratchpads,
        count: resultScratchpads.length,
        has_more: hasMore,
        message,
      };
    } catch (error) {
      throw new Error(
        `Failed to list scratchpads: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };
};

/**
 * Get tail content from scratchpad (last N lines or chars)
 */
export const tailScratchpadTool = (
  db: ScratchpadDatabase
): ToolHandler<TailScratchpadArgs, TailScratchpadResult> => {
  return async (args: TailScratchpadArgs): Promise<TailScratchpadResult> => {
    try {
      const scratchpad = db.getScratchpadById(args.id);

      if (!scratchpad) {
        return { scratchpad: null };
      }

      const content = scratchpad.content;
      const totalLines = content.split('\n').length;

      // Handle full content mode (overrides tail_size)
      let tailContent: string;
      let tailLines: number;
      let tailChars: number;
      let extractionMethod: string;
      let isFullContent = false;

      if (args.full_content) {
        // Full content mode - use formatScratchpad for output control
        tailContent = content;
        tailLines = totalLines;
        tailChars = content.length;
        extractionMethod = 'full content';
        isFullContent = true;
      } else if (args.tail_size) {
        if ('chars' in args.tail_size) {
          // Extract by character count
          const chars = args.tail_size.chars;
          const startIndex = Math.max(0, content.length - chars);
          tailContent = content.substring(startIndex);
          tailChars = tailContent.length;
          tailLines = tailContent.split('\n').length;
          extractionMethod = `last ${chars} chars`;
        } else {
          // Extract by line count
          const lines = args.tail_size.lines;
          const contentLines = content.split('\n');
          const startIndex = Math.max(0, contentLines.length - lines);
          const extractedLines = contentLines.slice(startIndex);
          tailContent = extractedLines.join('\n');
          tailLines = extractedLines.length;
          tailChars = tailContent.length;
          extractionMethod = `last ${lines} lines`;
        }
      } else {
        // Default: 50 lines
        const lines = 50;
        const contentLines = content.split('\n');
        const startIndex = Math.max(0, contentLines.length - lines);
        const extractedLines = contentLines.slice(startIndex);
        tailContent = extractedLines.join('\n');
        tailLines = extractedLines.length;
        tailChars = tailContent.length;
        extractionMethod = 'last 50 lines (default)';
      }

      // Handle include_content flag
      const includeContent = args.include_content ?? true;
      const finalContent = includeContent ? tailContent : '';

      // Create tail scratchpad result
      const result = {
        id: scratchpad.id,
        workflow_id: scratchpad.workflow_id,
        title: scratchpad.title,
        content: finalContent,
        created_at: formatTimestamp(scratchpad.created_at),
        updated_at: formatTimestamp(scratchpad.updated_at),
        size_bytes: scratchpad.size_bytes, // Total size of original scratchpad
        is_tail_content: !isFullContent, // false when full_content=true
        tail_lines: tailLines,
        tail_chars: tailChars,
        total_lines: totalLines,
      };

      // Generate clear informative message
      const actionType = isFullContent ? 'Retrieved full content from' : 'Retrieved tail from';
      let message = `${actionType} scratchpad "${scratchpad.title}" (${extractionMethod})`;
      message += ` - ${tailLines}/${totalLines} lines, ${tailChars} chars`;

      if (!includeContent) {
        message += ' - Content excluded (include_content=false)';
      } else if (!isFullContent && tailLines < totalLines) {
        message += ' - use full_content=true for complete content';
      }

      return {
        scratchpad: result,
        message,
      };
    } catch (error) {
      throw new Error(
        `Failed to get tail from scratchpad: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };
};

/**
 * Chop content from scratchpad (remove N lines from the end)
 */
export const chopScratchpadTool = (
  db: ScratchpadDatabase
): ToolHandler<ChopScratchpadArgs, ChopScratchpadResult> => {
  return async (args: ChopScratchpadArgs): Promise<ChopScratchpadResult> => {
    try {
      const scratchpad = db.getScratchpadById(args.id);

      if (!scratchpad) {
        throw new Error(`Scratchpad not found: ${args.id}`);
      }

      // Check if the workflow is active
      const workflow = db.getWorkflowById(scratchpad.workflow_id);
      if (!workflow || !workflow.is_active) {
        throw new Error(
          `Cannot chop scratchpad: workflow is not active: ${scratchpad.workflow_id}`
        );
      }

      const content = scratchpad.content;

      // Handle empty content specially
      if (content === '') {
        return {
          scratchpad: {
            id: scratchpad.id,
            workflow_id: scratchpad.workflow_id,
            title: scratchpad.title,
            created_at: formatTimestamp(scratchpad.created_at),
            updated_at: formatTimestamp(scratchpad.updated_at),
            size_bytes: scratchpad.size_bytes,
          },
          message: `No lines to chop from empty scratchpad "${scratchpad.title}"`,
          chopped_lines: 0,
        };
      }

      const contentLines = content.split('\n');
      const totalLines = contentLines.length;

      // Default to removing 1 line if not specified
      const linesToChop = args.lines ?? 1;
      const actualChoppedLines = Math.min(linesToChop, totalLines);

      // Calculate the lines to keep (from the beginning)
      const linesToKeep = Math.max(0, totalLines - actualChoppedLines);
      const newContent = contentLines.slice(0, linesToKeep).join('\n');

      // Update the scratchpad using the new public method
      const updatedScratchpad = db.updateScratchpadContent(args.id, newContent);

      return {
        scratchpad: {
          id: updatedScratchpad.id,
          workflow_id: updatedScratchpad.workflow_id,
          title: updatedScratchpad.title,
          created_at: formatTimestamp(updatedScratchpad.created_at),
          updated_at: formatTimestamp(updatedScratchpad.updated_at),
          size_bytes: updatedScratchpad.size_bytes,
        },
        message: `Chopped ${actualChoppedLines} line(s) from scratchpad "${updatedScratchpad.title}" (${totalLines} → ${linesToKeep} lines, ${updatedScratchpad.size_bytes} bytes)`,
        chopped_lines: actualChoppedLines,
      };
    } catch (error) {
      throw new Error(
        `Failed to chop scratchpad: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };
};
