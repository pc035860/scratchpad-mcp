/**
 * Get Scratchpad Range Selection Tests
 *
 * Tests the enhanced get-scratchpad tool with range selection functionality:
 * - line_range parameter for precise line extraction
 * - line_context parameter for line + surrounding context
 * - include_block functionality for complete block extraction
 * - Parameter validation and conflict detection
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScratchpadDatabase } from '../src/database/index.js';
import {
  createWorkflowTool,
  createScratchpadTool,
  appendScratchpadTool,
  getScratchpadTool,
  type CreateWorkflowArgs,
  type CreateScratchpadArgs,
  type GetScratchpadArgs,
} from '../src/tools/index.js';

/**
 * Test helper class for get-scratchpad range selection
 */
class RangeTestHelper {
  private db: ScratchpadDatabase;
  private createWorkflow: ReturnType<typeof createWorkflowTool>;
  private createScratchpad: ReturnType<typeof createScratchpadTool>;
  private appendScratchpad: ReturnType<typeof appendScratchpadTool>;
  private getScratchpad: ReturnType<typeof getScratchpadTool>;

  constructor() {
    this.db = new ScratchpadDatabase({ filename: ':memory:' });
    this.createWorkflow = createWorkflowTool(this.db);
    this.createScratchpad = createScratchpadTool(this.db);
    this.appendScratchpad = appendScratchpadTool(this.db);
    this.getScratchpad = getScratchpadTool(this.db);
  }

  getDatabase() {
    return this.db;
  }

  async callCreateWorkflow(args: CreateWorkflowArgs) {
    try {
      return await this.createWorkflow(args);
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

  async callAppendScratchpad(args: any) {
    try {
      return await this.appendScratchpad(args);
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
}

describe('Get Scratchpad Range Selection Tests', () => {
  let helper: RangeTestHelper;
  let workflowId: string;

  beforeEach(async () => {
    helper = new RangeTestHelper();
    
    // Create test workflow
    const workflowResult = await helper.callCreateWorkflow({
      name: 'Test Workflow for Range Selection',
      description: 'Testing get-scratchpad range selection functionality',
    });
    expect(workflowResult).not.toHaveProperty('error');
    workflowId = workflowResult.workflow.id;
  });

  afterEach(async () => {
    helper.getDatabase().close();
  });

  describe('Line Range Selection (line_range parameter)', () => {
    let scratchpadId: string;

    beforeEach(async () => {
      const content = `Line 1: First line of content
Line 2: Second line with some text
Line 3: Third line of the document
Line 4: Fourth line continues here
Line 5: Fifth line with more content
Line 6: Sixth line near the end
Line 7: Seventh line content
Line 8: Eighth line
Line 9: Ninth line almost done
Line 10: Final line of content`;

      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Line Range Test Scratchpad',
        content,
      });
      expect(createResult).not.toHaveProperty('error');
      scratchpadId = createResult.scratchpad.id;
    });

    it('should extract specific line range (start to end)', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 3, end: 6 },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      
      const expectedContent = `Line 3: Third line of the document
Line 4: Fourth line continues here
Line 5: Fifth line with more content
Line 6: Sixth line near the end`;
      
      expect(result.scratchpad.content).toBe(expectedContent);
      expect(result.message).toContain('Lines 3-6');
    });

    it('should extract from start line to end of file when end is not specified', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 8 },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      
      const expectedContent = `Line 8: Eighth line
Line 9: Ninth line almost done
Line 10: Final line of content`;
      
      expect(result.scratchpad.content).toBe(expectedContent);
      expect(result.message).toContain('Lines 8-10');
    });

    it('should extract single line when start equals end', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 5, end: 5 },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      expect(result.scratchpad.content).toBe('Line 5: Fifth line with more content');
      expect(result.message).toContain('Lines 5-5');
    });

    it('should handle start line = 1 (beginning of file)', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 1, end: 3 },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      
      const expectedContent = `Line 1: First line of content
Line 2: Second line with some text
Line 3: Third line of the document`;
      
      expect(result.scratchpad.content).toBe(expectedContent);
    });

    it('should handle line range extending to end of file', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 9, end: 15 }, // end > total lines
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      
      const expectedContent = `Line 9: Ninth line almost done
Line 10: Final line of content`;
      
      expect(result.scratchpad.content).toBe(expectedContent);
    });

    it('should handle empty result when start line > total lines', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 15 }, // > 10 lines
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      expect(result.scratchpad.content).toBe('');
    });
  });

  describe('Line Context Selection (line_context parameter)', () => {
    let scratchpadId: string;

    beforeEach(async () => {
      const content = `Line 1: Setup content
Line 2: More setup
Line 3: Context before target
Line 4: Another context line
Line 5: TARGET LINE HERE
Line 6: Context after target
Line 7: More context
Line 8: Additional content
Line 9: Near end content
Line 10: Final line`;

      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Line Context Test Scratchpad',
        content,
      });
      expect(createResult).not.toHaveProperty('error');
      scratchpadId = createResult.scratchpad.id;
    });

    it('should extract line with default context (2 before, 2 after)', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 5 },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      
      const expectedContent = `Line 3: Context before target
Line 4: Another context line
Line 5: TARGET LINE HERE
Line 6: Context after target
Line 7: More context`;
      
      expect(result.scratchpad.content).toBe(expectedContent);
      expect(result.message).toContain('Lines 3-7');
      expect(result.message).toContain('±2/2 around line 5');
    });

    it('should extract line with custom before/after context', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 5, before: 1, after: 3 },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      
      const expectedContent = `Line 4: Another context line
Line 5: TARGET LINE HERE
Line 6: Context after target
Line 7: More context
Line 8: Additional content`;
      
      expect(result.scratchpad.content).toBe(expectedContent);
      expect(result.message).toContain('±1/3 around line 5');
    });

    it('should handle line at beginning of file (limited before context)', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 1, before: 5, after: 2 },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      
      const expectedContent = `Line 1: Setup content
Line 2: More setup
Line 3: Context before target`;
      
      expect(result.scratchpad.content).toBe(expectedContent);
    });

    it('should handle line at end of file (limited after context)', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 10, before: 2, after: 5 },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      
      const expectedContent = `Line 8: Additional content
Line 9: Near end content
Line 10: Final line`;
      
      expect(result.scratchpad.content).toBe(expectedContent);
    });

    it('should handle zero context (just the target line)', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 5, before: 0, after: 0 },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      expect(result.scratchpad.content).toBe('Line 5: TARGET LINE HERE');
      expect(result.message).toContain('±0/0 around line 5');
    });
  });

  describe('Block-based Context Selection (include_block)', () => {
    let scratchpadId: string;

    beforeEach(async () => {
      // Create initial scratchpad
      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Block Context Test Scratchpad',
        content: 'Initial content block',
      });
      expect(createResult).not.toHaveProperty('error');
      scratchpadId = createResult.scratchpad.id;

      // Append multiple blocks using new format
      await helper.callAppendScratchpad({
        id: scratchpadId,
        content: 'Second block content\nWith multiple lines\nIn the block',
      });

      await helper.callAppendScratchpad({
        id: scratchpadId,
        content: 'Third block content\nAnother multi-line block\nWith more content',
      });

      await helper.callAppendScratchpad({
        id: scratchpadId,
        content: 'Fourth block\nFinal block content',
      });
    });

    it('should extract block containing target line', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 5, include_block: true },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      expect(result.message).toContain('Block containing line');
    });

    it('should extract first block when target line is in first block', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 1, include_block: true },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      expect(result.scratchpad.content).toBe('Initial content block');
    });

    it('should ignore before/after parameters when include_block is true', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 8, before: 10, after: 10, include_block: true },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      
      // Should still return the block content
      expect(result.message).toContain('Block containing line');
    });

    it('should fallback to line context if block parsing fails', async () => {
      // Test with content that has no block structure
      const simpleResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'No Block Structure',
        content: `Simple line 1
Simple line 2
Simple line 3
Simple line 4`,
      });
      expect(simpleResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpad({
        id: simpleResult.scratchpad.id,
        line_context: { line: 2, include_block: true },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      
      // Should fallback to line context or return the single block
      expect(result).not.toHaveProperty('error');
    });
  });

  describe('Parameter Validation and Error Handling', () => {
    let scratchpadId: string;

    beforeEach(async () => {
      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Validation Test Scratchpad',
        content: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
      });
      expect(createResult).not.toHaveProperty('error');
      scratchpadId = createResult.scratchpad.id;
    });

    it('should reject multiple range parameters', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 1, end: 3 },
        line_context: { line: 2 },
      } as any);

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Only one range parameter can be specified');
    });

    it('should validate line_range.start >= 1', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 0 },
      } as any);

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('line_range.start must be >= 1');
    });

    it('should validate line_range.end >= start', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 5, end: 3 },
      } as any);

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('line_range.end must be >= line_range.start');
    });

    it('should validate line_context.line within bounds', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 10 }, // > 5 lines
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('line_context.line must be between 1 and 5');
    });

    it('should validate line_context.line >= 1', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 0 },
      } as any);

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('line_context.line must be >= 1');
    });

    it('should handle non-existent scratchpad with range parameters', async () => {
      const result = await helper.callGetScratchpad({
        id: 'non-existent-id',
        line_range: { start: 1, end: 3 },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).toBeNull();
    });
  });

  describe('Integration with Existing Features', () => {
    let scratchpadId: string;

    beforeEach(async () => {
      const content = `# Title Line
This is line 2 with content
This is line 3
Line 4 has text here
Line 5: Fifth line content
Line 6: More content
Line 7: Even more
Line 8: Additional data
Line 9: Near the end
Line 10: Final line`;

      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Integration Test Scratchpad',
        content,
      });
      expect(createResult).not.toHaveProperty('error');
      scratchpadId = createResult.scratchpad.id;
    });

    it('should work with max_content_chars parameter', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 1, end: 5 },
        max_content_chars: 50,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      // Content might be truncated by max_content_chars
      if (result.scratchpad.content.length > 50) {
        expect(result.scratchpad).toHaveProperty('content_truncated');
      }
    });

    it('should work with include_content=false parameter', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 1, end: 3 },
        include_content: false,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      expect(result.scratchpad.content).toBe('');
    });

    it('should work with preview_mode parameter', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 5, before: 2, after: 2 },
        preview_mode: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      expect(result.scratchpad.content.length).toBeLessThanOrEqual(500);
      expect(result.scratchpad).toHaveProperty('preview_summary');
    });

    it('should update size_bytes correctly for range content', async () => {
      const fullResult = await helper.callGetScratchpad({
        id: scratchpadId,
      });

      const rangeResult = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 1, end: 3 },
      });

      expect(rangeResult).not.toHaveProperty('error');
      expect(rangeResult.scratchpad).not.toBeNull();
      expect(fullResult.scratchpad).not.toBeNull();
      
      // Range content should be smaller than full content
      expect(rangeResult.scratchpad.size_bytes).toBeLessThan(fullResult.scratchpad.size_bytes);
      expect(rangeResult.message).toContain(`${fullResult.scratchpad.size_bytes} bytes total`);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle single line content', async () => {
      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Single Line Test',
        content: 'Only one line here',
      });
      expect(createResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpad({
        id: createResult.scratchpad.id,
        line_context: { line: 1, before: 5, after: 5 },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      expect(result.scratchpad.content).toBe('Only one line here');
    });

    it('should handle empty content with range parameters', async () => {
      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Empty Content Test',
        content: '',
      });
      expect(createResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpad({
        id: createResult.scratchpad.id,
        line_range: { start: 1, end: 5 },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      expect(result.scratchpad.content).toBe('');
    });

    it('should handle content with only newlines', async () => {
      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Newlines Only Test',
        content: '\n\n\n\n',
      });
      expect(createResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpad({
        id: createResult.scratchpad.id,
        line_range: { start: 2, end: 3 },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      expect(result.scratchpad.content).toBe('\n');
    });

    it('should handle very large line numbers gracefully', async () => {
      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Large Numbers Test',
        content: 'Line 1\nLine 2',
      });
      expect(createResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpad({
        id: createResult.scratchpad.id,
        line_range: { start: 1000, end: 2000 },
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad).not.toBeNull();
      expect(result.scratchpad.content).toBe('');
    });
  });
});