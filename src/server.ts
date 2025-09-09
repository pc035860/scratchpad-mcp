/**
 * Scratchpad MCP Server - A simplified context sharing server for Claude Code sub-agents
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ScratchpadDatabase } from './database/index.js';
import {
  createWorkflowTool,
  listWorkflowsTool,
  getLatestActiveWorkflowTool,
  updateWorkflowStatusTool,
  createScratchpadTool,
  getScratchpadTool,
  appendScratchpadTool,
  tailScratchpadTool,
  chopScratchpadTool,
  enhancedUpdateScratchpadTool,
  listScratchpadsTool,
  searchScratchpadsTool,
  extractWorkflowInfoTool,
} from './tools/index.js';
import {
  validateCreateWorkflowArgs,
  validateCreateScratchpadArgs,
  validateGetScratchpadArgs,
  validateAppendScratchpadArgs,
  validateTailScratchpadArgs,
  validateChopScratchpadArgs,
  validateEnhancedUpdateScratchpadArgs,
  validateListScratchpadsArgs,
  validateSearchScratchpadsArgs,
  validateUpdateWorkflowStatusArgs,
  validateListWorkflowsArgs,
  validateGetLatestActiveWorkflowArgs,
  validateExtractWorkflowInfoArgs,
  handleToolError,
  createToolResponse,
} from './server-helpers.js';

class ScratchpadMCPServer {
  private server: Server;
  private db: ScratchpadDatabase;

  constructor() {
    this.server = new Server(
      {
        name: 'scratchpad-mcp-v2',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize database
    const dbPath = process.env['SCRATCHPAD_DB_PATH'] || './scratchpad.db';
    this.db = new ScratchpadDatabase({ filename: dbPath });

    this.setupToolHandlers();
    this.setupRequestHandlers();

    // Handle cleanup on exit
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  private setupToolHandlers(): void {
    // Workflow management tools
    const createWorkflow = createWorkflowTool(this.db);
    const listWorkflows = listWorkflowsTool(this.db);
    const getLatestActiveWorkflow = getLatestActiveWorkflowTool(this.db);
    const updateWorkflowStatus = updateWorkflowStatusTool(this.db);

    // Scratchpad CRUD tools
    const createScratchpad = createScratchpadTool(this.db);
    const getScratchpad = getScratchpadTool(this.db);
    const appendScratchpad = appendScratchpadTool(this.db);
    const tailScratchpad = tailScratchpadTool(this.db);
    const chopScratchpad = chopScratchpadTool(this.db);
    const enhancedUpdateScratchpad = enhancedUpdateScratchpadTool(this.db);
    const listScratchpads = listScratchpadsTool(this.db);

    // Search tools
    const searchScratchpads = searchScratchpadsTool(this.db);

    // GPT-5 extraction tools
    const extractWorkflowInfo = extractWorkflowInfoTool(this.db);

    // Register tool handlers
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create-workflow': {
            const validatedArgs = validateCreateWorkflowArgs(args);
            const result = await createWorkflow(validatedArgs);
            return createToolResponse(result);
          }

          case 'list-workflows': {
            const validatedArgs = validateListWorkflowsArgs(args);
            const result = await listWorkflows(validatedArgs);
            return createToolResponse(result);
          }

          case 'get-latest-active-workflow': {
            const validatedArgs = validateGetLatestActiveWorkflowArgs(args);
            const result = await getLatestActiveWorkflow(validatedArgs);
            return createToolResponse(result);
          }

          case 'update-workflow-status': {
            const validatedArgs = validateUpdateWorkflowStatusArgs(args);
            const result = await updateWorkflowStatus(validatedArgs);
            return createToolResponse(result);
          }

          case 'create-scratchpad': {
            const validatedArgs = validateCreateScratchpadArgs(args);
            const result = await createScratchpad(validatedArgs);
            return createToolResponse(result);
          }

          case 'get-scratchpad': {
            const validatedArgs = validateGetScratchpadArgs(args);
            const result = await getScratchpad(validatedArgs);
            return createToolResponse(result);
          }

          case 'append-scratchpad': {
            const validatedArgs = validateAppendScratchpadArgs(args);
            const result = await appendScratchpad(validatedArgs);
            return createToolResponse(result);
          }

          case 'tail-scratchpad': {
            const validatedArgs = validateTailScratchpadArgs(args);
            const result = await tailScratchpad(validatedArgs);
            return createToolResponse(result);
          }

          case 'chop-scratchpad': {
            const validatedArgs = validateChopScratchpadArgs(args);
            const result = await chopScratchpad(validatedArgs);
            return createToolResponse(result);
          }

          case 'update-scratchpad': {
            const validatedArgs = validateEnhancedUpdateScratchpadArgs(args);
            const result = await enhancedUpdateScratchpad(validatedArgs);
            return createToolResponse(result);
          }

          case 'list-scratchpads': {
            const validatedArgs = validateListScratchpadsArgs(args);
            const result = await listScratchpads(validatedArgs);
            return createToolResponse(result);
          }

          case 'search-scratchpads': {
            const validatedArgs = validateSearchScratchpadsArgs(args);
            const result = await searchScratchpads(validatedArgs);
            return createToolResponse(result);
          }

          case 'extract-workflow-info': {
            const validatedArgs = validateExtractWorkflowInfoArgs(args);
            const result = await extractWorkflowInfo(validatedArgs);
            return createToolResponse(result);
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return handleToolError(error, name);
      }
    });
  }

  private setupRequestHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create-workflow',
            description: 'Create a new workflow for organizing scratchpads',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the workflow',
                },
                description: {
                  type: 'string',
                  description: 'Optional description of the workflow',
                },
                project_scope: {
                  type: 'string',
                  description: 'Optional project scope to isolate workflows by project',
                },
              },
              required: ['name'],
            },
          },
          {
            name: 'list-workflows',
            description: 'List all available workflows',
            inputSchema: {
              type: 'object',
              properties: {
                project_scope: {
                  type: 'string',
                  description: 'Optional project scope to filter workflows by project',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of workflows to return (default: 20, max: 100)',
                  minimum: 1,
                  maximum: 100,
                },
                offset: {
                  type: 'number',
                  description: 'Number of workflows to skip for pagination (default: 0)',
                  minimum: 0,
                },
                preview_mode: {
                  type: 'boolean',
                  description: 'Preview mode - truncate workflow descriptions for brevity',
                },
                max_content_chars: {
                  type: 'number',
                  description: 'Maximum characters for workflow description content',
                  minimum: 10,
                },
                include_content: {
                  type: 'boolean',
                  description: 'Whether to include workflow descriptions in response',
                },
              },
            },
          },
          {
            name: 'get-latest-active-workflow',
            description: 'Get the most recently updated active workflow',
            inputSchema: {
              type: 'object',
              properties: {
                project_scope: {
                  type: 'string',
                  description: 'Optional project scope to filter workflows by project',
                },
              },
            },
          },
          {
            name: 'update-workflow-status',
            description:
              'Activate or deactivate a workflow. Only active workflows can have scratchpads created or modified.',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: {
                  type: 'string',
                  description: 'ID of the workflow to update',
                },
                is_active: {
                  type: 'boolean',
                  description: 'Set to true to activate, false to deactivate the workflow',
                },
              },
              required: ['workflow_id', 'is_active'],
            },
          },
          {
            name: 'create-scratchpad',
            description: 'Create a new scratchpad in a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: {
                  type: 'string',
                  description: 'ID of the workflow to add the scratchpad to',
                },
                title: {
                  type: 'string',
                  description: 'Title of the scratchpad',
                },
                content: {
                  type: 'string',
                  description: 'Content of the scratchpad',
                },
                include_content: {
                  type: 'boolean',
                  description:
                    'Whether to return full content in response (default: false, returns metadata only)',
                },
              },
              required: ['workflow_id', 'title', 'content'],
            },
          },
          {
            name: 'get-scratchpad',
            description:
              'Retrieve a scratchpad by its ID (content truncated to 2000 chars by default). Use max_content_chars to adjust limit, preview_mode for quick overview, or include_content=false for metadata only.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'ID of the scratchpad to retrieve',
                },
                preview_mode: {
                  type: 'boolean',
                  description:
                    'Preview mode - returns ~200 chars with smart truncation. Takes precedence over max_content_chars.',
                },
                max_content_chars: {
                  type: 'number',
                  description:
                    'Maximum characters limit (default: 2000). Only applies when include_content is not false.',
                  minimum: 10,
                },
                include_content: {
                  type: 'boolean',
                  description:
                    'Whether to include content in response. false=metadata only (overrides other content options), true=include content.',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'append-scratchpad',
            description: 'Append content to an existing scratchpad',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'ID of the scratchpad to append to',
                },
                content: {
                  type: 'string',
                  description: 'Content to append to the scratchpad',
                },
                include_content: {
                  type: 'boolean',
                  description:
                    'Whether to return full content in response (default: false, returns metadata only)',
                },
              },
              required: ['id', 'content'],
            },
          },
          {
            name: 'tail-scratchpad',
            description:
              'Get tail content from scratchpad (default: last 50 lines), or full content with full_content=true. Use include_content=false for metadata only.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'ID of the scratchpad to get tail from',
                },
                tail_size: {
                  type: 'object',
                  description: 'Tail size specification - choose either lines OR chars OR blocks, not multiple',
                  oneOf: [
                    {
                      type: 'object',
                      properties: {
                        lines: {
                          type: 'number',
                          description: 'Number of lines to return from the end',
                          minimum: 1,
                        },
                      },
                      required: ['lines'],
                      additionalProperties: false,
                    },
                    {
                      type: 'object',
                      properties: {
                        chars: {
                          type: 'number',
                          description: 'Number of characters to return from the end',
                          minimum: 1,
                        },
                      },
                      required: ['chars'],
                      additionalProperties: false,
                    },
                    {
                      type: 'object',
                      properties: {
                        blocks: {
                          type: 'number',
                          description: 'Number of blocks to return from the end',
                          minimum: 1,
                        },
                      },
                      required: ['blocks'],
                      additionalProperties: false,
                    },
                  ],
                },
                include_content: {
                  type: 'boolean',
                  description: 'Whether to include content in response (default: true)',
                },
                full_content: {
                  type: 'boolean',
                  description:
                    'Whether to return full content instead of tail (overrides tail_size). Use this as alternative to get-scratchpad.',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'chop-scratchpad',
            description:
              'Remove lines or blocks from the end of a scratchpad. Does not return content after completion.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'ID of the scratchpad to chop content from',
                },
                lines: {
                  type: 'number',
                  description: 'Number of lines to remove from the end (default: 1)',
                  minimum: 1,
                },
                blocks: {
                  type: 'number',
                  description: 'Number of blocks to remove from the end',
                  minimum: 1,
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'update-scratchpad',
            description: 'Enhanced multi-mode scratchpad editing tool. Supports four editing modes: replace (complete replacement), insert_at_line (insert at specific line), replace_lines (replace line range), append_section (smart append after markdown section marker). Provides detailed operation feedback.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'ID of the scratchpad to edit',
                },
                mode: {
                  type: 'string',
                  enum: ['replace', 'insert_at_line', 'replace_lines', 'append_section'],
                  description: 'Editing mode to use',
                },
                content: {
                  type: 'string',
                  description: 'Content to insert, replace, or append',
                },
                include_content: {
                  type: 'boolean',
                  description: 'Whether to include content in response (default: false)',
                },
                line_number: {
                  type: 'number',
                  description: 'Line number for insert_at_line mode (1-based indexing)',
                  minimum: 1,
                },
                start_line: {
                  type: 'number',
                  description: 'Start line for replace_lines mode (1-based, inclusive)',
                  minimum: 1,
                },
                end_line: {
                  type: 'number',
                  description: 'End line for replace_lines mode (1-based, inclusive)',
                  minimum: 1,
                },
                section_marker: {
                  type: 'string',
                  description: 'Section marker for append_section mode (e.g., "## Features", "# TODO")',
                },
              },
              required: ['id', 'mode', 'content'],
            },
          },
          {
            name: 'list-scratchpads',
            description:
              'List scratchpads in a workflow. Options: preview_mode (quick overview), max_content_chars (size limit), include_content=false (metadata only). Priority: include_content > preview_mode > max_content_chars.',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: {
                  type: 'string',
                  description: 'ID of the workflow to list scratchpads from',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of scratchpads to return (default: 20, max: 50)',
                  minimum: 1,
                  maximum: 50,
                },
                offset: {
                  type: 'number',
                  description: 'Number of scratchpads to skip (default: 0)',
                  minimum: 0,
                },
                preview_mode: {
                  type: 'boolean',
                  description: 'Preview mode - return truncated content for brevity',
                },
                max_content_chars: {
                  type: 'number',
                  description: 'Maximum characters per scratchpad content',
                  minimum: 10,
                },
                include_content: {
                  type: 'boolean',
                  description: 'Whether to include full content in response',
                },
              },
              required: ['workflow_id'],
            },
          },
          {
            name: 'search-scratchpads',
            description:
              'Search for scratchpads using intelligent full-text search with multi-stage fallback. Supports context-aware search similar to grep -A -B -C. Content control same as list-scratchpads: include_content > preview_mode > max_content_chars.\n\nSEARCH BEHAVIOR:\n• Multi-word queries use AND logic with intelligent tokenization\n• Search method priority: Jieba (Chinese) → Simple → FTS5 → LIKE fallback\n• Simple tokenizer handles mixed Chinese/English content effectively\n• Single words: "authentication", "error", "component" ✓\n• Multi-word AND: "NavTop CartSwitchTabs", "guided level", "user login" ✓\n• Non-existent terms return empty results (expected behavior)\n\nUSAGE EXAMPLES:\n• Basic search: {"query": "authentication"}\n• Multi-word search: {"query": "NavTop CartSwitchTabs"} - finds content containing ALL terms\n• Context search: {"query": "error", "context_lines": 3} - Shows 3 lines before/after each match\n• Asymmetric context: {"query": "function", "context_lines_before": 2, "context_lines_after": 5}\n• With line numbers: {"query": "bug", "context_lines": 2, "show_line_numbers": true}\n• Limit matches: {"query": "TODO", "context_lines": 1, "max_context_matches": 3}\n• Chinese support: {"query": "用戶登入", "useJieba": true} - force Chinese tokenization\n• No merging: {"query": "import", "context_lines": 1, "merge_context": false}',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query string',
                },
                workflow_id: {
                  type: 'string',
                  description: 'Optional workflow ID to limit search to specific workflow',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 10, max: 20)',
                  minimum: 1,
                  maximum: 20,
                },
                offset: {
                  type: 'number',
                  description: 'Number of results to skip for pagination (default: 0)',
                  minimum: 0,
                },
                preview_mode: {
                  type: 'boolean',
                  description: 'Preview mode - return truncated content for search results',
                },
                max_content_chars: {
                  type: 'number',
                  description: 'Maximum characters per scratchpad content in search results',
                  minimum: 10,
                },
                include_content: {
                  type: 'boolean',
                  description: 'Whether to include full content in search results',
                },
                useJieba: {
                  type: 'boolean',
                  description: 'Force jieba tokenization (auto-detect by default)',
                },
                context_lines_before: {
                  type: 'number',
                  description: 'Number of lines to show before each match (0-50)',
                  minimum: 0,
                  maximum: 50,
                },
                context_lines_after: {
                  type: 'number',
                  description: 'Number of lines to show after each match (0-50)',
                  minimum: 0,
                  maximum: 50,
                },
                context_lines: {
                  type: 'number',
                  description: 'Number of lines to show both before and after each match (shorthand, 0-50)',
                  minimum: 0,
                  maximum: 50,
                },
                max_context_matches: {
                  type: 'number',
                  description: 'Maximum number of matches to show context for (default: 5, max: 20)',
                  minimum: 1,
                  maximum: 20,
                },
                merge_context: {
                  type: 'boolean',
                  description: 'Whether to merge overlapping context ranges (default: true)',
                },
                show_line_numbers: {
                  type: 'boolean',
                  description: 'Whether to show line numbers in context output',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'extract-workflow-info',
            description: 'Extract specific information from a workflow using OpenAI model',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: {
                  type: 'string',
                  description: 'ID of the workflow to extract information from',
                },
                extraction_prompt: {
                  type: 'string',
                  description: 'Specific prompt describing what information to extract',
                },
                model: {
                  type: 'string',
                  description: 'OpenAI model to use (default: gpt-5-nano)',
                },
                reasoning_effort: {
                  type: 'string',
                  description: 'Reasoning effort level for GPT-5 models (default: medium)',
                  enum: ['minimal', 'low', 'medium', 'high'],
                },
              },
              required: ['workflow_id', 'extraction_prompt'],
            },
          },
        ],
      };
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
