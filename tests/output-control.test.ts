/**
 * Output Control Features Tests
 * 
 * Tests the new output control functionality including pagination,
 * content truncation, preview mode, and include_content options.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScratchpadDatabase } from '../src/database/index.js';
import {
  createWorkflowTool,
  listWorkflowsTool,
  createScratchpadTool,
  getScratchpadTool,
  listScratchpadsTool,
  searchScratchpadsTool,
  type ListWorkflowsArgs,
  type GetScratchpadArgs,
  type ListScratchpadsArgs,
  type SearchScratchpadsArgs,
} from '../src/tools/index.js';

/**
 * Test helper class for Output Control tests
 */
class OutputControlTestHelper {
  private db: ScratchpadDatabase;
  
  // Tool handlers
  private createWorkflow: ReturnType<typeof createWorkflowTool>;
  private listWorkflows: ReturnType<typeof listWorkflowsTool>;
  private createScratchpad: ReturnType<typeof createScratchpadTool>;
  private getScratchpad: ReturnType<typeof getScratchpadTool>;
  private listScratchpads: ReturnType<typeof listScratchpadsTool>;
  private searchScratchpads: ReturnType<typeof searchScratchpadsTool>;
  
  constructor() {
    this.db = new ScratchpadDatabase({ filename: ':memory:' });
    
    // Initialize all tool handlers
    this.createWorkflow = createWorkflowTool(this.db);
    this.listWorkflows = listWorkflowsTool(this.db);
    this.createScratchpad = createScratchpadTool(this.db);
    this.getScratchpad = getScratchpadTool(this.db);
    this.listScratchpads = listScratchpadsTool(this.db);
    this.searchScratchpads = searchScratchpadsTool(this.db);
  }

  async setupTestData() {
    console.log('🚀 Setting up output control test data...');
    
    // Create multiple workflows with descriptions
    const workflows = [];
    for (let i = 1; i <= 5; i++) {
      const result = await this.createWorkflow({
        name: `test-workflow-${i}`,
        description: `This is a longer description for workflow ${i}. `.repeat(10) + 'End of description.',
      });
      workflows.push(result.workflow);
    }
    
    // Create scratchpads with various content sizes
    const scratchpads = [];
    for (const workflow of workflows) {
      for (let j = 1; j <= 3; j++) {
        const contentSize = j === 1 ? 'small' : j === 2 ? 'medium' : 'large';
        let content = '';
        
        switch (contentSize) {
          case 'small':
            content = `Small content for scratchpad ${j} in ${workflow.name}. Just a brief note.`;
            break;
          case 'medium':
            content = `Medium content for scratchpad ${j} in ${workflow.name}. `.repeat(15) + 'This is medium-sized content.';
            break;
          case 'large':
            content = `Large content for scratchpad ${j} in ${workflow.name}. `.repeat(50) + 'This is very large content with lots of repeated text.';
            break;
        }
        
        const result = await this.createScratchpad({
          workflow_id: workflow.id,
          title: `${contentSize}-scratchpad-${j}`,
          content,
        });
        scratchpads.push(result.scratchpad);
      }
    }
    
    console.log(`✅ Created ${workflows.length} workflows and ${scratchpads.length} scratchpads`);
    return { workflows, scratchpads };
  }

  cleanup() {
    this.db.close();
  }

  // Expose tool methods for testing
  async testListWorkflows(args: ListWorkflowsArgs) {
    return this.listWorkflows(args);
  }

  async testGetScratchpad(args: GetScratchpadArgs) {
    return this.getScratchpad(args);
  }

  async testListScratchpads(args: ListScratchpadsArgs) {
    return this.listScratchpads(args);
  }

  async testSearchScratchpads(args: SearchScratchpadsArgs) {
    return this.searchScratchpads(args);
  }
}

describe('Output Control Features', () => {
  let helper: OutputControlTestHelper;
  let testData: { workflows: any[], scratchpads: any[] };

  beforeEach(async () => {
    helper = new OutputControlTestHelper();
    testData = await helper.setupTestData();
  });

  afterEach(() => {
    helper.cleanup();
  });

  describe('Workflow Output Control', () => {
    it('should apply pagination to workflow listing', async () => {
      // Test limit parameter
      const limitedResult = await helper.testListWorkflows({ limit: 2 });
      expect(limitedResult.workflows).toHaveLength(2);
      expect(limitedResult.count).toBe(2);

      // Test offset parameter
      const offsetResult = await helper.testListWorkflows({ limit: 2, offset: 2 });
      expect(offsetResult.workflows).toHaveLength(2);
      expect(offsetResult.workflows[0].name).not.toBe(limitedResult.workflows[0].name);
    });

    it('should apply preview mode to workflows', async () => {
      const previewResult = await helper.testListWorkflows({ 
        preview_mode: true,
        max_content_chars: 50
      });

      for (const workflow of previewResult.workflows) {
        if (workflow.description) {
          expect(workflow.description.length).toBeLessThanOrEqual(60); // 50 + truncation indicator
        }
      }
    });

    it('should exclude content when include_content is false', async () => {
      const noContentResult = await helper.testListWorkflows({ 
        include_content: false 
      });

      for (const workflow of noContentResult.workflows) {
        expect(workflow.description).toBeNull();
      }
    });

    it('should respect max_content_chars for workflow descriptions', async () => {
      const truncatedResult = await helper.testListWorkflows({ 
        max_content_chars: 100 
      });

      for (const workflow of truncatedResult.workflows) {
        if (workflow.description) {
          expect(workflow.description.length).toBeLessThanOrEqual(110); // 100 + truncation indicator
        }
      }
    });
  });

  describe('Scratchpad Output Control', () => {
    it('should apply pagination to scratchpad listing', async () => {
      const firstWorkflow = testData.workflows[0];
      
      // Test limit
      const limitedResult = await helper.testListScratchpads({ 
        workflow_id: firstWorkflow.id,
        limit: 2 
      });
      expect(limitedResult.scratchpads).toHaveLength(2);
      expect(limitedResult.has_more).toBe(true);

      // Test offset
      const offsetResult = await helper.testListScratchpads({ 
        workflow_id: firstWorkflow.id,
        limit: 2,
        offset: 1 
      });
      expect(offsetResult.scratchpads).toHaveLength(2);
      expect(offsetResult.scratchpads[0].id).not.toBe(limitedResult.scratchpads[0].id);
    });

    it('should apply preview mode to scratchpads', async () => {
      const firstWorkflow = testData.workflows[0];
      
      const previewResult = await helper.testListScratchpads({ 
        workflow_id: firstWorkflow.id,
        preview_mode: true,
        max_content_chars: 100
      });

      for (const scratchpad of previewResult.scratchpads) {
        expect(scratchpad.content.length).toBeLessThanOrEqual(110); // 100 + truncation
        expect(scratchpad.preview_summary).toBeDefined();
      }
    });

    it('should handle max_content_chars parameter', async () => {
      const firstWorkflow = testData.workflows[0];
      
      const truncatedResult = await helper.testListScratchpads({ 
        workflow_id: firstWorkflow.id,
        max_content_chars: 200
      });

      const largeScratchpad = truncatedResult.scratchpads.find(s => s.title.includes('large'));
      if (largeScratchpad) {
        expect(largeScratchpad.content.length).toBeLessThanOrEqual(210); // 200 + truncation
        expect(largeScratchpad.content_truncated).toBe(true);
        expect(largeScratchpad.original_size).toBeGreaterThan(200);
      }
    });

    it('should exclude content when include_content is false', async () => {
      const firstWorkflow = testData.workflows[0];
      
      const noContentResult = await helper.testListScratchpads({ 
        workflow_id: firstWorkflow.id,
        include_content: false
      });

      for (const scratchpad of noContentResult.scratchpads) {
        expect(scratchpad.content).toBe('');
      }
    });
  });

  describe('Single Scratchpad Retrieval Output Control', () => {
    it('should apply content control to single scratchpad', async () => {
      const largeScratchpad = testData.scratchpads.find(s => s.title.includes('large'));
      
      const truncatedResult = await helper.testGetScratchpad({
        id: largeScratchpad.id,
        max_content_chars: 300
      });

      if (truncatedResult.scratchpad) {
        expect(truncatedResult.scratchpad.content.length).toBeLessThanOrEqual(310);
        if (largeScratchpad.content.length > 300) {
          expect(truncatedResult.scratchpad.content_truncated).toBe(true);
        }
      }
    });

    it('should support preview mode for single scratchpad', async () => {
      const largeScratchpad = testData.scratchpads.find(s => s.title.includes('large'));
      
      const previewResult = await helper.testGetScratchpad({
        id: largeScratchpad.id,
        preview_mode: true,
        max_content_chars: 150
      });

      if (previewResult.scratchpad) {
        expect(previewResult.scratchpad.content.length).toBeLessThanOrEqual(160);
        expect(previewResult.scratchpad.preview_summary).toBeDefined();
      }
    });

    it('should handle include_content false for single scratchpad', async () => {
      const anyScratchpad = testData.scratchpads[0];
      
      const noContentResult = await helper.testGetScratchpad({
        id: anyScratchpad.id,
        include_content: false
      });

      if (noContentResult.scratchpad) {
        expect(noContentResult.scratchpad.content).toBe('');
      }
    });
  });

  describe('Search Output Control', () => {
    it('should apply conservative limits to search results', async () => {
      const searchResult = await helper.testSearchScratchpads({
        query: 'content'
      });

      // Should use conservative default limit (10)
      expect(searchResult.results.length).toBeLessThanOrEqual(10);
    });

    it('should apply content control to search results', async () => {
      const searchResult = await helper.testSearchScratchpads({
        query: 'content',
        max_content_chars: 100
      });

      for (const result of searchResult.results) {
        expect(result.scratchpad.content.length).toBeLessThanOrEqual(110);
        if (result.scratchpad.content_truncated) {
          expect(result.scratchpad.original_size).toBeGreaterThan(100);
        }
      }
    });

    it('should support preview mode in search results', async () => {
      const searchResult = await helper.testSearchScratchpads({
        query: 'content',
        preview_mode: true,
        max_content_chars: 80
      });

      for (const result of searchResult.results) {
        expect(result.scratchpad.content.length).toBeLessThanOrEqual(90);
        expect(result.scratchpad.preview_summary).toBeDefined();
      }
    });

    it('should exclude content from search results when requested', async () => {
      const searchResult = await helper.testSearchScratchpads({
        query: 'content',
        include_content: false
      });

      for (const result of searchResult.results) {
        expect(result.scratchpad.content).toBe('');
        // Snippet should still be present for search context
        expect(result.snippet).toBeDefined();
      }
    });
  });

  describe('Performance and Context Optimization', () => {
    it('should demonstrate significant context savings with output control', async () => {
      const firstWorkflow = testData.workflows[0];
      
      // Get full content size
      const fullResult = await helper.testListScratchpads({
        workflow_id: firstWorkflow.id
      });
      
      const fullSize = JSON.stringify(fullResult).length;
      
      // Get preview mode size
      const previewResult = await helper.testListScratchpads({
        workflow_id: firstWorkflow.id,
        preview_mode: true,
        max_content_chars: 200
      });
      
      const previewSize = JSON.stringify(previewResult).length;
      
      // Should have significant size reduction
      const reduction = (fullSize - previewSize) / fullSize;
      console.log(`📊 Context reduction: ${(reduction * 100).toFixed(1)}% (${fullSize} → ${previewSize} bytes)`);
      
      expect(reduction).toBeGreaterThan(0.25); // At least 25% reduction (adjusted for new control fields)
    });

    it('should handle boundary cases correctly', async () => {
      const firstWorkflow = testData.workflows[0];
      
      // Test with content shorter than max_content_chars
      const shortResult = await helper.testListScratchpads({
        workflow_id: firstWorkflow.id,
        max_content_chars: 10000 // Very large limit
      });
      
      for (const scratchpad of shortResult.scratchpads) {
        expect(scratchpad.content_truncated).toBeUndefined(); // Should not be truncated
      }
      
      // Test with very small limit
      const tinyResult = await helper.testListScratchpads({
        workflow_id: firstWorkflow.id,
        max_content_chars: 10
      });
      
      for (const scratchpad of tinyResult.scratchpads) {
        expect(scratchpad.content.length).toBeLessThanOrEqual(20); // 10 + truncation
      }
    });

    it('should maintain data consistency with output control', async () => {
      const anyScratchpad = testData.scratchpads[0];
      
      // Get full content
      const fullResult = await helper.testGetScratchpad({
        id: anyScratchpad.id
      });
      
      // Get truncated content
      const truncatedResult = await helper.testGetScratchpad({
        id: anyScratchpad.id,
        max_content_chars: 100
      });
      
      // Verify metadata consistency
      expect(fullResult.scratchpad?.id).toBe(truncatedResult.scratchpad?.id);
      expect(fullResult.scratchpad?.title).toBe(truncatedResult.scratchpad?.title);
      expect(fullResult.scratchpad?.created_at).toBe(truncatedResult.scratchpad?.created_at);
      expect(fullResult.scratchpad?.size_bytes).toBe(truncatedResult.scratchpad?.size_bytes);
    });
  });
});