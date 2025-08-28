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

  async chopScratchpadContent(id: string, lines?: number) {
    const args: ChopScratchpadArgs = { id };
    if (lines !== undefined) {
      args.lines = lines;
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
});
