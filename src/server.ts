/**
 * Scratchpad MCP Server - A simplified context sharing server for Claude Code sub-agents
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ScratchpadDatabase } from './database/index.js';
import {
  createWorkflowTool,
  listWorkflowsTool,
  getLatestActiveWorkflowTool,
  updateWorkflowStatusTool,
  createScratchpadTool,
  getScratchpadTool,
  appendScratchpadTool,
  listScratchpadsTool,
  searchScratchpadsTool,
} from './tools/index.js';
import {
  validateCreateWorkflowArgs,
  validateCreateScratchpadArgs,
  validateGetScratchpadArgs,
  validateAppendScratchpadArgs,
  validateListScratchpadsArgs,
  validateSearchScratchpadsArgs,
  validateUpdateWorkflowStatusArgs,
  validateListWorkflowsArgs,
  validateGetLatestActiveWorkflowArgs,
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
    const listScratchpads = listScratchpadsTool(this.db);

    // Search tools
    const searchScratchpads = searchScratchpadsTool(this.db);

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
            description: 'Activate or deactivate a workflow. Only active workflows can have scratchpads created or modified.',
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
              },
              required: ['workflow_id', 'title', 'content'],
            },
          },
          {
            name: 'get-scratchpad',
            description: 'Retrieve a scratchpad by its ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'ID of the scratchpad to retrieve',
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
              },
              required: ['id', 'content'],
            },
          },
          {
            name: 'list-scratchpads',
            description: 'List scratchpads in a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: {
                  type: 'string',
                  description: 'ID of the workflow to list scratchpads from',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of scratchpads to return (default: 50, max: 100)',
                  minimum: 1,
                  maximum: 100,
                },
                offset: {
                  type: 'number',
                  description: 'Number of scratchpads to skip (default: 0)',
                  minimum: 0,
                },
              },
              required: ['workflow_id'],
            },
          },
          {
            name: 'search-scratchpads',
            description: 'Search for scratchpads using full-text search',
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
                  description: 'Maximum number of results to return (default: 20, max: 50)',
                  minimum: 1,
                  maximum: 50,
                },
              },
              required: ['query'],
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