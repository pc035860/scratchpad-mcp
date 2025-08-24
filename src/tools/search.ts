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
 * Search scratchpads using FTS5 or LIKE fallback
 */
export const searchScratchpadsTool = (db: ScratchpadDatabase): ToolHandler<SearchScratchpadsArgs, SearchScratchpadsResult> => {
  return async (args: SearchScratchpadsArgs): Promise<SearchScratchpadsResult> => {
    try {
      const limit = Math.min(args.limit ?? 20, 50);
      
      const searchResults = db.searchScratchpads({
        query: args.query,
        workflow_id: args.workflow_id ?? undefined,
        limit,
      });

      // Extract search method from database stats
      const stats = db.getStats();
      const searchMethod = stats.hasFTS5 ? 'fts5' : 'like';

      // Generate snippets for better results
      const results = searchResults.map((result) => {
        const snippet = generateSnippet(result.scratchpad.content, args.query, 150);
        
        return {
          scratchpad: result.scratchpad,
          workflow: {
            id: result.workflow.id,
            name: result.workflow.name,
            description: result.workflow.description,
          },
          rank: result.rank,
          snippet,
        };
      });

      return {
        results,
        count: results.length,
        query: args.query,
        search_method: searchMethod,
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