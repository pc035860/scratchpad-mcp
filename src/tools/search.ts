/**
 * Search tools
 */
import type { ScratchpadDatabase } from '../database/index.js';
import type {
  ToolHandler,
  SearchScratchpadsArgs,
  SearchScratchpadsResult,
  SearchScratchpadContentArgs,
  SearchScratchpadContentResult,
  SearchWorkflowsArgs,
  SearchWorkflowsResult,
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
    formatted.content_control_applied = `truncated to ${options.max_content_chars} chars`;
  }

  return formatted;
};

/**
 * Split query into English and Chinese keywords
 * 簡化策略：只拆分英文和中文，不進行深度分詞
 */
export const splitLanguageKeywords = (
  query: string
): { english: string[]; chinese: string[] } => {
  // 提取英文詞彙 (連續的字母、數字、連字符、底線)
  const englishMatches = query.match(/[a-zA-Z0-9_-]+/g) || [];
  
  // 移除英文詞彙後剩餘的部分作為中文
  let chineseText = query;
  englishMatches.forEach((englishWord) => {
    chineseText = chineseText.replace(new RegExp(englishWord, 'g'), ' ');
  });
  
  // 清理中文文本：移除多餘空白和特殊符號，保留中文字符
  chineseText = chineseText
    .replace(/\s+/g, ' ')
    .replace(/[^\u4e00-\u9fa5\s]/g, '')
    .trim();
  
  // 將中文文本按空格分割（如果有的話），否則作為整體
  const chineseWords = chineseText
    ? chineseText.split(/\s+/).filter((word) => word.length > 0)
    : [];
  
  return {
    english: englishMatches.filter((word) => word.length > 0),
    chinese: chineseWords,
  };
};

/**
 * Calculate weighted score for a workflow based on keyword matches
 * 權重分配: workflows.name(5分) + workflows.description(3分) + scratchpads.title(3分) + scratchpads.content(1分)
 */
export const calculateWorkflowScore = (
  workflow: {
    name: string;
    description: string | null;
  },
  scratchpads: Array<{
    title: string;
    content: string;
  }>,
  keywords: string[]
): number => {
  let score = 0;

  // 大小寫不敏感的匹配函數
  const countMatches = (text: string, keyword: string): number => {
    if (!text || !keyword) return 0;
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    // 計算關鍵詞在文本中出現的次數
    let count = 0;
    let position = 0;
    
    while ((position = lowerText.indexOf(lowerKeyword, position)) !== -1) {
      count++;
      position += lowerKeyword.length;
    }
    
    return count;
  };

  // 遍歷所有關鍵詞
  for (const keyword of keywords) {
    // workflows.name: 5分/次
    const nameMatches = countMatches(workflow.name, keyword);
    score += nameMatches * 5;

    // workflows.description: 3分/次
    if (workflow.description) {
      const descMatches = countMatches(workflow.description, keyword);
      score += descMatches * 3;
    }

    // scratchpads 評分
    for (const scratchpad of scratchpads) {
      // scratchpads.title: 3分/次
      const titleMatches = countMatches(scratchpad.title, keyword);
      score += titleMatches * 3;

      // scratchpads.content: 1分/次
      const contentMatches = countMatches(scratchpad.content, keyword);
      score += contentMatches * 1;
    }
  }

  return score;
};

/**
 * Search scratchpads using FTS5 or LIKE fallback
 */
export const searchScratchpadsTool = (
  db: ScratchpadDatabase
): ToolHandler<SearchScratchpadsArgs, SearchScratchpadsResult> => {
  return async (args: SearchScratchpadsArgs): Promise<SearchScratchpadsResult> => {
    try {
      // Validate context parameters
      const validationErrors: string[] = [];

      // Validate context_lines parameters
      if (args.context_lines !== undefined) {
        if (args.context_lines < 0 || args.context_lines > 50) {
          validationErrors.push('context_lines must be between 0 and 50');
        }
        // Warn about conflicting parameters
        if (args.context_lines_before !== undefined || args.context_lines_after !== undefined) {
          validationErrors.push(
            'context_lines conflicts with context_lines_before/after - context_lines will take precedence'
          );
        }
      }

      if (
        args.context_lines_before !== undefined &&
        (args.context_lines_before < 0 || args.context_lines_before > 50)
      ) {
        validationErrors.push('context_lines_before must be between 0 and 50');
      }

      if (
        args.context_lines_after !== undefined &&
        (args.context_lines_after < 0 || args.context_lines_after > 50)
      ) {
        validationErrors.push('context_lines_after must be between 0 and 50');
      }

      if (
        args.max_context_matches !== undefined &&
        (args.max_context_matches < 1 || args.max_context_matches > 20)
      ) {
        validationErrors.push('max_context_matches must be between 1 and 20');
      }

      // Check for hard errors vs warnings
      const hardErrors = validationErrors.filter((error) => !error.includes('conflicts'));
      if (hardErrors.length > 0) {
        throw new Error(`Parameter validation failed: ${hardErrors.join(', ')}`);
      }

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
        let snippet: string;

        // Check if context-based snippet is requested
        const hasContextParams =
          args.context_lines !== undefined ||
          args.context_lines_before !== undefined ||
          args.context_lines_after !== undefined;

        if (hasContextParams) {
          // Use context-based snippet generation

          // Handle parameter priority: context_lines has precedence over individual before/after
          const linesBefore = args.context_lines ?? args.context_lines_before ?? 2;
          const linesAfter = args.context_lines ?? args.context_lines_after ?? 2;

          const contextOptions: ContextSnippetOptions = {
            lines_before: linesBefore,
            lines_after: linesAfter,
            max_matches: args.max_context_matches ?? 5,
            merge_overlapping: args.merge_context ?? true,
            show_line_numbers: args.show_line_numbers ?? false,
          };

          snippet = generateContextSnippet(result.scratchpad.content, args.query, contextOptions);
        } else {
          // Use original character-based snippet generation
          const snippetLength = args.preview_mode ? 100 : 150;
          snippet = generateSnippet(result.scratchpad.content, args.query, snippetLength);
        }

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
      const hasWarnings = results.some((r) => r.scratchpad.parameter_warning);
      const hasContentControl = results.some((r) => r.scratchpad.content_control_applied);

      // Extract context information for message
      const hasContextParams =
        args.context_lines !== undefined ||
        args.context_lines_before !== undefined ||
        args.context_lines_after !== undefined;
      const contextWarnings = validationErrors.filter((error) => error.includes('conflicts'));

      let message = `Found ${results.length} results for "${args.query}" using ${searchMethod}`;
      if (hasContextParams) {
        const contextMode =
          args.context_lines !== undefined
            ? `±${args.context_lines}`
            : `${args.context_lines_before ?? 2}/${args.context_lines_after ?? 2}`;
        message += ` - Using context mode (${contextMode} lines)`;
      }

      if (contextWarnings.length > 0) message += ` - Warning: ${contextWarnings.join(', ')}`;
      else if (hasWarnings)
        message += ` - Some results have parameter conflicts (check parameter_warning)`;
      else if (hasContentControl)
        message += ` - Content control applied to results (check content_control_applied)`;

      return {
        results,
        count: results.length,
        query: args.query,
        search_method: searchMethod,
        message,
      };
    } catch (error) {
      throw new Error(
        `Failed to search scratchpads: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
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

/**
 * Context range interface for line-based search results
 */
interface ContextRange {
  start: number;
  end: number;
  matchLines: number[];
}

/**
 * Options for generating context snippets
 */
interface ContextSnippetOptions {
  lines_before: number;
  lines_after: number;
  max_matches: number;
  merge_overlapping: boolean;
  show_line_numbers: boolean;
}

/**
 * Merge overlapping context ranges to avoid duplication
 */
function mergeOverlappingRanges(ranges: ContextRange[]): ContextRange[] {
  if (ranges.length === 0) return [];

  // Sort ranges by start position
  ranges.sort((a, b) => a.start - b.start);

  const merged: ContextRange[] = [ranges[0]!]; // Non-null assertion since we checked length > 0

  for (let i = 1; i < ranges.length; i++) {
    const current = ranges[i]!; // Non-null assertion
    const last = merged[merged.length - 1]!; // Non-null assertion

    // Check if ranges overlap or are adjacent (allowing 1-line gap)
    if (current.start <= last.end + 1) {
      // Merge ranges
      last.end = Math.max(last.end, current.end);
      last.matchLines.push(...current.matchLines);
      // Remove duplicates and sort
      last.matchLines = [...new Set(last.matchLines)].sort((a, b) => a - b);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Find all lines containing the query (case-insensitive)
 */
function findMatchingLines(lines: string[], query: string): number[] {
  const lowerQuery = query.toLowerCase();
  const matchingLines: number[] = [];

  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(lowerQuery)) {
      matchingLines.push(index);
    }
  });

  return matchingLines;
}

/**
 * Generate context-aware snippet from content with line-based context
 */
function generateContextSnippet(
  content: string,
  query: string,
  options: ContextSnippetOptions
): string {
  const lines = content.split('\n');
  const matchingLines = findMatchingLines(lines, query);

  if (matchingLines.length === 0) {
    // No matches found, fallback to character-based snippet
    return generateSnippet(content, query, 200);
  }

  // Limit the number of matches to process
  const limitedMatches = matchingLines.slice(0, options.max_matches);

  // Generate context ranges for each match
  const contextRanges: ContextRange[] = limitedMatches.map((lineNum) => ({
    start: Math.max(0, lineNum - options.lines_before),
    end: Math.min(lines.length - 1, lineNum + options.lines_after),
    matchLines: [lineNum],
  }));

  // Merge overlapping ranges if requested
  const finalRanges = options.merge_overlapping
    ? mergeOverlappingRanges(contextRanges)
    : contextRanges;

  // Generate final output
  let result = '';
  let isFirstRange = true;

  for (const range of finalRanges) {
    if (!isFirstRange) {
      result += '\n...\n'; // Separator between non-continuous ranges
    }
    isFirstRange = false;

    for (let i = range.start; i <= range.end; i++) {
      const line = lines[i];
      const isMatchLine = range.matchLines.includes(i);

      if (options.show_line_numbers) {
        const lineNum = (i + 1).toString();
        const prefix = isMatchLine ? '> ' : '... ';
        result += `${prefix}${lineNum}: ${line}\n`;
      } else {
        const marker = isMatchLine ? '► ' : '  ';
        result += `${marker}${line}\n`;
      }
    }
  }

  // Remove trailing newline
  return result.trimEnd();
}

/**
 * Interface for individual match results
 */
interface Match {
  line_number: number;
  char_position: number;
  match_text: string;
}

/**
 * Search for string pattern in content
 */
function searchStringInContent(content: string, query: string): Match[] {
  const matches: Match[] = [];
  const lines = content.split('\n');
  
  lines.forEach((line, lineIndex) => {
    let index = 0;
    while ((index = line.indexOf(query, index)) !== -1) {
      matches.push({
        line_number: lineIndex + 1,
        char_position: index,
        match_text: query
      });
      index += query.length;
    }
  });
  
  return matches;
}

/**
 * Search for regex pattern in content
 */
function searchRegexInContent(content: string, queryRegex: string): Match[] {
  const matches: Match[] = [];
  
  try {
    const regex = new RegExp(queryRegex, 'g');
    const lines = content.split('\n');
    
    lines.forEach((line, lineIndex) => {
      let match;
      while ((match = regex.exec(line)) !== null) {
        matches.push({
          line_number: lineIndex + 1,
          char_position: match.index,
          match_text: match[0]
        });
        
        // Prevent infinite loop on zero-width matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
      // Reset regex for next line
      regex.lastIndex = 0;
    });
  } catch (error) {
    throw new Error(`Invalid regular expression: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return matches;
}

/**
 * Search within a single scratchpad content
 */
export const searchScratchpadContentTool = (
  db: ScratchpadDatabase
): ToolHandler<SearchScratchpadContentArgs, SearchScratchpadContentResult> => {
  return async (args: SearchScratchpadContentArgs): Promise<SearchScratchpadContentResult> => {
    // Validate search parameters
    const hasQuery = args.query !== undefined;
    const hasQueryRegex = args.queryRegex !== undefined;
    
    if (!hasQuery && !hasQueryRegex) {
      throw new Error('Either query or queryRegex must be provided');
    }
    
    if (hasQuery && hasQueryRegex) {
      throw new Error('Cannot specify both query and queryRegex - choose one');
    }
    
    // Get scratchpad
    const scratchpad = db.getScratchpadById(args.id);
    if (!scratchpad) {
      throw new Error(`Scratchpad not found: ${args.id}`);
    }
    
    // Perform search
    const searchMethod = hasQuery ? 'string' : 'regex';
    const searchTerm = hasQuery ? args.query! : args.queryRegex!;
    
    let matches: Match[];
    if (hasQuery) {
      matches = searchStringInContent(scratchpad.content, args.query!);
    } else {
      matches = searchRegexInContent(scratchpad.content, args.queryRegex!);
    }
    
    // Generate snippets for each match
    const hasContextParams = 
      args.context_lines !== undefined ||
      args.context_lines_before !== undefined ||
      args.context_lines_after !== undefined;
    
    const matchesWithSnippets = matches.map((match) => {
      let snippet: string;
      
      if (hasContextParams) {
        // Use context-based snippet generation
        const linesBefore = args.context_lines ?? args.context_lines_before ?? 2;
        const linesAfter = args.context_lines ?? args.context_lines_after ?? 2;
        
        const contextOptions: ContextSnippetOptions = {
          lines_before: linesBefore,
          lines_after: linesAfter,
          max_matches: args.max_context_matches ?? 5,
          merge_overlapping: args.merge_context ?? true,
          show_line_numbers: args.show_line_numbers ?? false,
        };
        
        snippet = generateContextSnippet(scratchpad.content, searchTerm, contextOptions);
      } else {
        // Use character-based snippet generation
        const snippetLength = 150;
        snippet = generateSnippet(scratchpad.content, searchTerm, snippetLength);
      }
      
      return {
        ...match,
        snippet,
      };
    });
    
    return {
      scratchpad: {
        id: scratchpad.id,
        workflow_id: scratchpad.workflow_id,
        title: scratchpad.title,
        created_at: formatTimestamp(scratchpad.created_at),
        updated_at: formatTimestamp(scratchpad.updated_at),
        size_bytes: scratchpad.size_bytes,
      },
      matches: matchesWithSnippets,
      total_matches: matches.length,
      search_method: searchMethod,
      message: `Found ${matches.length} matches for ${searchMethod === 'string' ? `"${searchTerm}"` : `pattern /${searchTerm}/`} in scratchpad "${scratchpad.title}"`,
    };
  };
};

/**
 * Search workflows with weighted scoring based on scratchpads content
 * 實作「先搜workflows再載入scratchpads的查詢策略」
 */
export const searchWorkflowsTool = (
  db: ScratchpadDatabase
): ToolHandler<SearchWorkflowsArgs, SearchWorkflowsResult> => {
  return async (args: SearchWorkflowsArgs): Promise<SearchWorkflowsResult> => {
    try {
      // 參數驗證和預設值設定
      const page = Math.max(1, args.page ?? 1);
      const limit = Math.min(args.limit ?? 5, 20);
      const offset = (page - 1) * limit;
      
      // 步驟 1: 分離英文和中文關鍵詞
      const { english, chinese } = splitLanguageKeywords(args.query);
      const allKeywords = [...english, ...chinese];
      
      if (allKeywords.length === 0) {
        return {
          results: [],
          pagination: {
            page,
            per_page: limit,
            total_results: 0,
            has_more: false,
          },
          query: args.query,
          search_method: 'fts5',
          message: `No valid keywords found in query: "${args.query}"`,
        };
      }

      // 步驟 2: 執行 workflows 搜尋（使用資料庫的四層降級機制）
      const searchParams: {
        query: string;
        project_scope?: string;
        limit?: number;
      } = {
        query: args.query,
        limit: 100, // 先取較多結果，之後重新評分和分頁
      };
      
      if (args.project_scope) {
        searchParams.project_scope = args.project_scope;
      }
      
      const workflowSearchResults = db.searchWorkflows(searchParams);

      // 提取搜尋方法
      const stats = db.getStats();
      const searchMethod = stats.hasFTS5 ? 'fts5' : 'like';

      // 步驟 3: 對每個 workflow 載入 scratchpads 並計算權重分數
      const scoredResults = workflowSearchResults.map((workflow) => {
        // 載入該 workflow 的所有 scratchpads
        const scratchpads = db.listScratchpads({
          workflow_id: workflow.id,
          limit: 100, // 獲取所有 scratchpads 用於評分
        });
        
        // 計算權重分數
        const score = calculateWorkflowScore(
          {
            name: workflow.name,
            description: workflow.description,
          },
          scratchpads.map((sp) => ({
            title: sp.title,
            content: sp.content,
          })),
          allKeywords
        );

        return {
          workflow: {
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            created_at: formatTimestamp(workflow.created_at),
            updated_at: formatTimestamp(workflow.updated_at),
            scratchpad_count: workflow.scratchpad_count,
            is_active: workflow.is_active,
            project_scope: workflow.project_scope,
          },
          score,
          matching_scratchpads: scratchpads.length,
          rank: workflow.rank,
        };
      });

      // 步驟 4: 按分數排序（高分在前），分數相同時按 rank 排序
      scoredResults.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score; // 分數高的在前
        }
        return a.rank - b.rank; // 分數相同時 rank 小的在前（更相關）
      });

      // 步驟 5: 分頁處理
      const totalResults = scoredResults.length;
      const paginatedResults = scoredResults.slice(offset, offset + limit);
      const hasMore = offset + limit < totalResults;

      // 生成回應訊息
      let message = `Found ${totalResults} workflows for "${args.query}" using ${searchMethod}`;
      if (args.project_scope) {
        message += ` (project: ${args.project_scope})`;
      }
      if (totalResults > limit) {
        message += ` - Showing page ${page} of ${Math.ceil(totalResults / limit)}`;
      }

      // 加入關鍵詞分析資訊
      if (english.length > 0 && chinese.length > 0) {
        message += ` - Mixed language search: English(${english.join(', ')}) + Chinese(${chinese.join(', ')})`;
      } else if (chinese.length > 0) {
        message += ` - Chinese search: ${chinese.join(', ')}`;
      } else {
        message += ` - English search: ${english.join(', ')}`;
      }

      return {
        results: paginatedResults,
        pagination: {
          page,
          per_page: limit,
          total_results: totalResults,
          has_more: hasMore,
        },
        query: args.query,
        search_method: searchMethod,
        message,
      };
    } catch (error) {
      throw new Error(
        `Failed to search workflows: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };
};
