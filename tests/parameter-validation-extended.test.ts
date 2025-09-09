/**
 * Extended Parameter and Functionality Tests
 *
 * Tests the enhanced functionality for new tools and features:
 * - get-scratchpad-outline basic functionality
 * - get-scratchpad extended functionality (line_range, line_context, include_block)
 * - Cross-parameter interactions
 * - Edge cases and boundary conditions
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScratchpadDatabase } from '../src/database/index.js';
import {
  createWorkflowTool,
  createScratchpadTool,
  getScratchpadTool,
  getScratchpadOutlineTool,
  type CreateWorkflowArgs,
  type CreateScratchpadArgs,
  type GetScratchpadArgs,
  type GetScratchpadOutlineArgs,
} from '../src/tools/index.js';

/**
 * Test helper class for parameter validation testing
 */
class ValidationTestHelper {
  private db: ScratchpadDatabase;
  private createWorkflow: ReturnType<typeof createWorkflowTool>;
  private createScratchpad: ReturnType<typeof createScratchpadTool>;
  private getScratchpad: ReturnType<typeof getScratchpadTool>;
  private getScratchpadOutline: ReturnType<typeof getScratchpadOutlineTool>;

  constructor() {
    this.db = new ScratchpadDatabase({ filename: ':memory:' });
    this.createWorkflow = createWorkflowTool(this.db);
    this.createScratchpad = createScratchpadTool(this.db);
    this.getScratchpad = getScratchpadTool(this.db);
    this.getScratchpadOutline = getScratchpadOutlineTool(this.db);
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

  async callGetScratchpad(args: GetScratchpadArgs) {
    try {
      return await this.getScratchpad(args);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async callGetScratchpadOutline(args: GetScratchpadOutlineArgs) {
    try {
      return await this.getScratchpadOutline(args);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

describe('Extended Parameter Validation Tests', () => {
  let helper: ValidationTestHelper;
  let workflowId: string;
  let scratchpadId: string;

  beforeEach(async () => {
    helper = new ValidationTestHelper();
    
    // Create test workflow
    const workflowResult = await helper.callCreateWorkflow({
      name: 'Parameter Validation Test Workflow',
      description: 'Testing parameter validation for new functionality',
    });
    expect(workflowResult).not.toHaveProperty('error');
    workflowId = workflowResult.workflow.id;

    // Create test scratchpad with structured content
    const testContent = `# Main Title
Some content here.

## Section 1
Content for section 1.
More content.

### Subsection 1.1
Detailed content.

## Section 2
Content for section 2.

# Another Main Title
Final content.`;

    const createResult = await helper.callCreateScratchpad({
      workflow_id: workflowId,
      title: 'Parameter Validation Test Scratchpad',
      content: testContent,
    });
    expect(createResult).not.toHaveProperty('error');
    scratchpadId = createResult.scratchpad.id;
  });

  afterEach(async () => {
    helper.getDatabase().close();
  });

  describe('get-scratchpad-outline Parameter Validation', () => {
    it('should require id parameter', async () => {
      // Note: Direct tool calls may not enforce all validations that server-helpers.ts provides
      const result = await helper.callGetScratchpadOutline({} as any);
      
      expect(result).toHaveProperty('error');
    });

    // Note: Most parameter validation is handled by server-helpers.ts
    // Direct tool calls bypass these validations, so tests are simplified

    it('should accept valid parameters', async () => {
      const result = await helper.callGetScratchpadOutline({
        id: scratchpadId,
        max_depth: 3,
        include_content_preview: true,
        include_line_numbers: false,
      });
      
      expect(result).not.toHaveProperty('error');
      expect(result).toHaveProperty('outline');
    });
  });

  describe('get-scratchpad Extended Parameter Validation', () => {
    it('should validate basic line_range functionality', async () => {
      // Test valid line_range
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 1, end: 5 },
      });
      expect(result).not.toHaveProperty('error');
    });

    it('should validate line_range end parameter', async () => {
      // end < start
      const result1 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 5, end: 3 },
      });
      expect(result1).toHaveProperty('error');
      expect(result1.error).toContain('line_range.end must be >= line_range.start');

      // Invalid end type
      const result2 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 1, end: '5' },
      } as any);
      expect(result2).toHaveProperty('error');
      expect(result2.error).toContain('line_range.end must be a number');

      // Invalid end value (< 1)
      const result3 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 1, end: 0 },
      } as any);
      expect(result3).toHaveProperty('error');
      expect(result3.error).toContain('line_range.end must be >= 1');
    });

    it('should validate line_context parameter structure', async () => {
      // Missing required line property
      const result1 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { before: 2, after: 3 },
      } as any);
      expect(result1).toHaveProperty('error');
      expect(result1.error).toContain('line_context.line is required');

      // Invalid line value (< 1)
      const result2 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 0 },
      } as any);
      expect(result2).toHaveProperty('error');
      expect(result2.error).toContain('line_context.line must be >= 1');

      // Invalid line type
      const result3 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: '5' },
      } as any);
      expect(result3).toHaveProperty('error');
      expect(result3.error).toContain('line_context.line must be a number');
    });

    it('should validate line_context before and after parameters', async () => {
      // Invalid before value (< 0)
      const result1 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 5, before: -1 },
      } as any);
      expect(result1).toHaveProperty('error');
      expect(result1.error).toContain('line_context.before must be >= 0');

      // Invalid after value (< 0)
      const result2 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 5, after: -1 },
      } as any);
      expect(result2).toHaveProperty('error');
      expect(result2.error).toContain('line_context.after must be >= 0');

      // Invalid before type
      const result3 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 5, before: '2' },
      } as any);
      expect(result3).toHaveProperty('error');
      expect(result3.error).toContain('line_context.before must be a number');

      // Invalid after type
      const result4 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 5, after: '3' },
      } as any);
      expect(result4).toHaveProperty('error');
      expect(result4.error).toContain('line_context.after must be a number');
    });

    it('should validate include_block parameter type', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 5 },
        include_block: 'true',
      } as any);
      
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('include_block must be a boolean');
    });

    it('should validate include_block only works with line_context', async () => {
      const result1 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 1, end: 5 },
        include_block: true,
      } as any);
      expect(result1).toHaveProperty('error');
      expect(result1.error).toContain('include_block can only be used with line_context');

      const result2 = await helper.callGetScratchpad({
        id: scratchpadId,
        include_block: true,
      } as any);
      expect(result2).toHaveProperty('error');
      expect(result2.error).toContain('include_block can only be used with line_context');
    });
  });

  describe('Cross-Parameter Conflict Detection', () => {
    it('should reject multiple range parameters', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 1, end: 5 },
        line_context: { line: 3 },
      } as any);

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Only one range parameter can be specified');
    });

    it('should allow range parameters with existing parameters', async () => {
      // line_range with max_content_chars
      const result1 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 1, end: 3 },
        max_content_chars: 100,
      });
      expect(result1).not.toHaveProperty('error');

      // line_context with include_content
      const result2 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 2, before: 1, after: 1 },
        include_content: true,
      });
      expect(result2).not.toHaveProperty('error');

      // line_context with include_block
      const result3 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 5 },
        include_block: true,
      });
      expect(result3).not.toHaveProperty('error');
    });
  });

  describe('Dynamic Validation Based on Content', () => {
    it('should validate line numbers against actual content length', async () => {
      // Get the actual line count first
      const fullResult = await helper.callGetScratchpad({
        id: scratchpadId,
      });
      expect(fullResult).not.toHaveProperty('error');
      
      const lineCount = fullResult.scratchpad.content.split('\n').length;

      // Test line_range.start beyond content
      const result1 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: lineCount + 1 },
      });
      // Lenient behavior: start beyond total returns empty content without error
      expect(result1).not.toHaveProperty('error');
      expect(result1.scratchpad).not.toBeNull();
      expect(result1.scratchpad!.content).toBe('');

      // Test line_range.end beyond content
      const result2 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 1, end: lineCount + 5 },
      });
      // Lenient behavior: end beyond total is clamped to EOF, not an error
      expect(result2).not.toHaveProperty('error');

      // Test line_context.line beyond content
      const result3 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: lineCount + 2 },
      });
      expect(result3).toHaveProperty('error');
      expect(result3.error).toContain(`line_context.line must be between 1 and ${lineCount}`);
    });

    it('should handle empty content gracefully', async () => {
      // Create empty scratchpad
      const emptyResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Empty Scratchpad',
        content: '',
      });
      expect(emptyResult).not.toHaveProperty('error');

      // Test line_range with empty content (lenient: empty string, no error)
      const result1 = await helper.callGetScratchpad({
        id: emptyResult.scratchpad.id,
        line_range: { start: 1, end: 1 },
      });
      expect(result1).not.toHaveProperty('error');
      expect(result1.scratchpad).not.toBeNull();
      expect(result1.scratchpad!.content).toBe('');

      // Test line_context with empty content
      const result2 = await helper.callGetScratchpad({
        id: emptyResult.scratchpad.id,
        line_context: { line: 1 },
      });
      expect(result2).toHaveProperty('error');
      expect(result2.error).toContain('line_context.line must be between 1 and 1');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle single-line content correctly', async () => {
      // Create single-line scratchpad
      const singleLineResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Single Line Scratchpad',
        content: 'Single line of content',
      });
      expect(singleLineResult).not.toHaveProperty('error');

      // Valid single line range
      const result1 = await helper.callGetScratchpad({
        id: singleLineResult.scratchpad.id,
        line_range: { start: 1, end: 1 },
      });
      expect(result1).not.toHaveProperty('error');

      // Valid single line context
      const result2 = await helper.callGetScratchpad({
        id: singleLineResult.scratchpad.id,
        line_context: { line: 1, before: 0, after: 0 },
      });
      expect(result2).not.toHaveProperty('error');

      // Range beyond single line should be clamped (lenient behavior)
      const result3 = await helper.callGetScratchpad({
        id: singleLineResult.scratchpad.id,
        line_range: { start: 1, end: 2 },
      });
      expect(result3).not.toHaveProperty('error');
      expect(result3.scratchpad).not.toBeNull();
      expect(result3.scratchpad!.content).toBe('Single line of content');
    });

    it('should validate maximum reasonable values', async () => {
      // Very large line_context.before
      const result1 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 5, before: 1000000 },
      });
      expect(result1).not.toHaveProperty('error'); // Should clamp to reasonable bounds

      // Very large line_context.after
      const result2 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 5, after: 1000000 },
      });
      expect(result2).not.toHaveProperty('error'); // Should clamp to reasonable bounds
    });

    it('should handle non-existent scratchpad IDs', async () => {
      const result1 = await helper.callGetScratchpad({
        id: 'non-existent-id',
        line_range: { start: 1, end: 5 },
      });
      // Lenient behavior: return null without error
      expect(result1).not.toHaveProperty('error');
      expect(result1.scratchpad).toBeNull();

      const result2 = await helper.callGetScratchpadOutline({
        id: 'non-existent-id',
        max_depth: 3,
      });
      expect(result2).toHaveProperty('error');
      expect(result2.error).toContain('Scratchpad not found');
    });
  });

  describe('Parameter Type Coercion and Edge Cases', () => {
    it('should reject non-object line_range parameter', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: 'invalid',
      } as any);
      
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('line_range must be an object');
    });

    it('should reject non-object line_context parameter', async () => {
      const result = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: 'invalid',
      } as any);
      
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('line_context must be an object');
    });

    it('should reject null range parameters', async () => {
      const result1 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: null,
      } as any);
      expect(result1).toHaveProperty('error');

      const result2 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: null,
      } as any);
      expect(result2).toHaveProperty('error');
    });

    it('should handle floating point numbers in range parameters', async () => {
      const result1 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_range: { start: 1.5, end: 3.7 },
      } as any);
      expect(result1).toHaveProperty('error');
      expect(result1.error).toContain('must be an integer');

      const result2 = await helper.callGetScratchpad({
        id: scratchpadId,
        line_context: { line: 2.5, before: 1.2, after: 2.8 },
      } as any);
      expect(result2).toHaveProperty('error');
      expect(result2.error).toContain('must be an integer');
    });
  });
});