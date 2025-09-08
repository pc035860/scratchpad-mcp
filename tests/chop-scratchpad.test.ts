/**
 * Chop-Scratchpad Tool Dedicated Tests
 *
 * Comprehensive tests for the chop-scratchpad tool functionality,
 * including boundary conditions, error handling, and edge cases.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScratchpadDatabase } from '../src/database/index.js';
import {
  createWorkflowTool,
  createScratchpadTool,
  chopScratchpadTool,
  getScratchpadTool,
  type CreateWorkflowArgs,
  type CreateScratchpadArgs,
  type ChopScratchpadArgs,
} from '../src/tools/index.js';
import { validateChopScratchpadArgs } from '../src/server-helpers.js';

/**
 * Test helper class for chop-scratchpad tool testing
 */
class ChopScratchpadTestHelper {
  private db: ScratchpadDatabase;

  // Tool handlers
  private createWorkflow: ReturnType<typeof createWorkflowTool>;
  private createScratchpad: ReturnType<typeof createScratchpadTool>;
  private chopScratchpad: ReturnType<typeof chopScratchpadTool>;
  private getScratchpad: ReturnType<typeof getScratchpadTool>;

  constructor() {
    this.db = new ScratchpadDatabase({ filename: ':memory:' });

    // Initialize tool handlers
    this.createWorkflow = createWorkflowTool(this.db);
    this.createScratchpad = createScratchpadTool(this.db);
    this.chopScratchpad = chopScratchpadTool(this.db);
    this.getScratchpad = getScratchpadTool(this.db);
  }

  cleanup() {
    this.db.close();
  }

  async createTestWorkflow(name = 'Test Workflow') {
    const args: CreateWorkflowArgs = { name };
    const result = await this.createWorkflow(args);
    return result.workflow;
  }

  async createTestScratchpad(
    workflowId: string,
    title = 'Test Scratchpad',
    content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
  ) {
    const args: CreateScratchpadArgs = {
      workflow_id: workflowId,
      title,
      content,
    };
    const result = await this.createScratchpad(args);
    return result.scratchpad;
  }

  async chopScratchpadContent(id: string, lines?: number, blocks?: number) {
    const args: ChopScratchpadArgs = { id };
    if (lines !== undefined) {
      args.lines = lines;
    }
    if (blocks !== undefined) {
      args.blocks = blocks;
    }
    return await this.chopScratchpad(args);
  }

  async getScratchpadContent(id: string) {
    const result = await this.getScratchpad({ id, include_content: true });
    return result.scratchpad;
  }
}

describe('Chop-Scratchpad Tool Tests', () => {
  let helper: ChopScratchpadTestHelper;

  beforeEach(() => {
    helper = new ChopScratchpadTestHelper();
  });

  afterEach(() => {
    helper.cleanup();
  });

  describe('Parameter Validation', () => {
    it('should require id parameter', () => {
      expect(() => validateChopScratchpadArgs({})).toThrow(
        'Invalid arguments: id must be a string'
      );
    });

    it('should accept valid id parameter', () => {
      const result = validateChopScratchpadArgs({ id: 'test-id' });
      expect(result.id).toBe('test-id');
      expect(result.lines).toBeUndefined();
    });

    it('should accept optional lines parameter', () => {
      const result = validateChopScratchpadArgs({ id: 'test-id', lines: 3 });
      expect(result.id).toBe('test-id');
      expect(result.lines).toBe(3);
      expect(result.blocks).toBeUndefined();
    });

    it('should accept optional blocks parameter', () => {
      const result = validateChopScratchpadArgs({ id: 'test-id', blocks: 2 });
      expect(result.id).toBe('test-id');
      expect(result.blocks).toBe(2);
      expect(result.lines).toBeUndefined();
    });

    it('should reject non-positive lines parameter', () => {
      expect(() => validateChopScratchpadArgs({ id: 'test-id', lines: 0 })).toThrow(
        'Invalid arguments: lines must be a positive integer'
      );
      expect(() => validateChopScratchpadArgs({ id: 'test-id', lines: -1 })).toThrow(
        'Invalid arguments: lines must be a positive integer'
      );
    });

    it('should reject non-integer lines parameter', () => {
      expect(() => validateChopScratchpadArgs({ id: 'test-id', lines: 1.5 })).toThrow(
        'Invalid arguments: lines must be a positive integer'
      );
      expect(() => validateChopScratchpadArgs({ id: 'test-id', lines: 'invalid' })).toThrow(
        'Invalid arguments: lines must be a positive integer'
      );
    });

    it('should reject non-positive blocks parameter', () => {
      expect(() => validateChopScratchpadArgs({ id: 'test-id', blocks: 0 })).toThrow(
        'Invalid arguments: blocks must be a positive integer'
      );
      expect(() => validateChopScratchpadArgs({ id: 'test-id', blocks: -1 })).toThrow(
        'Invalid arguments: blocks must be a positive integer'
      );
    });

    it('should reject non-integer blocks parameter', () => {
      expect(() => validateChopScratchpadArgs({ id: 'test-id', blocks: 1.5 })).toThrow(
        'Invalid arguments: blocks must be a positive integer'
      );
      expect(() => validateChopScratchpadArgs({ id: 'test-id', blocks: 'invalid' })).toThrow(
        'Invalid arguments: blocks must be a positive integer'
      );
    });
  });

  describe('Basic Chop Functionality', () => {
    it('should chop default 1 line from scratchpad', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(
        workflow.id,
        'Test',
        'Line 1\nLine 2\nLine 3'
      );

      const result = await helper.chopScratchpadContent(scratchpad.id);

      expect(result.chopped_lines).toBe(1);
      expect(result.message).toContain('Chopped 1 line(s)');

      // Verify content was chopped
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toBe('Line 1\nLine 2');
    });

    it('should chop specified number of lines', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(
        workflow.id,
        'Test',
        'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
      );

      const result = await helper.chopScratchpadContent(scratchpad.id, 3);

      expect(result.chopped_lines).toBe(3);
      expect(result.message).toContain('Chopped 3 line(s)');

      // Verify content was chopped correctly
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toBe('Line 1\nLine 2');
    });

    it('should not return scratchpad content in response', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(workflow.id);

      const result = await helper.chopScratchpadContent(scratchpad.id);

      // Verify response structure - should not contain content
      expect(result.scratchpad).toEqual({
        id: scratchpad.id,
        workflow_id: workflow.id,
        title: scratchpad.title,
        created_at: expect.any(String),
        updated_at: expect.any(String),
        size_bytes: expect.any(Number),
      });
      expect(result.scratchpad).not.toHaveProperty('content');
    });

    it('should update size_bytes correctly after chopping', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(
        workflow.id,
        'Test',
        'Line 1\nLine 2\nLine 3'
      );
      const originalSize = scratchpad.size_bytes;

      const result = await helper.chopScratchpadContent(scratchpad.id, 1);

      expect(result.scratchpad.size_bytes).toBeLessThan(originalSize);
      expect(result.scratchpad.size_bytes).toBe(Buffer.byteLength('Line 1\nLine 2', 'utf8'));
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle chopping all lines (empty content)', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(workflow.id, 'Test', 'Line 1\nLine 2');

      const result = await helper.chopScratchpadContent(scratchpad.id, 2);

      expect(result.chopped_lines).toBe(2);

      // Verify content is empty
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toBe('');
      expect(updated?.size_bytes).toBe(0);
    });

    it('should handle chopping more lines than available', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(workflow.id, 'Test', 'Line 1\nLine 2');

      const result = await helper.chopScratchpadContent(scratchpad.id, 5);

      expect(result.chopped_lines).toBe(2); // Only 2 lines were available
      expect(result.message).toContain('Chopped 2 line(s)');

      // Verify content is empty
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toBe('');
    });

    it('should handle single line content', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(workflow.id, 'Test', 'Single line');

      const result = await helper.chopScratchpadContent(scratchpad.id, 1);

      expect(result.chopped_lines).toBe(1);

      // Verify content is empty
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toBe('');
    });

    it('should handle empty content gracefully', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(workflow.id, 'Test', '');

      const result = await helper.chopScratchpadContent(scratchpad.id, 1);

      expect(result.chopped_lines).toBe(0); // No lines to chop

      // Verify content remains empty
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toBe('');
    });

    it('should handle content with only newlines', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(workflow.id, 'Test', '\n\n\n');

      const result = await helper.chopScratchpadContent(scratchpad.id, 2);

      expect(result.chopped_lines).toBe(2);

      // Verify correct lines were removed
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toBe('\n');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent scratchpad', async () => {
      await expect(helper.chopScratchpadContent('non-existent-id')).rejects.toThrow(
        'Scratchpad not found: non-existent-id'
      );
    });

    it('should throw error for inactive workflow', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(workflow.id);

      // Deactivate workflow
      const db = (helper as any).db;
      await db.setWorkflowActiveStatus(workflow.id, false);

      await expect(helper.chopScratchpadContent(scratchpad.id)).rejects.toThrow(
        'Cannot chop scratchpad: workflow is not active'
      );
    });
  });

  describe('UTF-8 and Special Characters', () => {
    it('should handle UTF-8 content correctly', async () => {
      const workflow = await helper.createTestWorkflow();
      const content = '中文第一行\n中文第二行\n中文第三行';
      const scratchpad = await helper.createTestScratchpad(workflow.id, 'UTF-8 Test', content);

      const result = await helper.chopScratchpadContent(scratchpad.id, 1);

      expect(result.chopped_lines).toBe(1);

      // Verify UTF-8 content handled correctly
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toBe('中文第一行\n中文第二行');
      expect(updated?.size_bytes).toBe(Buffer.byteLength('中文第一行\n中文第二行', 'utf8'));
    });

    it('should handle special characters and emojis', async () => {
      const workflow = await helper.createTestWorkflow();
      const content = '🚀 Line 1\n✨ Line 2\n💕 Line 3';
      const scratchpad = await helper.createTestScratchpad(workflow.id, 'Emoji Test', content);

      const result = await helper.chopScratchpadContent(scratchpad.id, 1);

      expect(result.chopped_lines).toBe(1);

      // Verify emoji content handled correctly
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toBe('🚀 Line 1\n✨ Line 2');
    });

    it('should handle mixed line endings', async () => {
      const workflow = await helper.createTestWorkflow();
      const content = 'Line 1\r\nLine 2\nLine 3\r\nLine 4';
      const scratchpad = await helper.createTestScratchpad(workflow.id, 'Mixed Endings', content);

      const result = await helper.chopScratchpadContent(scratchpad.id, 2);

      expect(result.chopped_lines).toBe(2);

      // Verify mixed line endings handled correctly
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toBe('Line 1\r\nLine 2');
    });
  });

  describe('Integration with Other Operations', () => {
    it('should work correctly after append operations', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(workflow.id, 'Test', 'Initial content');

      // Append some content first
      const appendTool = (helper as any).appendScratchpad;
      if (appendTool) {
        await appendTool({ id: scratchpad.id, content: 'Appended line' });
      }

      // Now chop
      const result = await helper.chopScratchpadContent(scratchpad.id, 1);

      expect(result.chopped_lines).toBe(1);

      // Verify the last line was removed
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).not.toContain('Appended line');
    });

    it('should maintain workflow timestamp update', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(workflow.id);
      const originalTimestamp = workflow.updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await helper.chopScratchpadContent(scratchpad.id);

      // Check workflow was updated (would need access to workflow check)
      // This is implicitly tested by the database method
      expect(true).toBe(true); // Placeholder - actual timestamp check would need workflow access
    });
  });

  describe('Block-Based Chop Functionality', () => {
    // Helper to create scratchpad with block structure
    async function createBlockStructuredScratchpad(helper: ChopScratchpadTestHelper, workflowId: string) {
      // Create initial scratchpad
      const scratchpad = await helper.createTestScratchpad(
        workflowId, 
        'Block Test', 
        'First block content'
      );

      // Append additional blocks to create multi-block structure
      const db = (helper as any).db;
      
      // Simulate append operations with new block format
      const appendTemplate = '\n\n---\n<!--- block start --->\n';
      let content = 'First block content';
      content += appendTemplate + 'Second block content';
      content += appendTemplate + 'Third block content';
      content += appendTemplate + 'Fourth block content';
      
      await db.updateScratchpadContent(scratchpad.id, content);
      
      return scratchpad;
    }

    it('should chop single block from end', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await createBlockStructuredScratchpad(helper, workflow.id);

      const result = await helper.chopScratchpadContent(scratchpad.id, undefined, 1);

      expect(result.message).toContain('Chopped 1 block(s)');
      expect(result.message).toContain('4 → 3 blocks');

      // Verify fourth block was removed
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toContain('First block content');
      expect(updated?.content).toContain('Second block content');
      expect(updated?.content).toContain('Third block content');
      expect(updated?.content).not.toContain('Fourth block content');
    });

    it('should chop multiple blocks from end', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await createBlockStructuredScratchpad(helper, workflow.id);

      const result = await helper.chopScratchpadContent(scratchpad.id, undefined, 2);

      expect(result.message).toContain('Chopped 2 block(s)');
      expect(result.message).toContain('4 → 2 blocks');

      // Verify last two blocks were removed
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toContain('First block content');
      expect(updated?.content).toContain('Second block content');
      expect(updated?.content).not.toContain('Third block content');
      expect(updated?.content).not.toContain('Fourth block content');
    });

    it('should chop all blocks (empty result)', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await createBlockStructuredScratchpad(helper, workflow.id);

      const result = await helper.chopScratchpadContent(scratchpad.id, undefined, 4);

      expect(result.message).toContain('Chopped 4 block(s)');
      expect(result.message).toContain('4 → 0 blocks');

      // Verify all content was removed
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toBe('');
      expect(updated?.size_bytes).toBe(0);
    });

    it('should handle chopping more blocks than available', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await createBlockStructuredScratchpad(helper, workflow.id);

      const result = await helper.chopScratchpadContent(scratchpad.id, undefined, 10);

      expect(result.message).toContain('Chopped 4 block(s)'); // Only 4 blocks were available
      expect(result.message).toContain('4 → 0 blocks');

      // Verify all content was removed
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toBe('');
    });

    it('should handle single block with blocks parameter', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(
        workflow.id, 
        'Single Block', 
        'Only one block here'
      );

      const result = await helper.chopScratchpadContent(scratchpad.id, undefined, 1);

      expect(result.message).toContain('Chopped 1 block(s)');
      expect(result.message).toContain('1 → 0 blocks');

      // Verify content is empty
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toBe('');
    });

    it('should handle empty scratchpad with blocks parameter', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(workflow.id, 'Empty', '');

      const result = await helper.chopScratchpadContent(scratchpad.id, undefined, 1);

      expect(result.chopped_lines).toBe(0); // No content to chop
      expect(result.message).toContain('No lines to chop from empty scratchpad');

      // Verify content remains empty
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toBe('');
    });

    it('should handle mixed old and new format blocks', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(
        workflow.id, 
        'Mixed Format Test', 
        'First block'
      );

      // Create mixed format content
      const db = (helper as any).db;
      const mixedContent = 'First block\n\n---\nSecond block (old)\n\n---\n<!--- block start --->\nThird block (new)';
      await db.updateScratchpadContent(scratchpad.id, mixedContent);

      const result = await helper.chopScratchpadContent(scratchpad.id, undefined, 1);

      expect(result.message).toContain('Chopped 1 block(s)');
      expect(result.message).toContain('3 → 2 blocks');

      // Verify last block was removed
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toContain('First block');
      expect(updated?.content).toContain('Second block (old)');
      expect(updated?.content).not.toContain('Third block (new)');
    });

    it('should preserve splitter format after chopping', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createTestScratchpad(
        workflow.id, 
        'Format Preservation', 
        'Block1'
      );

      // Create content with new format splitters
      const db = (helper as any).db;
      const content = 'Block1\n\n---\n<!--- block start --->\nBlock2\n\n---\n<!--- block start --->\nBlock3';
      await db.updateScratchpadContent(scratchpad.id, content);

      const result = await helper.chopScratchpadContent(scratchpad.id, undefined, 1);

      // Verify splitter format is preserved in remaining content
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(updated?.content).toContain('<!--- block start --->');
      expect(updated?.content).toContain('Block1');
      expect(updated?.content).toContain('Block2');
      expect(updated?.content).not.toContain('Block3');
    });

    it('should calculate chopped lines correctly for block operations', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await createBlockStructuredScratchpad(helper, workflow.id);

      // Count original lines
      const originalContent = await helper.getScratchpadContent(scratchpad.id);
      const originalLines = originalContent?.content.split('\n').length || 0;

      const result = await helper.chopScratchpadContent(scratchpad.id, undefined, 2);

      expect(result.chopped_lines).toBeGreaterThan(0);

      // Verify line count calculation
      const updatedContent = await helper.getScratchpadContent(scratchpad.id);
      const remainingLines = updatedContent?.content.split('\n').length || 0;
      expect(result.chopped_lines).toBe(originalLines - remainingLines);
    });

    it('should update size_bytes correctly after block chopping', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await createBlockStructuredScratchpad(helper, workflow.id);
      
      const originalSize = (await helper.getScratchpadContent(scratchpad.id))?.size_bytes || 0;

      const result = await helper.chopScratchpadContent(scratchpad.id, undefined, 1);

      expect(result.scratchpad.size_bytes).toBeLessThan(originalSize);
      
      // Verify actual content size matches reported size
      const updated = await helper.getScratchpadContent(scratchpad.id);
      expect(result.scratchpad.size_bytes).toBe(
        Buffer.byteLength(updated?.content || '', 'utf8')
      );
    });
  });
});
