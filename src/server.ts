/**
 * Scratchpad MCP Server - A simplified context sharing server for Claude Code sub-agents
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ScratchpadDatabase } from './database/index.js';
import {
  createWorkflowTool,
  listWorkflowsTool,
  getLatestActiveWorkflowTool,
  getWorkflowTool,
  updateWorkflowStatusTool,
  createScratchpadTool,
  getScratchpadTool,
  getScratchpadOutlineTool,
  appendScratchpadTool,
  tailScratchpadTool,
  chopScratchpadTool,
  enhancedUpdateScratchpadTool,
  listScratchpadsTool,
  searchScratchpadContentTool,
  searchWorkflowsTool,
  extractWorkflowInfoTool,
} from './tools/index.js';
import {
  handleToolError,
  createToolResponse,
  validateTailScratchpadArgs,
} from './server-helpers.js';

// Helper function to filter undefined values from objects
function filterUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const filtered: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (filtered as any)[key] = value;
    }
  }
  return filtered;
}

class ScratchpadMCPServer {
  private server: McpServer;
  private db: ScratchpadDatabase;
  private disabledTools: Set<string>;

  constructor() {
    this.server = new McpServer(
      {
        name: 'scratchpad-mcp-v2',
        version: '1.0.0',
      }
    );

    // Initialize database
    const dbPath = process.env['SCRATCHPAD_DB_PATH'] || './scratchpad.db';
    this.db = new ScratchpadDatabase({ filename: dbPath });
    
    // Parse disabled tools from environment variable
    this.disabledTools = this.parseDisabledTools();

    this.setupToolHandlers();

    // Handle cleanup on exit
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  private parseDisabledTools(): Set<string> {
    const disabled = process.env['SCRATCHPAD_DISABLED_TOOLS'] || '';
    return new Set(
      disabled
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
    );
  }

  private setupToolHandlers(): void {
    // Workflow management tools
    this.server.registerTool('create-workflow', {
      title: 'Create Workflow',
      description: 'Create a new workflow for organizing scratchpads',
      inputSchema: {
        name: z.string().describe('Name of the workflow'),
        description: z.string().optional().describe('Optional description of the workflow'),
        project_scope: z.string().optional().describe('Optional project scope to isolate workflows by project'),
      }
    }, async ({ name, description, project_scope }) => {
      try {
        const createWorkflowFn = createWorkflowTool(this.db);
        const result = await createWorkflowFn(filterUndefined({ name, description, project_scope }) as any);
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'create-workflow');
      }
    });

    this.server.registerTool('list-workflows', {
      title: 'List Workflows',
      description: 'List all available workflows',
      inputSchema: {
        project_scope: z.string().optional().describe('Optional project scope to filter workflows by project'),
        limit: z.number().min(1).max(100).optional().describe('Maximum number of workflows to return (default: 20, max: 100)'),
        offset: z.number().min(0).optional().describe('Number of workflows to skip for pagination (default: 0)'),
        preview_mode: z.boolean().optional().describe('Preview mode - truncate workflow descriptions for brevity'),
        max_content_chars: z.number().min(10).optional().describe('Maximum characters for workflow description content'),
        include_content: z.boolean().optional().describe('Whether to include workflow descriptions in response'),
      }
    }, async ({ project_scope, limit, offset, preview_mode, max_content_chars, include_content }) => {
      try {
        const listWorkflowsFn = listWorkflowsTool(this.db);
        const result = await listWorkflowsFn(filterUndefined({ project_scope, limit, offset, preview_mode, max_content_chars, include_content }) as any);
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'list-workflows');
      }
    });

    this.server.registerTool('get-latest-active-workflow', {
      title: 'Get Latest Active Workflow',
      description: 'Get the most recently updated active workflow',
      inputSchema: {
        project_scope: z.string().describe('Project scope to filter workflows by project'),
      }
    }, async ({ project_scope }) => {
      try {
        const getLatestActiveWorkflowFn = getLatestActiveWorkflowTool(this.db);
        const result = await getLatestActiveWorkflowFn({ project_scope });
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'get-latest-active-workflow');
      }
    });

    this.server.registerTool('get-workflow', {
      title: 'Get Workflow',
      description: 'Retrieve a workflow by its ID with optional scratchpads summary',
      inputSchema: {
        workflow_id: z.string().describe('ID of the workflow to retrieve'),
        include_scratchpads_summary: z.boolean().optional().describe('Whether to include scratchpads summary (default: true)'),
      }
    }, async ({ workflow_id, include_scratchpads_summary }) => {
      try {
        const getWorkflowFn = getWorkflowTool(this.db);
        const result = await getWorkflowFn(filterUndefined({ workflow_id, include_scratchpads_summary }) as any);
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'get-workflow');
      }
    });

    this.server.registerTool('update-workflow-status', {
      title: 'Update Workflow Status',
      description: 'Activate or deactivate a workflow. Only active workflows can have scratchpads created or modified.',
      inputSchema: {
        workflow_id: z.string().describe('ID of the workflow to update'),
        is_active: z.boolean().describe('Set to true to activate, false to deactivate the workflow'),
      }
    }, async ({ workflow_id, is_active }) => {
      try {
        const updateWorkflowStatusFn = updateWorkflowStatusTool(this.db);
        const result = await updateWorkflowStatusFn({ workflow_id, is_active });
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'update-workflow-status');
      }
    });

    // Scratchpad CRUD tools
    this.server.registerTool('create-scratchpad', {
      title: 'Create Scratchpad',
      description: 'Create a new scratchpad in a workflow',
      inputSchema: {
        workflow_id: z.string().describe('ID of the workflow to add the scratchpad to'),
        title: z.string().describe('Title of the scratchpad'),
        content: z.string().describe('Content of the scratchpad'),
        include_content: z.boolean().optional().describe('Whether to return full content in response (default: false, returns metadata only)'),
      }
    }, async ({ workflow_id, title, content, include_content }) => {
      try {
        const createScratchpadFn = createScratchpadTool(this.db);
        const result = await createScratchpadFn(filterUndefined({ workflow_id, title, content, include_content }) as any);
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'create-scratchpad');
      }
    });

    const getScratchpadToolInstance = this.server.registerTool('get-scratchpad', {
      title: 'Get Scratchpad',
      description: 'Retrieve a scratchpad by its ID with optional range selection. Supports line_range (specific lines) and line_context (line + surrounding context or block). Content truncated to 2000 chars by default.',
      inputSchema: {
        id: z.string().describe('ID of the scratchpad to retrieve'),
        line_range: z.object({
          start: z.number().min(1).describe('Starting line number (1-based)'),
          end: z.number().min(1).optional().describe('Ending line number (optional, defaults to end of file)'),
        }).optional().describe('Specify line range to extract'),
        line_context: z.object({
          line: z.number().min(1).describe('Target line number (1-based)'),
          before: z.number().min(0).optional().describe('Lines before target line (default: 2)'),
          after: z.number().min(0).optional().describe('Lines after target line (default: 2)'),
          include_block: z.boolean().optional().describe('Return entire block containing the target line (ignores before/after)'),
        }).optional().describe('Specify line with surrounding context'),
        preview_mode: z.boolean().optional().describe('Preview mode - returns ~200 chars with smart truncation. Takes precedence over max_content_chars.'),
        max_content_chars: z.number().min(10).optional().describe('Maximum characters limit (default: 2000). Only applies when include_content is not false.'),
        include_content: z.boolean().optional().describe('Whether to include content in response. false=metadata only (overrides other content options), true=include content.'),
      }
    }, async ({ id, line_range, line_context, preview_mode, max_content_chars, include_content }) => {
      try {
        const getScratchpadFn = getScratchpadTool(this.db);
        const result = await getScratchpadFn(filterUndefined({ id, line_range, line_context, preview_mode, max_content_chars, include_content }) as any);
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'get-scratchpad');
      }
    });
    
    // Conditionally disable get-scratchpad tool
    if (this.disabledTools.has('get-scratchpad')) {
      getScratchpadToolInstance.disable();
    }

    const getScratchpadOutlineToolInstance = this.server.registerTool('get-scratchpad-outline', {
      title: 'Get Scratchpad Outline',
      description: 'Parse and retrieve the markdown header structure of a scratchpad. Shows hierarchy with line numbers to help locate content sections.',
      inputSchema: {
        id: z.string().describe('ID of the scratchpad to analyze'),
        max_depth: z.number().min(1).max(6).optional().describe('Maximum header depth to include (1-6, default: unlimited)'),
        include_line_numbers: z.boolean().optional().describe('Whether to include line numbers in output (default: true)'),
        include_content_preview: z.boolean().optional().describe('Whether to include content preview for each section (default: false)'),
      }
    }, async ({ id, max_depth, include_line_numbers, include_content_preview }) => {
      try {
        const getScratchpadOutlineFn = getScratchpadOutlineTool(this.db);
        const result = await getScratchpadOutlineFn(filterUndefined({ id, max_depth, include_line_numbers, include_content_preview }) as any);
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'get-scratchpad-outline');
      }
    });
    
    // Conditionally disable get-scratchpad-outline tool
    if (this.disabledTools.has('get-scratchpad-outline')) {
      getScratchpadOutlineToolInstance.disable();
    }

    this.server.registerTool('append-scratchpad', {
      title: 'Append Scratchpad',
      description: 'Append content to an existing scratchpad',
      inputSchema: {
        id: z.string().describe('ID of the scratchpad to append to'),
        content: z.string().describe('Content to append to the scratchpad'),
        include_content: z.boolean().optional().describe('Whether to return full content in response (default: false, returns metadata only)'),
      }
    }, async ({ id, content, include_content }) => {
      try {
        const appendScratchpadFn = appendScratchpadTool(this.db);
        const result = await appendScratchpadFn(filterUndefined({ id, content, include_content }) as any);
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'append-scratchpad');
      }
    });

    this.server.registerTool('tail-scratchpad', {
      title: 'Tail Scratchpad',
      description: 'Get tail content from scratchpad (default: last 50 lines), or full content with full_content=true. Use include_content=false for metadata only.',
      inputSchema: {
        id: z.string().describe('ID of the scratchpad to get tail from'),
        tail_size: z.object({
          lines: z.number().min(1).optional().describe('Number of lines to return from the end'),
          chars: z.number().min(1).optional().describe('Number of characters to return from the end'),
          blocks: z.number().min(1).optional().describe('Number of blocks to return from the end')
        }).refine(data => {
          const fields = [data.lines, data.chars, data.blocks].filter(v => v !== undefined);
          return fields.length === 1;
        }, {
          message: "Exactly one of lines, chars, or blocks must be specified"
        }).optional().describe('Tail size specification - choose either lines OR chars OR blocks, not multiple'),
        include_content: z.boolean().optional().describe('Whether to include content in response (default: true)'),
        full_content: z.boolean().optional().describe('Whether to return full content instead of tail (overrides tail_size). Use this as alternative to get-scratchpad.'),
      }
    }, async ({ id, tail_size, include_content, full_content }) => {
      try {
        const tailScratchpadFn = tailScratchpadTool(this.db);
        const validatedArgs = validateTailScratchpadArgs({ id, tail_size, include_content, full_content });
        const result = await tailScratchpadFn(validatedArgs);
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'tail-scratchpad');
      }
    });

    this.server.registerTool('chop-scratchpad', {
      title: 'Chop Scratchpad',
      description: 'Remove lines or blocks from the end of a scratchpad. Does not return content after completion.',
      inputSchema: {
        id: z.string().describe('ID of the scratchpad to chop content from'),
        lines: z.number().min(1).optional().describe('Number of lines to remove from the end (default: 1)'),
        blocks: z.number().min(1).optional().describe('Number of blocks to remove from the end'),
      }
    }, async ({ id, lines, blocks }) => {
      try {
        const chopScratchpadFn = chopScratchpadTool(this.db);
        const result = await chopScratchpadFn(filterUndefined({ id, lines, blocks }) as any);
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'chop-scratchpad');
      }
    });

    this.server.registerTool('update-scratchpad', {
      title: 'Update Scratchpad',
      description: 'Enhanced multi-mode scratchpad editing tool. Supports four editing modes: replace (complete replacement), insert_at_line (insert at specific line), replace_lines (replace line range), append_section (smart append after markdown section marker). Provides detailed operation feedback.',
      inputSchema: {
        id: z.string().describe('ID of the scratchpad to edit'),
        mode: z.enum(['replace', 'insert_at_line', 'replace_lines', 'append_section']).describe('Editing mode to use'),
        content: z.string().describe('Content to insert, replace, or append'),
        include_content: z.boolean().optional().describe('Whether to include content in response (default: false)'),
        line_number: z.number().min(1).optional().describe('Line number for insert_at_line mode (1-based indexing)'),
        start_line: z.number().min(1).optional().describe('Start line for replace_lines mode (1-based, inclusive)'),
        end_line: z.number().min(1).optional().describe('End line for replace_lines mode (1-based, inclusive)'),
        section_marker: z.string().optional().describe('Section marker for append_section mode (e.g., "## Features", "# TODO")'),
      }
    }, async ({ id, mode, content, include_content, line_number, start_line, end_line, section_marker }) => {
      try {
        const enhancedUpdateScratchpadFn = enhancedUpdateScratchpadTool(this.db);
        const result = await enhancedUpdateScratchpadFn(filterUndefined({ id, mode, content, include_content, line_number, start_line, end_line, section_marker }) as any);
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'update-scratchpad');
      }
    });

    this.server.registerTool('list-scratchpads', {
      title: 'List Scratchpads',
      description: 'List scratchpads in a workflow. Options: preview_mode (quick overview), max_content_chars (size limit), include_content=false (metadata only). Priority: include_content > preview_mode > max_content_chars.',
      inputSchema: {
        workflow_id: z.string().describe('ID of the workflow to list scratchpads from'),
        limit: z.number().min(1).max(50).optional().describe('Maximum number of scratchpads to return (default: 20, max: 50)'),
        offset: z.number().min(0).optional().describe('Number of scratchpads to skip (default: 0)'),
        preview_mode: z.boolean().optional().describe('Preview mode - return truncated content for brevity'),
        max_content_chars: z.number().min(10).optional().describe('Maximum characters per scratchpad content'),
        include_content: z.boolean().optional().describe('Whether to include full content in response'),
      }
    }, async ({ workflow_id, limit, offset, preview_mode, max_content_chars, include_content }) => {
      try {
        const listScratchpadsFn = listScratchpadsTool(this.db);
        const result = await listScratchpadsFn(filterUndefined({ workflow_id, limit, offset, preview_mode, max_content_chars, include_content }) as any);
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'list-scratchpads');
      }
    });

    this.server.registerTool('search-scratchpad-content', {
      title: 'Search Scratchpad Content',
      description: 'Search within a single scratchpad content using string or regex patterns. Similar to VS Code Ctrl+F or grep for a single file. Supports context-aware search results with line-based context.',
      inputSchema: {
        id: z.string().describe('ID of the scratchpad to search within'),
        query: z.string().optional().describe('String search pattern (cannot be used with queryRegex)'),
        queryRegex: z.string().optional().describe('Regular expression search pattern (cannot be used with query)'),
        preview_mode: z.boolean().optional().describe('Preview mode - return truncated content for search results'),
        max_content_chars: z.number().min(10).optional().describe('Maximum characters per match snippet'),
        include_content: z.boolean().optional().describe('Whether to include content in search results'),
        context_lines_before: z.number().min(0).max(50).optional().describe('Number of lines to show before each match (0-50)'),
        context_lines_after: z.number().min(0).max(50).optional().describe('Number of lines to show after each match (0-50)'),
        context_lines: z.number().min(0).max(50).optional().describe('Number of lines to show both before and after each match (shorthand, 0-50)'),
        max_context_matches: z.number().min(1).max(20).optional().describe('Maximum number of matches to show context for (default: 5, max: 20)'),
        merge_context: z.boolean().optional().describe('Whether to merge overlapping context ranges (default: true)'),
        show_line_numbers: z.boolean().optional().describe('Whether to show line numbers in context output'),
      }
    }, async ({ id, query, queryRegex, preview_mode, max_content_chars, include_content, context_lines_before, context_lines_after, context_lines, max_context_matches, merge_context, show_line_numbers }) => {
      try {
        const searchScratchpadContentFn = searchScratchpadContentTool(this.db);
        const result = await searchScratchpadContentFn(filterUndefined({ id, query, queryRegex, preview_mode, max_content_chars, include_content, context_lines_before, context_lines_after, context_lines, max_context_matches, merge_context, show_line_numbers }) as any);
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'search-scratchpad-content');
      }
    });

    this.server.registerTool('search-workflows', {
      title: 'Search Workflows',
      description: 'Search workflows with weighted scoring based on scratchpads content. Uses the "search workflows first, then load scratchpads" strategy with 5/3/3/1 weighted scoring (workflows.name/description, scratchpads.title/content). Supports mixed English/Chinese queries with automatic language separation and 4-tier fallback (FTS5 → LIKE).\n\nFEATURES:\n• Weighted scoring: workflows.name (5pts), workflows.description (3pts), scratchpads.title (3pts), scratchpads.content (1pt)\n• Mixed language support: "React組件" → English: ["React"] + Chinese: ["組件"]\n• Project isolation: project_scope parameter for exact match filtering\n• Smart pagination: 5 items per page (default: page 1)\n• Comprehensive search: workflows + ALL scratchpads content under those workflows\n• Performance optimized: search workflows first, then load scratchpads for scoring\n\nUSAGE EXAMPLES:\n• Basic search: {"query": "authentication"}\n• Project-scoped: {"query": "user login", "project_scope": "myapp"}\n• Pagination: {"query": "React", "page": 2, "limit": 10}\n• Mixed language: {"query": "React組件開發", "useJieba": true}\n• English-only: {"query": "database connection pool"}',
      inputSchema: {
        query: z.string().describe('Search query string (supports mixed English/Chinese)'),
        project_scope: z.string().optional().describe('Optional project scope for exact match filtering (isolates workflows by project)'),
        page: z.number().min(1).optional().describe('Page number for pagination (default: 1)'),
        limit: z.number().min(1).max(20).optional().describe('Items per page (default: 5, max: 20)'),
        useJieba: z.boolean().optional().describe('Force jieba Chinese tokenization (auto-detect by default)'),
      }
    }, async ({ query, project_scope, page, limit, useJieba }) => {
      try {
        const searchWorkflowsFn = searchWorkflowsTool(this.db);
        const result = await searchWorkflowsFn(filterUndefined({ query, project_scope, page, limit, useJieba }) as any);
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'search-workflows');
      }
    });

    this.server.registerTool('extract-workflow-info', {
      title: 'Extract Workflow Info',
      description: 'Extract specific information from a workflow using OpenAI model',
      inputSchema: {
        workflow_id: z.string().describe('ID of the workflow to extract information from'),
        extraction_prompt: z.string().describe('Specific prompt describing what information to extract'),
        model: z.string().optional().describe('OpenAI model to use (default: gpt-5-nano)'),
        reasoning_effort: z.enum(['minimal', 'low', 'medium', 'high']).optional().describe('Reasoning effort level for GPT-5 models (default: medium)'),
      }
    }, async ({ workflow_id, extraction_prompt, model, reasoning_effort }) => {
      try {
        const extractWorkflowInfoFn = extractWorkflowInfoTool(this.db);
        const result = await extractWorkflowInfoFn(filterUndefined({ workflow_id, extraction_prompt, model, reasoning_effort }) as any);
        return createToolResponse(result);
      } catch (error) {
        return handleToolError(error, 'extract-workflow-info');
      }
    });
  }

  private cleanup(): void {
    console.error('Shutting down Scratchpad MCP Server...');
    this.db.close();
    process.exit(0);
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Scratchpad MCP Server running on stdio');
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ScratchpadMCPServer();
  server.run().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
