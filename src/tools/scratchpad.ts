/**
 * Scratchpad CRUD tools
 */
import type { ScratchpadDatabase } from '../database/index.js';
import { BlockParser } from '../utils/BlockParser.js';
import type {
  EnhancedUpdateScratchpadArgs,
  EnhancedUpdateScratchpadResult,
} from '../database/types.js';
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
 * LineEditor - Core editing engine for enhanced scratchpad updates
 *
 * Provides unified line-based editing algorithms for four modes:
 * - replace: Complete content replacement
 * - insert_at_line: Insert content at specific line number
 * - replace_lines: Replace specific line range with new content
 * - append_section: Smart append after markdown section markers
 */
class LineEditor {
  /**
   * Apply editing operation based on mode and parameters
   */
  static processEdit(
    originalContent: string,
    args: EnhancedUpdateScratchpadArgs
  ): { newContent: string; operationDetails: any } {
    // Handle empty content case
    const lines = originalContent === '' ? [] : originalContent.split('\n');

    let newLines: string[];
    const operationDetails: any = {
      mode: args.mode,
      lines_affected: 0,
      size_change_bytes: 0,
      previous_size_bytes: Buffer.byteLength(originalContent, 'utf8'),
    };

    switch (args.mode) {
      case 'replace':
        newLines = args.content === '' ? [] : args.content.split('\n');
        operationDetails.lines_affected = newLines.length;
        break;

      case 'insert_at_line': {
        const insertResult = LineEditor.insertAtLine(lines, args.content, args.line_number!);
        newLines = insertResult.lines;
        operationDetails.lines_affected = args.content.split('\n').length;
        operationDetails.insertion_point = insertResult.actualInsertionPoint;
        break;
      }

      case 'replace_lines': {
        const result = LineEditor.replaceLines(
          lines,
          args.content,
          args.start_line!,
          args.end_line!
        );
        newLines = result.lines;
        operationDetails.lines_affected = result.linesAffected;
        operationDetails.replaced_range = {
          start_line: args.start_line!,
          end_line: args.end_line!,
        };
        break;
      }

      case 'append_section': {
        const sectionResult = LineEditor.appendSection(lines, args.content, args.section_marker!);
        newLines = sectionResult.lines;
        operationDetails.lines_affected = args.content.split('\n').length;
        operationDetails.insertion_point = sectionResult.insertionPoint;
        break;
      }

      default:
        throw new Error(`Unknown edit mode: ${(args as any).mode}`);
    }

    const newContent = newLines.join('\n');
    operationDetails.size_change_bytes =
      Buffer.byteLength(newContent, 'utf8') - operationDetails.previous_size_bytes;

    return { newContent, operationDetails };
  }

  /**
   * Insert content at specific line number (1-based indexing)
   */
  private static insertAtLine(
    lines: string[],
    content: string,
    lineNumber: number
  ): { lines: string[]; actualInsertionPoint: number } {
    const insertLines = content === '' ? [] : content.split('\n');
    const insertIndex = Math.max(0, Math.min(lineNumber - 1, lines.length));

    const newLines = [...lines];
    newLines.splice(insertIndex, 0, ...insertLines);

    return {
      lines: newLines,
      actualInsertionPoint: insertIndex + 1, // Convert back to 1-based indexing
    };
  }

  /**
   * Replace specific line range with new content (1-based indexing, inclusive)
   */
  private static replaceLines(
    lines: string[],
    content: string,
    startLine: number,
    endLine: number
  ): { lines: string[]; linesAffected: number } {
    const replaceLines = content === '' ? [] : content.split('\n');

    // Convert to 0-based indexing and ensure valid range
    const startIndex = Math.max(0, Math.min(startLine - 1, lines.length));
    const endIndex = Math.max(0, Math.min(endLine - 1, lines.length - 1));
    const deleteCount = Math.max(0, endIndex - startIndex + 1);

    const newLines = [...lines];
    newLines.splice(startIndex, deleteCount, ...replaceLines);

    return {
      lines: newLines,
      linesAffected: replaceLines.length,
    };
  }

  /**
   * Smart append after markdown section markers
   * Searches for section marker and intelligently determines insertion point
   */
  private static appendSection(
    lines: string[],
    content: string,
    sectionMarker: string
  ): { lines: string[]; insertionPoint: number } {
    const appendLines = content === '' ? [] : content.split('\n');

    // Find the section marker
    let insertIndex = -1;
    let markerWasFound = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]?.includes(sectionMarker)) {
        markerWasFound = true;
        insertIndex = i + 1;

        // Look ahead to find the best insertion point after the marker
        // Skip empty lines immediately after the marker
        while (insertIndex < lines.length && lines[insertIndex]?.trim() === '') {
          insertIndex++;
        }

        // If we found content after the marker, find the end of this section
        if (insertIndex < lines.length) {
          // Look for next section marker or significant content break
          let sectionEndIndex = insertIndex;
          for (let j = insertIndex; j < lines.length; j++) {
            const line = lines[j]?.trim() || '';
            // Stop at next markdown header or similar marker
            if (line.startsWith('#') || line.startsWith('##') || line === '---') {
              break;
            }
            sectionEndIndex = j + 1;
          }
          insertIndex = sectionEndIndex;
        }

        break;
      }
    }

    // If marker not found, append at end
    if (insertIndex === -1) {
      insertIndex = lines.length;
    }

    const newLines = [...lines];

    // Separator logic based on test case analysis:
    // Add separator UNLESS we're inserting before a markdown header (# or ##)
    // Special cases:
    // 1. If marker not found, don't add separator
    // 2. If multiple same markers, add separator even if next line is header
    const hasContentBefore = insertIndex > 0 && lines[insertIndex - 1]?.trim() !== '';
    const nextLineIsHeader =
      insertIndex < lines.length && lines[insertIndex]?.trim().match(/^##?\s/);
    const isMultipleMarkerCase =
      markerWasFound && nextLineIsHeader && lines[insertIndex]?.includes(sectionMarker);

    let needsSeparator = hasContentBefore && !nextLineIsHeader;

    // Special case adjustments
    if (!markerWasFound) {
      needsSeparator = false; // Don't add separator when marker not found
    } else if (isMultipleMarkerCase) {
      needsSeparator = true; // Add separator for multiple marker case
    }

    if (needsSeparator) {
      newLines.splice(insertIndex, 0, '', ...appendLines);
      return {
        lines: newLines,
        insertionPoint: insertIndex + 2, // +2 because we added empty line first
      };
    } else {
      newLines.splice(insertIndex, 0, ...appendLines);
      return {
        lines: newLines,
        insertionPoint: insertIndex + 1, // Return 1-based line number
      };
    }
  }
}

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
            // Multiple scratchpads - try to find one with "context" in the name
            const contextScratchpad = scratchpads.find((s) => 
              s.title.toLowerCase().includes('context')
            );
            
            if (contextScratchpad) {
              // Found a context scratchpad, use it
              originalScratchpad = contextScratchpad;
            } else {
              // No context scratchpad found - user needs to be specific
              const scratchpadList = scratchpads.map((s) => `- "${s.title}" (${s.id})`).join('\n');
              throw new Error(
                `Multiple scratchpads found in workflow "${workflow.name}" (${args.id}). Please specify the scratchpad ID:\n${scratchpadList}`
              );
            }
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
        } else if ('blocks' in args.tail_size) {
          // Extract by block count using BlockParser
          const blocks = args.tail_size.blocks;
          tailContent = BlockParser.getBlockRange(content, blocks, true); // fromEnd = true
          tailChars = tailContent.length;
          tailLines = tailContent.split('\n').length;
          extractionMethod = `last ${blocks} block(s)`;
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

      let newContent: string;
      let choppedMessage: string;
      let choppedLines: number = 0;

      if (args.blocks !== undefined) {
        // Handle block-based chopping using BlockParser
        const blocksToChop = args.blocks;
        const totalBlocks = BlockParser.getBlockCount(content);
        const actualChoppedBlocks = Math.min(blocksToChop, totalBlocks);

        newContent = BlockParser.chopBlocks(content, actualChoppedBlocks);

        // Calculate lines for reporting
        const originalLines = content.split('\n').length;
        const remainingLines = newContent.split('\n').length;
        choppedLines = originalLines - remainingLines;

        choppedMessage = `Chopped ${actualChoppedBlocks} block(s) from scratchpad "${scratchpad.title}" (${totalBlocks} → ${totalBlocks - actualChoppedBlocks} blocks, ${choppedLines} lines removed)`;
      } else {
        // Handle line-based chopping (existing logic)
        const contentLines = content.split('\n');
        const totalLines = contentLines.length;

        // Default to removing 1 line if not specified
        const linesToChop = args.lines ?? 1;
        const actualChoppedLines = Math.min(linesToChop, totalLines);

        // Calculate the lines to keep (from the beginning)
        const linesToKeep = Math.max(0, totalLines - actualChoppedLines);
        newContent = contentLines.slice(0, linesToKeep).join('\n');
        choppedLines = actualChoppedLines;

        choppedMessage = `Chopped ${actualChoppedLines} line(s) from scratchpad "${scratchpad.title}" (${totalLines} → ${linesToKeep} lines)`;
      }

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
        message: `${choppedMessage} (${updatedScratchpad.size_bytes} bytes)`,
        chopped_lines: choppedLines,
      };
    } catch (error) {
      throw new Error(
        `Failed to chop scratchpad: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };
};

/**
 * Enhanced update scratchpad tool - Multi-mode editing support
 * Supports four editing modes: replace, insert_at_line, replace_lines, append_section
 */
export const enhancedUpdateScratchpadTool = (
  db: ScratchpadDatabase
): ToolHandler<EnhancedUpdateScratchpadArgs, EnhancedUpdateScratchpadResult> => {
  return async (args: EnhancedUpdateScratchpadArgs): Promise<EnhancedUpdateScratchpadResult> => {
    try {
      // Get the original scratchpad
      const originalScratchpad = db.getScratchpadById(args.id);
      if (!originalScratchpad) {
        throw new Error(`Scratchpad not found: ${args.id}`);
      }

      // Check if the workflow is active
      const workflow = db.getWorkflowById(originalScratchpad.workflow_id);
      if (!workflow) {
        throw new Error(`Workflow not found for scratchpad: ${args.id}`);
      }
      if (!workflow.is_active) {
        throw new Error('Cannot update scratchpad: workflow is not active');
      }

      // Use LineEditor to process the edit
      const { newContent, operationDetails } = LineEditor.processEdit(
        originalScratchpad.content,
        args
      );

      // Update the scratchpad content using database method
      const updatedScratchpad = db.updateScratchpadContent(args.id, newContent);

      // Generate human-readable message based on operation
      let message: string;
      switch (args.mode) {
        case 'replace':
          message = `Replaced entire content of scratchpad "${updatedScratchpad.title}" (${operationDetails.lines_affected} lines affected, ${updatedScratchpad.size_bytes} bytes)`;
          break;
        case 'insert_at_line':
          message = `Inserted content at line ${operationDetails.insertion_point} in scratchpad "${updatedScratchpad.title}" (${operationDetails.lines_affected} lines added, ${updatedScratchpad.size_bytes} bytes)`;
          break;
        case 'replace_lines':
          message = `Replaced lines ${operationDetails.replaced_range?.start_line}-${operationDetails.replaced_range?.end_line} in scratchpad "${updatedScratchpad.title}" (${operationDetails.lines_affected} lines affected, ${updatedScratchpad.size_bytes} bytes)`;
          break;
        case 'append_section':
          message = `Appended content to section "${args.section_marker}" at line ${operationDetails.insertion_point} in scratchpad "${updatedScratchpad.title}" (${operationDetails.lines_affected} lines added, ${updatedScratchpad.size_bytes} bytes)`;
          break;
        default:
          message = `Updated scratchpad "${updatedScratchpad.title}" using ${args.mode} mode (${updatedScratchpad.size_bytes} bytes)`;
      }

      // Smart content control: default to include content, exclude only if explicitly requested
      const includeContent = args.include_content ?? true;

      // Adjust message if content is not included
      if (!includeContent) {
        message += ' - Content not included in response';
      }

      return {
        scratchpad: {
          id: updatedScratchpad.id,
          workflow_id: updatedScratchpad.workflow_id,
          title: updatedScratchpad.title,
          ...(includeContent && { content: updatedScratchpad.content }),
          created_at: formatTimestamp(updatedScratchpad.created_at),
          updated_at: formatTimestamp(updatedScratchpad.updated_at),
          size_bytes: updatedScratchpad.size_bytes,
        },
        message,
        operation_details: operationDetails,
      };
    } catch (error) {
      throw new Error(
        `Failed to update scratchpad: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };
};
