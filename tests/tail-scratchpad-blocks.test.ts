/**
 * Tail-Scratchpad Block Operations Tests
 * 
 * Tests for the tail-scratchpad tool with blocks parameter support,
 * including new format compatibility, edge cases, and validation.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScratchpadDatabase } from '../src/database/index.js';
import {
  createWorkflowTool,
  createScratchpadTool,
  tailScratchpadTool,
  type CreateWorkflowArgs,
  type CreateScratchpadArgs,
  type TailScratchpadArgs,
} from '../src/tools/index.js';
import { validateTailScratchpadArgs } from '../src/server-helpers.js';

/**
 * Test helper class for tail-scratchpad block operations testing
 */
class TailScratchpadBlockTestHelper {
  private db: ScratchpadDatabase;

  // Tool handlers
  private createWorkflow: ReturnType<typeof createWorkflowTool>;
  private createScratchpad: ReturnType<typeof createScratchpadTool>;
  private tailScratchpad: ReturnType<typeof tailScratchpadTool>;

  constructor() {
    this.db = new ScratchpadDatabase({ filename: ':memory:' });

    // Initialize tool handlers
    this.createWorkflow = createWorkflowTool(this.db);
    this.createScratchpad = createScratchpadTool(this.db);
    this.tailScratchpad = tailScratchpadTool(this.db);
  }

  cleanup() {
    this.db.close();
  }

  async createTestWorkflow(name = 'Test Workflow') {
    const args: CreateWorkflowArgs = { name };
    const result = await this.createWorkflow(args);
    return result.workflow;
  }

  async createBlockStructuredScratchpad(workflowId: string) {
    // Create initial scratchpad
    const args: CreateScratchpadArgs = {
      workflow_id: workflowId,
      title: 'Block Structure Test',
      content: 'First block content',
    };
    const result = await this.createScratchpad(args);
    const scratchpad = result.scratchpad;

    // Build multi-block structure with new format splitters
    const appendTemplate = '\n\n---\n<!--- block start --->\n';
    let content = 'First block content';
    content += appendTemplate + 'Second block content\nSecond block line 2';
    content += appendTemplate + 'Third block content\nThird block line 2\nThird block line 3';
    content += appendTemplate + 'Fourth block content';

    // Update the scratchpad with block-structured content
    await this.db.updateScratchpadContent(scratchpad.id, content);

    return scratchpad;
  }

  async tailScratchpadWithBlocks(id: string, blocks: number) {
    const args: TailScratchpadArgs = {
      id,
      tail_size: { blocks },
      include_content: true,
    };
    return await this.tailScratchpad(args);
  }

  async tailScratchpadWithLines(id: string, lines: number) {
    const args: TailScratchpadArgs = {
      id,
      tail_size: { lines },
      include_content: true,
    };
    return await this.tailScratchpad(args);
  }

  async tailScratchpadWithChars(id: string, chars: number) {
    const args: TailScratchpadArgs = {
      id,
      tail_size: { chars },
      include_content: true,
    };
    return await this.tailScratchpad(args);
  }
}

describe('Tail-Scratchpad Block Operations Tests', () => {
  let helper: TailScratchpadBlockTestHelper;

  beforeEach(() => {
    helper = new TailScratchpadBlockTestHelper();
  });

  afterEach(() => {
    helper.cleanup();
  });

  describe('Parameter Validation for Blocks', () => {
    it('should accept valid blocks parameter', () => {
      const result = validateTailScratchpadArgs({
        id: 'test-id',
        tail_size: { blocks: 2 }
      });
      expect(result.id).toBe('test-id');
      expect(result.tail_size).toEqual({ blocks: 2 });
    });

    it('should reject multiple parameters in tail_size', () => {
      expect(() => validateTailScratchpadArgs({
        id: 'test-id',
        tail_size: { lines: 5, blocks: 2 }
      })).toThrow('tail_size must specify either lines OR chars OR blocks, not multiple');
      
      expect(() => validateTailScratchpadArgs({
        id: 'test-id',
        tail_size: { chars: 100, blocks: 2 }
      })).toThrow('tail_size must specify either lines OR chars OR blocks, not multiple');

      expect(() => validateTailScratchpadArgs({
        id: 'test-id',
        tail_size: { lines: 5, chars: 100, blocks: 2 }
      })).toThrow('tail_size must specify either lines OR chars OR blocks, not multiple');
    });

    it('should reject non-positive blocks parameter', () => {
      expect(() => validateTailScratchpadArgs({
        id: 'test-id',
        tail_size: { blocks: 0 }
      })).toThrow('tail_size.blocks must be a positive integer');

      expect(() => validateTailScratchpadArgs({
        id: 'test-id',
        tail_size: { blocks: -1 }
      })).toThrow('tail_size.blocks must be a positive integer');
    });

    it('should reject non-integer blocks parameter', () => {
      expect(() => validateTailScratchpadArgs({
        id: 'test-id',
        tail_size: { blocks: 1.5 }
      })).toThrow('tail_size.blocks must be a positive integer');

      expect(() => validateTailScratchpadArgs({
        id: 'test-id',
        tail_size: { blocks: 'invalid' as any }
      })).toThrow('tail_size.blocks must be a positive integer');
    });

    it('should reject empty tail_size object', () => {
      expect(() => validateTailScratchpadArgs({
        id: 'test-id',
        tail_size: {}
      })).toThrow('tail_size must specify exactly one of lines, chars, or blocks');
    });

    it('should reject tail_size with all undefined values', () => {
      expect(() => validateTailScratchpadArgs({
        id: 'test-id',
        tail_size: { lines: undefined, chars: undefined, blocks: undefined }
      })).toThrow('tail_size must specify exactly one of lines, chars, or blocks');
    });

    it('should reject multiple properties specified in tail_size', () => {
      expect(() => validateTailScratchpadArgs({
        id: 'test-id',
        tail_size: { lines: 50, chars: 200 }
      })).toThrow('tail_size must specify either lines OR chars OR blocks, not multiple');

      expect(() => validateTailScratchpadArgs({
        id: 'test-id',
        tail_size: { lines: 50, blocks: 2 }
      })).toThrow('tail_size must specify either lines OR chars OR blocks, not multiple');

      expect(() => validateTailScratchpadArgs({
        id: 'test-id',
        tail_size: { chars: 200, blocks: 2 }
      })).toThrow('tail_size must specify either lines OR chars OR blocks, not multiple');

      expect(() => validateTailScratchpadArgs({
        id: 'test-id',
        tail_size: { lines: 50, chars: 200, blocks: 2 }
      })).toThrow('tail_size must specify either lines OR chars OR blocks, not multiple');
    });
  });

  describe('Block-Based Tail Extraction', () => {
    it('should extract single block from end', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createBlockStructuredScratchpad(workflow.id);

      const result = await helper.tailScratchpadWithBlocks(scratchpad.id, 1);

      expect(result.scratchpad?.content).toContain('Fourth block content');
      expect(result.scratchpad?.content).not.toContain('First block content');
      expect(result.scratchpad?.content).not.toContain('Second block content');
      expect(result.scratchpad?.content).not.toContain('Third block content');
      expect(result.message).toContain('last 1 block(s)');
    });

    it('should extract multiple blocks from end', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createBlockStructuredScratchpad(workflow.id);

      const result = await helper.tailScratchpadWithBlocks(scratchpad.id, 2);

      expect(result.scratchpad?.content).toContain('Third block content');
      expect(result.scratchpad?.content).toContain('Fourth block content');
      expect(result.scratchpad?.content).not.toContain('First block content');
      expect(result.scratchpad?.content).not.toContain('Second block content');
      expect(result.message).toContain('last 2 block(s)');
    });

    it('should extract all blocks when requesting more than available', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createBlockStructuredScratchpad(workflow.id);

      const result = await helper.tailScratchpadWithBlocks(scratchpad.id, 10);

      expect(result.scratchpad?.content).toContain('First block content');
      expect(result.scratchpad?.content).toContain('Second block content');
      expect(result.scratchpad?.content).toContain('Third block content');
      expect(result.scratchpad?.content).toContain('Fourth block content');
      expect(result.message).toContain('last 10 block(s)');
    });

    it('should preserve splitter format in extracted blocks', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createBlockStructuredScratchpad(workflow.id);

      const result = await helper.tailScratchpadWithBlocks(scratchpad.id, 2);

      // Should contain the new format block splitter
      expect(result.scratchpad?.content).toContain('<!--- block start --->');
      expect(result.scratchpad?.content).toContain('Third block content');
      expect(result.scratchpad?.content).toContain('Fourth block content');
    });

    it('should handle single block content correctly', async () => {
      const workflow = await helper.createTestWorkflow();
      const args: CreateScratchpadArgs = {
        workflow_id: workflow.id,
        title: 'Single Block',
        content: 'Only one block here',
      };
      const createResult = await helper['createScratchpad'](args);
      const scratchpad = createResult.scratchpad;

      const result = await helper.tailScratchpadWithBlocks(scratchpad.id, 1);

      expect(result.scratchpad?.content).toBe('Only one block here');
      expect(result.message).toContain('last 1 block(s)');
    });

    it('should handle empty content gracefully', async () => {
      const workflow = await helper.createTestWorkflow();
      const args: CreateScratchpadArgs = {
        workflow_id: workflow.id,
        title: 'Empty Content',
        content: '',
      };
      const createResult = await helper['createScratchpad'](args);
      const scratchpad = createResult.scratchpad;

      const result = await helper.tailScratchpadWithBlocks(scratchpad.id, 1);

      expect(result.scratchpad?.content).toBe('');
      expect(result.message).toContain('last 1 block(s)');
    });
  });

  describe('Mixed Format Compatibility', () => {
    it('should handle mixed old and new format splitters', async () => {
      const workflow = await helper.createTestWorkflow();
      const args: CreateScratchpadArgs = {
        workflow_id: workflow.id,
        title: 'Mixed Format',
        content: 'First block\n\n---\nSecond block (old)\n\n---\n<!--- block start --->\nThird block (new)',
      };
      const createResult = await helper['createScratchpad'](args);
      const scratchpad = createResult.scratchpad;

      const result = await helper.tailScratchpadWithBlocks(scratchpad.id, 2);

      expect(result.scratchpad?.content).toContain('Second block (old)');
      expect(result.scratchpad?.content).toContain('Third block (new)');
      expect(result.scratchpad?.content).not.toContain('First block');
    });

    it('should prioritize new format over old when overlapping', async () => {
      const workflow = await helper.createTestWorkflow();
      
      // Create content where new format contains old format pattern
      const args: CreateScratchpadArgs = {
        workflow_id: workflow.id,
        title: 'Overlapping Format',
        content: 'Block1\n\n---\n<!--- block start --->\nBlock2',
      };
      const createResult = await helper['createScratchpad'](args);
      const scratchpad = createResult.scratchpad;

      const result = await helper.tailScratchpadWithBlocks(scratchpad.id, 1);

      expect(result.scratchpad?.content).toBe('Block2');
      expect(result.scratchpad?.content).not.toContain('Block1');
    });
  });

  describe('Comparison with Lines and Chars', () => {
    it('should provide different results for blocks vs lines', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createBlockStructuredScratchpad(workflow.id);

      // 取得 1 個 block（整個第四塊） vs 取得 3 行（包含第三和第四塊的部分）
      const blockResult = await helper.tailScratchpadWithBlocks(scratchpad.id, 1);
      const lineResult = await helper.tailScratchpadWithLines(scratchpad.id, 3);

      expect(blockResult.scratchpad?.content).not.toBe(lineResult.scratchpad?.content);
      expect(blockResult.message).toContain('block(s)');
      expect(lineResult.message).toContain('lines');
    });

    it('should handle blocks vs chars differently', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createBlockStructuredScratchpad(workflow.id);

      const blockResult = await helper.tailScratchpadWithBlocks(scratchpad.id, 1);
      const charResult = await helper.tailScratchpadWithChars(scratchpad.id, 50);

      expect(blockResult.scratchpad?.content).not.toBe(charResult.scratchpad?.content);
      expect(blockResult.message).toContain('block(s)');
      expect(charResult.message).toContain('chars');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle blocks with empty content between splitters', async () => {
      const workflow = await helper.createTestWorkflow();
      const args: CreateScratchpadArgs = {
        workflow_id: workflow.id,
        title: 'Empty Blocks',
        content: 'Block1\n\n---\n<!--- block start --->\n\n\n---\n<!--- block start --->\nBlock3',
      };
      const createResult = await helper['createScratchpad'](args);
      const scratchpad = createResult.scratchpad;

      const result = await helper.tailScratchpadWithBlocks(scratchpad.id, 2);

      expect(result.scratchpad?.content).toContain('Block3');
      // Should include the empty block as well - content starts with empty block and full splitter
      expect(result.scratchpad?.content).toMatch(/^[\s\n]*---[\s\n]*<!--- block start --->[\s\n]*Block3$/);
    });

    it('should handle content ending with splitter', async () => {
      const workflow = await helper.createTestWorkflow();
      const args: CreateScratchpadArgs = {
        workflow_id: workflow.id,
        title: 'Ending Splitter',
        content: 'Block1\n\n---\n<!--- block start --->\nBlock2\n\n---\n<!--- block start --->\n',
      };
      const createResult = await helper['createScratchpad'](args);
      const scratchpad = createResult.scratchpad;

      const result = await helper.tailScratchpadWithBlocks(scratchpad.id, 1);

      expect(result.scratchpad?.content).toBe('');
    });

    it('should calculate tail statistics correctly', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createBlockStructuredScratchpad(workflow.id);

      const result = await helper.tailScratchpadWithBlocks(scratchpad.id, 2);

      expect(result.scratchpad?.tail_lines).toBeGreaterThan(0);
      expect(result.scratchpad?.tail_chars).toBeGreaterThan(0);
      expect(result.scratchpad?.total_lines).toBeGreaterThan(result.scratchpad?.tail_lines || 0);
      expect(result.scratchpad?.is_tail_content).toBe(true);
      expect(result.scratchpad?.size_bytes).toBeGreaterThan(0); // Original scratchpad size
    });

    it('should handle UTF-8 content in blocks correctly', async () => {
      const workflow = await helper.createTestWorkflow();
      const args: CreateScratchpadArgs = {
        workflow_id: workflow.id,
        title: 'UTF-8 Blocks',
        content: '中文第一塊\n\n---\n<!--- block start --->\n🚀 Emoji block\n\n---\n<!--- block start --->\nFinal block',
      };
      const createResult = await helper['createScratchpad'](args);
      const scratchpad = createResult.scratchpad;

      const result = await helper.tailScratchpadWithBlocks(scratchpad.id, 2);

      expect(result.scratchpad?.content).toContain('🚀 Emoji block');
      expect(result.scratchpad?.content).toContain('Final block');
      expect(result.scratchpad?.content).not.toContain('中文第一塊');
    });

    it('should handle include_content=false correctly', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createBlockStructuredScratchpad(workflow.id);

      const args: TailScratchpadArgs = {
        id: scratchpad.id,
        tail_size: { blocks: 1 },
        include_content: false,
      };
      const result = await helper['tailScratchpad'](args);

      expect(result.scratchpad?.content).toBe('');
      expect(result.message).toContain('Content excluded');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent scratchpad', async () => {
      const result = await helper.tailScratchpadWithBlocks('non-existent', 1);
      expect(result.scratchpad).toBeNull();
    });

    it('should handle inactive workflow', async () => {
      const workflow = await helper.createTestWorkflow();
      const scratchpad = await helper.createBlockStructuredScratchpad(workflow.id);

      // Deactivate workflow
      await (helper as any).db.setWorkflowActiveStatus(workflow.id, false);

      // tail-scratchpad should still work (read-only operation)
      const result = await helper.tailScratchpadWithBlocks(scratchpad.id, 1);
      expect(result.scratchpad).toBeTruthy();
    });
  });
});