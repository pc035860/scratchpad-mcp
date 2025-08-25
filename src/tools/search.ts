/**
 * Search tools
 */
import type { ScratchpadDatabase } from '../database/index.js';
import type {
  ToolHandler,
  SearchScratchpadsArgs,
  SearchScratchpadsResult,
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
 * Search scratchpads using FTS5 or LIKE fallback
 */
export const searchScratchpadsTool = (db: ScratchpadDatabase): ToolHandler<SearchScratchpadsArgs, SearchScratchpadsResult> => {
  return async (args: SearchScratchpadsArgs): Promise<SearchScratchpadsResult> => {
    try {
      // More conservative search limits to prevent context overflow
      const limit = Math.min(args.limit ?? 10, 20); // Reduced defaults for search
      
      const searchResults = db.searchScratchpads({
        query: args.query,
        workflow_id: args.workflow_id ?? undefined,
        limit,
        ...(args.useJieba !== undefined && { useJieba: args.useJieba }),
      });

      // Extract search method from database stats
      const stats = db.getStats();
      const searchMethod = stats.hasFTS5 ? 'fts5' : 'like';

      // Apply output control options
      const formatOptions: {
        preview_mode?: boolean;
        max_content_chars?: number;
        include_content?: boolean;
      } = {
        ...(args.preview_mode !== undefined && { preview_mode: args.preview_mode }),
        max_content_chars: args.max_content_chars ?? (args.preview_mode ? 250 : 500), // Conservative for search results
        ...(args.include_content !== undefined && { include_content: args.include_content }),
      };

      // Generate snippets and format results
      const results = searchResults.map((result) => {
        // Generate snippet from original content for search context
        const snippetLength = args.preview_mode ? 100 : 150;
        const snippet = generateSnippet(result.scratchpad.content, args.query, snippetLength);
        
        return {
          scratchpad: formatScratchpad(result.scratchpad, formatOptions),
          workflow: {
            id: result.workflow.id,
            name: result.workflow.name,
            description: result.workflow.description,
          },
          rank: result.rank,
          snippet,
        };
      });

      // Check if any results have warnings or content control applied
      const hasWarnings = results.some(r => r.scratchpad.parameter_warning);
      const hasContentControl = results.some(r => r.scratchpad.content_control_applied);
      
      let message = `Found ${results.length} results for "${args.query}" using ${searchMethod}`;
      if (hasWarnings) message += ` - Some results have parameter conflicts (check parameter_warning)`;
      else if (hasContentControl) message += ` - Content control applied to results (check content_control_applied)`;
      
      return {
        results,
        count: results.length,
        query: args.query,
        search_method: searchMethod,
        message,
      };
    } catch (error) {
      throw new Error(`Failed to search scratchpads: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
};

/**
 * Generate a snippet from content highlighting the search query
 */
function generateSnippet(content: string, query: string, maxLength: number): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  const queryIndex = lowerContent.indexOf(lowerQuery);
  
  if (queryIndex === -1) {
    // Query not found, return beginning of content
    return content.length > maxLength 
      ? content.substring(0, maxLength) + '...'
      : content;
  }

  // Calculate start and end positions for snippet
  const halfLength = Math.floor((maxLength - query.length) / 2);
  const start = Math.max(0, queryIndex - halfLength);
  const end = Math.min(content.length, queryIndex + query.length + halfLength);
  
  let snippet = content.substring(start, end);
  
  // Add ellipsis if we're not at the beginning/end
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  
  return snippet;
}