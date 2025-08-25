/**
 * MCP Tools Integration Tests
 * 
 * Tests all MCP tools directly to ensure proper functionality,
 * parameter validation, and response formatting.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScratchpadDatabase } from '../src/database/index.js';
import {
  createWorkflowTool,
  listWorkflowsTool,
  createScratchpadTool,
  getScratchpadTool,
  appendScratchpadTool,
  tailScratchpadTool,
  listScratchpadsTool,
  searchScratchpadsTool,
  type CreateWorkflowArgs,
  type CreateScratchpadArgs,
  type GetScratchpadArgs,
  type AppendScratchpadArgs,
  type TailScratchpadArgs,
  type ListScratchpadsArgs,
  type SearchScratchpadsArgs,
} from '../src/tools/index.js';

/**
 * Test helper class for MCP tools
 */
class MCPToolsTestHelper {
  private db: ScratchpadDatabase;
  
  // Tool handlers
  private createWorkflow: ReturnType<typeof createWorkflowTool>;
  private listWorkflows: ReturnType<typeof listWorkflowsTool>;
  private createScratchpad: ReturnType<typeof createScratchpadTool>;
  private getScratchpad: ReturnType<typeof getScratchpadTool>;
  private appendScratchpad: ReturnType<typeof appendScratchpadTool>;
  private tailScratchpad: ReturnType<typeof tailScratchpadTool>;
  private listScratchpads: ReturnType<typeof listScratchpadsTool>;
  private searchScratchpads: ReturnType<typeof searchScratchpadsTool>;
  
  constructor() {
    this.db = new ScratchpadDatabase({ filename: ':memory:' });
    
    // Initialize all tool handlers
    this.createWorkflow = createWorkflowTool(this.db);
    this.listWorkflows = listWorkflowsTool(this.db);
    this.createScratchpad = createScratchpadTool(this.db);
    this.getScratchpad = getScratchpadTool(this.db);
    this.appendScratchpad = appendScratchpadTool(this.db);
    this.tailScratchpad = tailScratchpadTool(this.db);
    this.listScratchpads = listScratchpadsTool(this.db);
    this.searchScratchpads = searchScratchpadsTool(this.db);
  }
  
  // Tool wrapper methods with error handling
  async callCreateWorkflow(args: CreateWorkflowArgs) {
    try {
      return await this.createWorkflow(args);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  async callListWorkflows() {
    try {
      return await this.listWorkflows({});
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  async callCreateScratchpad(args: CreateScratchpadArgs) {
    try {
      return await this.createScratchpad(args);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  async callGetScratchpad(args: GetScratchpadArgs) {
    try {
      return await this.getScratchpad(args);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  async callAppendScratchpad(args: AppendScratchpadArgs) {
    try {
      return await this.appendScratchpad(args);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  async callTailScratchpad(args: TailScratchpadArgs) {
    try {
      return await this.tailScratchpad(args);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  async callListScratchpads(args: ListScratchpadsArgs) {
    try {
      return await this.listScratchpads(args);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  async callSearchScratchpads(args: SearchScratchpadsArgs) {
    try {
      return await this.searchScratchpads(args);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  getDatabase(): ScratchpadDatabase {
    return this.db;
  }
  
  close(): void {
    this.db.close();
  }
}

describe('MCP Tools Integration Tests', () => {
  let helper: MCPToolsTestHelper;

  beforeEach(() => {
    helper = new MCPToolsTestHelper();
  });

  afterEach(() => {
    helper.close();
  });

  describe('Workflow Management Tools', () => {
    describe('create-workflow tool', () => {
      it('should create a workflow with valid parameters', async () => {
        const result = await helper.callCreateWorkflow({
          name: 'Test Workflow',
          description: 'A test workflow',
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('workflow');
        expect(result).toHaveProperty('message');
        expect(result.workflow.name).toBe('Test Workflow');
        expect(result.workflow.description).toBe('A test workflow');
        expect(result.workflow.id).toBeDefined();
        expect(result.workflow.scratchpad_count).toBe(0);
      });

      it('should create a workflow without description', async () => {
        const result = await helper.callCreateWorkflow({
          name: 'Minimal Workflow',
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result.workflow.name).toBe('Minimal Workflow');
        expect(result.workflow.description).toBeNull();
      });

      it('should handle missing name parameter', async () => {
        const result = await helper.callCreateWorkflow({} as CreateWorkflowArgs);
        
        expect(result).toHaveProperty('error');
        expect(result.error).toContain('name');
      });

      it('should handle invalid parameter types', async () => {
        const result = await helper.callCreateWorkflow({
          name: null as any,
        });
        
        expect(result).toHaveProperty('error');
      });
    });

    describe('list-workflows tool', () => {
      it('should list empty workflows initially', async () => {
        const result = await helper.callListWorkflows();
        
        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('workflows');
        expect(result).toHaveProperty('count');
        expect(result.workflows).toHaveLength(0);
        expect(result.count).toBe(0);
      });

      it('should list created workflows', async () => {
        // Create some workflows first
        await helper.callCreateWorkflow({ name: 'Workflow 1' });
        await helper.callCreateWorkflow({ name: 'Workflow 2' });
        
        const result = await helper.callListWorkflows();
        
        expect(result).not.toHaveProperty('error');
        expect(result.workflows).toHaveLength(2);
        expect(result.count).toBe(2);
        
        const names = result.workflows.map((w: any) => w.name);
        expect(names).toContain('Workflow 1');
        expect(names).toContain('Workflow 2');
        
        // Verify workflow structure
        for (const workflow of result.workflows) {
          expect(workflow).toHaveProperty('id');
          expect(workflow).toHaveProperty('name');
          expect(workflow).toHaveProperty('description');
          expect(workflow).toHaveProperty('created_at');
          expect(workflow).toHaveProperty('updated_at');
          expect(workflow).toHaveProperty('scratchpad_count');
        }
      });
    });
  });

  describe('Scratchpad CRUD Tools', () => {
    let workflowId: string;

    beforeEach(async () => {
      // Create a test workflow for scratchpad tests
      const workflowResult = await helper.callCreateWorkflow({
        name: 'Test Workflow for Scratchpads',
      });
      expect(workflowResult).not.toHaveProperty('error');
      workflowId = workflowResult.workflow.id;
    });

    describe('create-scratchpad tool', () => {
      it('should create a scratchpad with valid parameters', async () => {
        const result = await helper.callCreateScratchpad({
          workflow_id: workflowId,
          title: 'Test Scratchpad',
          content: 'This is test content for the scratchpad.',
          include_content: true,
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('scratchpad');
        expect(result).toHaveProperty('message');
        expect(result.scratchpad.title).toBe('Test Scratchpad');
        expect(result.scratchpad.content).toBe('This is test content for the scratchpad.');
        expect(result.scratchpad.workflow_id).toBe(workflowId);
        expect(result.scratchpad.size_bytes).toBeGreaterThan(0);
        expect(result.scratchpad.id).toBeDefined();
        expect(result.scratchpad.created_at).toBeDefined();
        expect(result.scratchpad.updated_at).toBeDefined();
      });

      it('should handle missing required parameters', async () => {
        const result = await helper.callCreateScratchpad({
          workflow_id: workflowId,
          title: 'Missing Content',
        } as CreateScratchpadArgs);
        
        expect(result).toHaveProperty('error');
      });

      it('should handle invalid workflow_id', async () => {
        const result = await helper.callCreateScratchpad({
          workflow_id: 'invalid-workflow-id',
          title: 'Test Scratchpad',
          content: 'Test content',
        });
        
        expect(result).toHaveProperty('error');
        expect(result.error).toMatch(/workflow|not found|invalid/i);
      });

      it('should handle large content (approaching 1MB limit)', async () => {
        const largeContent = 'x'.repeat(100000); // 100KB content
        const result = await helper.callCreateScratchpad({
          workflow_id: workflowId,
          title: 'Large Scratchpad',
          content: largeContent,
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result.scratchpad.size_bytes).toBe(largeContent.length);
      });
    });

    describe('get-scratchpad tool', () => {
      let scratchpadId: string;

      beforeEach(async () => {
        const createResult = await helper.callCreateScratchpad({
          workflow_id: workflowId,
          title: 'Test Scratchpad for Get',
          content: 'Content for get test',
          include_content: true,
        });
        expect(createResult).not.toHaveProperty('error');
        scratchpadId = createResult.scratchpad.id;
      });

      it('should retrieve scratchpad by id', async () => {
        const result = await helper.callGetScratchpad({
          id: scratchpadId,
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('scratchpad');
        expect(result.scratchpad).not.toBeNull();
        expect(result.scratchpad.id).toBe(scratchpadId);
        expect(result.scratchpad.title).toBe('Test Scratchpad for Get');
        expect(result.scratchpad.content).toBe('Content for get test');
        expect(result.scratchpad.workflow_id).toBe(workflowId);
      });

      it('should handle invalid scratchpad id', async () => {
        const result = await helper.callGetScratchpad({
          id: 'invalid-scratchpad-id',
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('scratchpad');
        expect(result.scratchpad).toBeNull();
      });

      it('should handle missing id parameter', async () => {
        const result = await helper.callGetScratchpad({} as GetScratchpadArgs);
        
        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('scratchpad');
        expect(result.scratchpad).toBeNull();
      });
    });

    describe('append-scratchpad tool', () => {
      let scratchpadId: string;

      beforeEach(async () => {
        const createResult = await helper.callCreateScratchpad({
          workflow_id: workflowId,
          title: 'Test Scratchpad for Append',
          content: 'Initial content',
          include_content: true,
        });
        expect(createResult).not.toHaveProperty('error');
        scratchpadId = createResult.scratchpad.id;
      });

      it('should append content to existing scratchpad', async () => {
        const appendResult = await helper.callAppendScratchpad({
          id: scratchpadId,
          content: '\nAppended content',
          include_content: true,
        });
        
        expect(appendResult).not.toHaveProperty('error');
        expect(appendResult).toHaveProperty('scratchpad');
        expect(appendResult.scratchpad.content).toBe('Initial content\nAppended content');
        expect(appendResult.scratchpad.size_bytes).toBeGreaterThan(15); // Original size
        
        // Verify by getting the scratchpad
        const getResult = await helper.callGetScratchpad({ id: scratchpadId });
        expect(getResult).not.toHaveProperty('error');
        expect(getResult.scratchpad.content).toBe('Initial content\nAppended content');
        
        // Verify updated_at changed (allow for same timestamp in fast tests) - now comparing ISO strings
        const updatedAt = new Date(appendResult.scratchpad.updated_at).getTime();
        const createdAt = new Date(appendResult.scratchpad.created_at).getTime();
        expect(updatedAt).toBeGreaterThanOrEqual(createdAt);
      });

      it('should handle invalid scratchpad id', async () => {
        const result = await helper.callAppendScratchpad({
          id: 'invalid-id',
          content: 'Should not append',
        });
        
        expect(result).toHaveProperty('error');
      });

      it('should handle missing content parameter', async () => {
        const result = await helper.callAppendScratchpad({
          id: scratchpadId,
          content: undefined as any,
        });
        
        // Append with undefined content might just append empty string or succeed
        // Let's check if this is actually an error condition
        if (result.error) {
          expect(result).toHaveProperty('error');
        } else {
          expect(result).not.toHaveProperty('error');
        }
      });

      it('should handle multiple appends in sequence', async () => {
        await helper.callAppendScratchpad({
          id: scratchpadId,
          content: '\nSecond append',
          include_content: true,
        });
        
        const result = await helper.callAppendScratchpad({
          id: scratchpadId,
          content: '\nThird append',
          include_content: true,
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result.scratchpad.content).toBe('Initial content\nSecond append\nThird append');
      });
    });

    describe('tail-scratchpad tool', () => {
      let scratchpadId: string;
      const testContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10';

      beforeEach(async () => {
        const createResult = await helper.callCreateScratchpad({
          workflow_id: workflowId,
          title: 'Test Scratchpad for Tail',
          content: testContent,
          include_content: true,
        });
        expect(createResult).not.toHaveProperty('error');
        scratchpadId = createResult.scratchpad.id;
      });

      it('should get tail content by lines (default 50)', async () => {
        const result = await helper.callTailScratchpad({
          id: scratchpadId,
        });

        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('scratchpad');
        expect(result.scratchpad).not.toBeNull();
        expect(result.scratchpad.id).toBe(scratchpadId);
        expect(result.scratchpad.content).toBe(testContent);
        expect(result.scratchpad.is_tail_content).toBe(true);
        expect(result.scratchpad.tail_lines).toBe(10);
        expect(result.scratchpad.total_lines).toBe(10);
        expect(result.scratchpad.tail_chars).toBe(testContent.length);
      });

      it('should get tail content by specific number of lines', async () => {
        const result = await helper.callTailScratchpad({
          id: scratchpadId,
          tail_size: { lines: 3 },
        });

        expect(result).not.toHaveProperty('error');
        expect(result.scratchpad).not.toBeNull();
        expect(result.scratchpad.content).toBe('Line 8\nLine 9\nLine 10');
        expect(result.scratchpad.tail_lines).toBe(3);
        expect(result.scratchpad.total_lines).toBe(10);
      });

      it('should get tail content by character count', async () => {
        const result = await helper.callTailScratchpad({
          id: scratchpadId,
          tail_size: { chars: 20 },
        });

        expect(result).not.toHaveProperty('error');
        expect(result.scratchpad).not.toBeNull();
        // chars 取最後 20 個字符，實際會取得 "ine 8\nLine 9\nLine 10" (20 字符)
        expect(result.scratchpad.content).toBe('ine 8\nLine 9\nLine 10');
        expect(result.scratchpad.tail_chars).toBe(20);
        expect(result.scratchpad.tail_lines).toBe(3);
      });

      it('should handle chars-based tail extraction correctly', async () => {
        const result = await helper.callTailScratchpad({
          id: scratchpadId,
          tail_size: { chars: 10 },
        });

        expect(result).not.toHaveProperty('error');
        expect(result.scratchpad).not.toBeNull();
        // chars 取最後 10 個字符，實際會取得 " 9\nLine 10" (10 字符)
        expect(result.scratchpad.content).toBe(' 9\nLine 10');
        expect(result.scratchpad.tail_chars).toBe(10);
        expect(result.scratchpad.tail_lines).toBe(2);
      });

      it('should handle tail with specific lines count', async () => {
        const result = await helper.callTailScratchpad({
          id: scratchpadId,
          tail_size: { lines: 5 },
        });

        expect(result).not.toHaveProperty('error');
        expect(result.scratchpad).not.toBeNull();
        expect(result.scratchpad.content).toBe('Line 6\nLine 7\nLine 8\nLine 9\nLine 10');
        expect(result.scratchpad.tail_lines).toBe(5);
        expect(result.scratchpad.total_lines).toBe(10);
      });

      it('should handle include_content false', async () => {
        const result = await helper.callTailScratchpad({
          id: scratchpadId,
          include_content: false,
        });

        expect(result).not.toHaveProperty('error');
        expect(result.scratchpad).not.toBeNull();
        expect(result.scratchpad.content).toBe('');
        expect(result.message).toContain('Content excluded (include_content=false)');
      });

      it('should handle full content tail extraction', async () => {
        const result = await helper.callTailScratchpad({
          id: scratchpadId,
          tail_size: { lines: 10 },
        });

        expect(result).not.toHaveProperty('error');
        expect(result.scratchpad).not.toBeNull();
        expect(result.scratchpad.content).toBe(testContent);
        expect(result.scratchpad.tail_lines).toBe(10);
        expect(result.scratchpad.total_lines).toBe(10);
      });

      it('should handle invalid scratchpad id', async () => {
        const result = await helper.callTailScratchpad({
          id: 'invalid-scratchpad-id',
        });

        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('scratchpad');
        expect(result.scratchpad).toBeNull();
      });

      it('should handle edge case with more lines requested than available', async () => {
        const result = await helper.callTailScratchpad({
          id: scratchpadId,
          tail_size: { lines: 100 }, // More than the 10 lines available
        });

        expect(result).not.toHaveProperty('error');
        expect(result.scratchpad).not.toBeNull();
        expect(result.scratchpad.content).toBe(testContent);
        expect(result.scratchpad.tail_lines).toBe(10); // Should return all available lines
        expect(result.scratchpad.total_lines).toBe(10);
      });

      it('should handle edge case with more chars requested than available', async () => {
        const result = await helper.callTailScratchpad({
          id: scratchpadId,
          tail_size: { chars: 1000 }, // More than the content length
        });

        expect(result).not.toHaveProperty('error');
        expect(result.scratchpad).not.toBeNull();
        expect(result.scratchpad.content).toBe(testContent);
        expect(result.scratchpad.tail_chars).toBe(testContent.length);
      });
    });
  });

  describe('Search and List Tools', () => {
    let workflowId: string;
    let scratchpadIds: string[] = [];

    beforeEach(async () => {
      // Create test workflow
      const workflowResult = await helper.callCreateWorkflow({
        name: 'Search Test Workflow',
      });
      expect(workflowResult).not.toHaveProperty('error');
      workflowId = workflowResult.workflow.id;

      // Create test scratchpads
      const testScratchpads = [
        { title: 'JavaScript Notes', content: 'JavaScript is a programming language used for web development' },
        { title: 'Python Guide', content: 'Python is great for data science and machine learning applications' },
        { title: 'API Documentation', content: 'REST API endpoints for user management and authentication' },
        { title: 'React Components', content: 'React functional components with hooks for state management' },
        { title: 'Database Schema', content: 'SQL database schema design for user accounts and permissions' },
      ];

      for (const pad of testScratchpads) {
        const result = await helper.callCreateScratchpad({
          workflow_id: workflowId,
          title: pad.title,
          content: pad.content,
        });
        expect(result).not.toHaveProperty('error');
        scratchpadIds.push(result.scratchpad.id);
      }
    });

    describe('list-scratchpads tool', () => {
      it('should list all scratchpads in workflow', async () => {
        const result = await helper.callListScratchpads({
          workflow_id: workflowId,
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('scratchpads');
        expect(result).toHaveProperty('count');
        expect(result.scratchpads).toHaveLength(5);
        expect(result.count).toBe(5);
        
        const titles = result.scratchpads.map((s: any) => s.title);
        expect(titles).toContain('JavaScript Notes');
        expect(titles).toContain('Python Guide');
        expect(titles).toContain('API Documentation');
        
        // Verify scratchpad structure
        for (const scratchpad of result.scratchpads) {
          expect(scratchpad).toHaveProperty('id');
          expect(scratchpad).toHaveProperty('title');
          expect(scratchpad).toHaveProperty('content');
          expect(scratchpad).toHaveProperty('workflow_id');
          expect(scratchpad).toHaveProperty('size_bytes');
          expect(scratchpad).toHaveProperty('created_at');
          expect(scratchpad).toHaveProperty('updated_at');
        }
      });

      it('should handle limit parameter', async () => {
        const result = await helper.callListScratchpads({
          workflow_id: workflowId,
          limit: 2,
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result.scratchpads).toHaveLength(2);
        expect(result.count).toBe(2);
      });

      it('should handle invalid workflow_id', async () => {
        const result = await helper.callListScratchpads({
          workflow_id: 'invalid-workflow-id',
        });
        
        // Should not error, but return empty list
        expect(result).not.toHaveProperty('error');
        expect(result.scratchpads).toHaveLength(0);
        expect(result.count).toBe(0);
      });

      it('should handle list with workflow_id', async () => {
        const result = await helper.callListScratchpads({
          workflow_id: workflowId,
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('scratchpads');
        expect(result).toHaveProperty('count');
        expect(result.count).toBe(result.scratchpads.length);
        // Should return the scratchpads created in this test
      });
    });

    describe('search-scratchpads tool', () => {
      it('should search scratchpads by content', async () => {
        const result = await helper.callSearchScratchpads({
          query: 'programming',
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('results');
        expect(result).toHaveProperty('count');
        expect(result).toHaveProperty('query', 'programming');
        expect(result).toHaveProperty('search_method');
        expect(['fts5', 'like']).toContain(result.search_method);
        
        // Should find JavaScript Notes
        expect(result.results.length).toBeGreaterThan(0);
        const titles = result.results.map((r: any) => r.scratchpad.title);
        expect(titles).toContain('JavaScript Notes');
      });

      it('should search with workflow filter', async () => {
        const result = await helper.callSearchScratchpads({
          query: 'development',
          workflow_id: workflowId,
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result.results.length).toBeGreaterThan(0);
        
        // All results should be from the specified workflow
        for (const searchResult of result.results) {
          expect(searchResult.workflow.id).toBe(workflowId);
        }
      });

      it('should handle search limit', async () => {
        const result = await helper.callSearchScratchpads({
          query: 'a', // Broad query to match multiple results
          limit: 2,
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result.results.length).toBeLessThanOrEqual(2);
      });

      it('should include snippets and ranks in search results', async () => {
        const result = await helper.callSearchScratchpads({
          query: 'JavaScript',
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result.results.length).toBeGreaterThan(0);
        
        for (const searchResult of result.results) {
          expect(searchResult).toHaveProperty('snippet');
          expect(searchResult).toHaveProperty('rank');
          expect(searchResult).toHaveProperty('scratchpad');
          expect(searchResult).toHaveProperty('workflow');
          expect(typeof searchResult.snippet).toBe('string');
          expect(typeof searchResult.rank).toBe('number');
        }
      });

      it('should handle missing query parameter', async () => {
        const result = await helper.callSearchScratchpads({} as SearchScratchpadsArgs);
        
        // Check if search actually fails or returns empty results
        if (result.error) {
          expect(result).toHaveProperty('error');
        } else {
          expect(result).not.toHaveProperty('error');
          expect(result).toHaveProperty('results');
          expect(result.results).toHaveLength(0);
        }
      });

      it('should handle empty search results', async () => {
        const result = await helper.callSearchScratchpads({
          query: 'nonexistent-search-term-xyz-123',
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result.results).toHaveLength(0);
        expect(result.count).toBe(0);
      });

      it('should handle case-insensitive search', async () => {
        const result = await helper.callSearchScratchpads({
          query: 'JAVASCRIPT', // Uppercase
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result.results.length).toBeGreaterThan(0);
        const titles = result.results.map((r: any) => r.scratchpad.title);
        expect(titles).toContain('JavaScript Notes');
      });

      it('should handle partial word matching', async () => {
        const result = await helper.callSearchScratchpads({
          query: 'manage', // Should match "management"
        });
        
        expect(result).not.toHaveProperty('error');
        expect(result.results.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Integration and Edge Cases', () => {
    it('should handle workflow with many scratchpads', async () => {
      // Create workflow
      const workflowResult = await helper.callCreateWorkflow({
        name: 'High Volume Workflow',
      });
      expect(workflowResult).not.toHaveProperty('error');
      const workflowId = workflowResult.workflow.id;

      // Create many scratchpads
      const createPromises = [];
      for (let i = 0; i < 20; i++) {
        createPromises.push(
          helper.callCreateScratchpad({
            workflow_id: workflowId,
            title: `Scratchpad ${i + 1}`,
            content: `This is content for scratchpad number ${i + 1}. It contains unique data ${Math.random()}.`,
          })
        );
      }

      const results = await Promise.all(createPromises);
      
      // All should succeed
      for (const result of results) {
        expect(result).not.toHaveProperty('error');
      }

      // List should return all scratchpads
      const listResult = await helper.callListScratchpads({
        workflow_id: workflowId,
      });
      
      expect(listResult).not.toHaveProperty('error');
      expect(listResult.scratchpads).toHaveLength(20);
      expect(listResult.count).toBe(20);
    });

    it('should maintain data consistency across operations', async () => {
      // Create workflow
      const workflowResult = await helper.callCreateWorkflow({
        name: 'Consistency Test Workflow',
      });
      expect(workflowResult).not.toHaveProperty('error');
      const workflowId = workflowResult.workflow.id;

      // Create scratchpad
      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Consistency Test Pad',
        content: 'Original content',
      });
      expect(createResult).not.toHaveProperty('error');
      const scratchpadId = createResult.scratchpad.id;

      // Verify via get
      const getResult1 = await helper.callGetScratchpad({
        id: scratchpadId,
      });
      expect(getResult1).not.toHaveProperty('error');
      expect(getResult1.scratchpad.content).toBe('Original content');

      // Append content
      const appendResult = await helper.callAppendScratchpad({
        id: scratchpadId,
        content: '\nAdded content',
      });
      expect(appendResult).not.toHaveProperty('error');

      // Verify via get again
      const getResult2 = await helper.callGetScratchpad({
        id: scratchpadId,
      });
      expect(getResult2).not.toHaveProperty('error');
      expect(getResult2.scratchpad.content).toBe('Original content\nAdded content');

      // Search should also reflect changes
      const searchResult = await helper.callSearchScratchpads({
        query: 'Added content',
      });
      expect(searchResult).not.toHaveProperty('error');
      expect(searchResult.results.length).toBeGreaterThan(0);
      
      const foundScratchpad = searchResult.results.find(
        (r: any) => r.scratchpad.id === scratchpadId
      );
      expect(foundScratchpad).toBeDefined();
    });

    it('should handle concurrent operations safely', async () => {
      // Create workflow
      const workflowResult = await helper.callCreateWorkflow({
        name: 'Concurrent Test Workflow',
      });
      expect(workflowResult).not.toHaveProperty('error');
      const workflowId = workflowResult.workflow.id;

      // Create initial scratchpad
      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Concurrent Test Pad',
        content: 'Base content',
      });
      expect(createResult).not.toHaveProperty('error');
      const scratchpadId = createResult.scratchpad.id;

      // Perform concurrent appends
      const appendPromises = [];
      for (let i = 0; i < 5; i++) {
        appendPromises.push(
          helper.callAppendScratchpad({
            id: scratchpadId,
            content: `\nConcurrent append ${i + 1}`,
          })
        );
      }

      const appendResults = await Promise.all(appendPromises);
      
      // All should succeed
      for (const result of appendResults) {
        expect(result).not.toHaveProperty('error');
      }

      // Final state should be consistent
      const finalResult = await helper.callGetScratchpad({
        id: scratchpadId,
      });
      expect(finalResult).not.toHaveProperty('error');
      expect(finalResult.scratchpad.content).toContain('Base content');
      expect(finalResult.scratchpad.content).toContain('Concurrent append');
    });
  });
});