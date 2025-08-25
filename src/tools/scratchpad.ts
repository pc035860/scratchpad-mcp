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
const formatScratchpad = (scratchpad: any, options?: {
  preview_mode?: boolean;
  max_content_chars?: number;
  include_content?: boolean;
}) => {
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
    formatted.content_control_applied = `truncated to ${options.max_content_chars} chars`;
  }
  
  return formatted;
};

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

      // Smart content control: default to metadata only, full content only if explicitly requested
      const includeContent = args.include_full_content ?? false;

      return {
        scratchpad: formatScratchpad(scratchpad, {
          include_content: includeContent,
        }),
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

      // Smart content control: default to metadata only, full content only if explicitly requested
      const includeContent = args.include_full_content ?? false;

      return {
        scratchpad: formatScratchpad(updatedScratchpad, {
          include_content: includeContent,
        }),
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

      const formattedScratchpads = resultScratchpads.map(scratchpad => formatScratchpad(scratchpad, formatOptions));
      
      // Check if any scratchpads have warnings or content control applied
      const hasWarnings = formattedScratchpads.some(s => s.parameter_warning);
      const hasContentControl = formattedScratchpads.some(s => s.content_control_applied);
      
      let message = `Listed ${resultScratchpads.length} scratchpads`;
      if (hasMore) message += ` (${args.limit! + args.offset!} total, showing first ${args.limit})`;
      if (hasWarnings) message += ` - Some items have parameter conflicts (check parameter_warning)`;
      else if (hasContentControl) message += ` - Content control applied (check content_control_applied)`;
      
      return {
        scratchpads: formattedScratchpads,
        count: resultScratchpads.length,
        has_more: hasMore,
        message,
      };
    } catch (error) {
      throw new Error(`Failed to list scratchpads: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
};

/**
 * Get tail content from scratchpad (last N lines or chars)
 */
export const tailScratchpadTool = (db: ScratchpadDatabase): ToolHandler<TailScratchpadArgs, TailScratchpadResult> => {
  return async (args: TailScratchpadArgs): Promise<TailScratchpadResult> => {
    try {
      const scratchpad = db.getScratchpadById(args.id);

      if (!scratchpad) {
        return { scratchpad: null };
      }

      const content = scratchpad.content;
      const totalLines = content.split('\n').length;
      
      // Determine tail extraction method
      let tailContent: string;
      let tailLines: number | undefined;
      let tailChars: number | undefined;
      
      if (args.chars !== undefined) {
        // Extract by character count (overrides lines parameter)
        const startIndex = Math.max(0, content.length - args.chars);
        tailContent = content.substring(startIndex);
        tailChars = tailContent.length;
        tailLines = tailContent.split('\n').length;
      } else {
        // Extract by line count (default: 50)
        const linesToTake = args.lines ?? 50;
        const lines = content.split('\n');
        const startIndex = Math.max(0, lines.length - linesToTake);
        const extractedLines = lines.slice(startIndex);
        tailContent = extractedLines.join('\n');
        tailLines = extractedLines.length;
        tailChars = tailContent.length;
      }

      // Create tail scratchpad object with metadata
      const tailScratchpad = {
        ...scratchpad,
        content: tailContent,
        created_at: formatTimestamp(scratchpad.created_at),
        updated_at: formatTimestamp(scratchpad.updated_at),
        is_tail_content: true as const,
        tail_lines: tailLines,
        tail_chars: tailChars,
        total_lines: totalLines,
      };

      // Apply content control for tail content if needed
      const formatOptions: {
        preview_mode?: boolean;
        max_content_chars?: number;
        include_content?: boolean;
      } = {
        ...(args.preview_mode !== undefined && { preview_mode: args.preview_mode }),
        ...(args.max_content_chars !== undefined && { max_content_chars: args.max_content_chars }),
        ...(args.include_content !== undefined && { include_content: args.include_content }),
      };

      const formattedTail: any = { 
        ...tailScratchpad,
      };
      
      // Apply format options to tail content if needed
      if (formatOptions.include_content === false) {
        formattedTail.content = '';
        formattedTail.parameter_warning = 'Content excluded due to include_content=false';
      } else if (formatOptions.preview_mode) {
        const maxChars = formatOptions.max_content_chars ?? 200;
        formattedTail.preview_summary = generatePreview(tailContent, maxChars);
        formattedTail.content = generatePreview(tailContent, maxChars);
        formattedTail.content_control_applied = `tail + preview_mode with ${maxChars} chars`;
      } else if (formatOptions.max_content_chars && tailContent.length > formatOptions.max_content_chars) {
        const originalLength = tailContent.length;
        formattedTail.content = tailContent.substring(0, formatOptions.max_content_chars) + '...（截斷）';
        formattedTail.content_truncated = true;
        formattedTail.original_size = originalLength;
        formattedTail.content_control_applied = `tail content truncated to ${formatOptions.max_content_chars} chars`;
      }
      
      // Generate informative message
      let message = `Retrieved tail from scratchpad "${scratchpad.title}"`;
      if (args.chars !== undefined) {
        message += ` (last ${tailChars} chars, ${tailLines} lines)`;
      } else {
        message += ` (last ${tailLines}/${totalLines} lines, ${tailChars} chars)`;
      }
      
      if (formattedTail.parameter_warning) {
        message += ` - WARNING: ${formattedTail.parameter_warning}`;
      } else if (formattedTail.content_control_applied) {
        message += ` - Content control: ${formattedTail.content_control_applied}`;
      }
      
      return {
        scratchpad: formattedTail,
        message,
      };
    } catch (error) {
      throw new Error(`Failed to get tail from scratchpad: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
};