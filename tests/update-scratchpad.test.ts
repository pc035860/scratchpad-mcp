/**
 * Update Scratchpad Tool - End-to-End MCP Integration Tests
 *
 * Tests the update-scratchpad MCP tool directly to ensure proper functionality,
 * parameter validation, and response formatting for all four editing modes.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScratchpadDatabase } from '../src/database/index.js';
import {
  createWorkflowTool,
  createScratchpadTool,
  getScratchpadTool,
  enhancedUpdateScratchpadTool,
  type CreateWorkflowArgs,
  type CreateScratchpadArgs,
  type GetScratchpadArgs,
  type EnhancedUpdateScratchpadArgs,
} from '../src/tools/index.js';
import { validateEnhancedUpdateScratchpadArgs } from '../src/server-helpers.js';

/**
 * Test helper class for Enhanced Update Scratchpad MCP tool
 */
class EnhancedUpdateTestHelper {
  private db: ScratchpadDatabase;

  // Tool handlers
  private createWorkflow: ReturnType<typeof createWorkflowTool>;
  private createScratchpad: ReturnType<typeof createScratchpadTool>;
  private getScratchpad: ReturnType<typeof getScratchpadTool>;
  private enhancedUpdate: ReturnType<typeof enhancedUpdateScratchpadTool>;

  constructor() {
    this.db = new ScratchpadDatabase({ filename: ':memory:' });

    // Initialize tool handlers
    this.createWorkflow = createWorkflowTool(this.db);
    this.createScratchpad = createScratchpadTool(this.db);
    this.getScratchpad = getScratchpadTool(this.db);
    this.enhancedUpdate = enhancedUpdateScratchpadTool(this.db);
  }

  // Tool wrapper methods with error handling
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

  async callEnhancedUpdate(args: EnhancedUpdateScratchpadArgs) {
    try {
      // First validate parameters like the real MCP server does
      const validatedArgs = validateEnhancedUpdateScratchpadArgs(args);
      return await this.enhancedUpdate(validatedArgs);
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

describe('Enhanced Update Scratchpad - MCP Integration Tests', () => {
  let helper: EnhancedUpdateTestHelper;
  let workflowId: string;
  let scratchpadId: string;

  beforeEach(async () => {
    helper = new EnhancedUpdateTestHelper();

    // Create test workflow
    const workflowResult = await helper.callCreateWorkflow({
      name: 'Enhanced Update Test Workflow',
      description: 'Test workflow for enhanced update functionality',
    });
    expect(workflowResult).not.toHaveProperty('error');
    workflowId = workflowResult.workflow.id;

    // Create test scratchpad
    const scratchpadResult = await helper.callCreateScratchpad({
      workflow_id: workflowId,
      title: 'Test Scratchpad for Enhanced Updates',
      content: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
      include_content: true,
    });
    expect(scratchpadResult).not.toHaveProperty('error');
    scratchpadId = scratchpadResult.scratchpad.id;
  });

  afterEach(() => {
    helper.close();
  });

  describe('Mode 1: replace - Complete Replacement', () => {
    it('should replace entire content successfully', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace',
        content: 'Completely new content\nWith multiple lines',
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result).toHaveProperty('scratchpad');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('operation_details');

      expect(result.scratchpad.content).toBe('Completely new content\nWith multiple lines');
      expect(result.operation_details.mode).toBe('replace');
      expect(result.operation_details.lines_affected).toBe(2);
      expect(result.operation_details.previous_size_bytes).toBe(34); // Original content size
      expect(result.operation_details.size_change_bytes).toBeGreaterThan(0);

      // Verify via get
      const getResult = await helper.callGetScratchpad({ id: scratchpadId });
      expect(getResult).not.toHaveProperty('error');
      expect(getResult.scratchpad.content).toBe('Completely new content\nWith multiple lines');
    });

    it('should handle empty content replacement', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace',
        content: '',
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad.content).toBe('');
      expect(result.operation_details.lines_affected).toBe(0);
      expect(result.operation_details.size_change_bytes).toBeLessThan(0);
    });

    it('should reject extra parameters for replace mode', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace',
        content: 'New content',
        line_number: 2, // Should not be allowed for replace mode
      } as any);

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('unexpected parameters');
    });
  });

  describe('Mode 2: insert_at_line - Line Number Insertion', () => {
    it('should insert content at beginning (line 1)', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'insert_at_line',
        content: 'New first line',
        line_number: 1,
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad.content).toBe('New first line\nLine 1\nLine 2\nLine 3\nLine 4\nLine 5');
      expect(result.operation_details.mode).toBe('insert_at_line');
      expect(result.operation_details.lines_affected).toBe(1);
      expect(result.operation_details.insertion_point).toBe(1);
    });

    it('should insert content at middle (line 3)', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'insert_at_line',
        content: 'Inserted at line 3',
        line_number: 3,
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad.content).toBe('Line 1\nLine 2\nInserted at line 3\nLine 3\nLine 4\nLine 5');
      expect(result.operation_details.insertion_point).toBe(3);
    });

    it('should insert content at end (beyond last line)', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'insert_at_line',
        content: 'Inserted at end',
        line_number: 10, // Beyond the 5 existing lines
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad.content).toBe('Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nInserted at end');
      expect(result.operation_details.insertion_point).toBe(6); // Actual insertion point
    });

    it('should handle multi-line insertion', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'insert_at_line',
        content: 'First new line\nSecond new line',
        line_number: 2,
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad.content).toBe('Line 1\nFirst new line\nSecond new line\nLine 2\nLine 3\nLine 4\nLine 5');
      expect(result.operation_details.lines_affected).toBe(2);
    });

    it('should reject invalid line_number', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'insert_at_line',
        content: 'Test',
        line_number: 0, // Invalid: must be >= 1
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('line_number must be >= 1');
    });

    it('should reject missing line_number', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'insert_at_line',
        content: 'Test',
        // missing line_number
      } as any);

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('line_number is required');
    });
  });

  describe('Mode 3: replace_lines - Range Replacement', () => {
    it('should replace single line', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace_lines',
        content: 'Replaced line 2',
        start_line: 2,
        end_line: 2,
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad.content).toBe('Line 1\nReplaced line 2\nLine 3\nLine 4\nLine 5');
      expect(result.operation_details.mode).toBe('replace_lines');
      expect(result.operation_details.lines_affected).toBe(1);
      expect(result.operation_details.replaced_range).toEqual({
        start_line: 2,
        end_line: 2,
      });
    });

    it('should replace multiple lines', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace_lines',
        content: 'New line 2-3\nAnother new line',
        start_line: 2,
        end_line: 3,
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad.content).toBe('Line 1\nNew line 2-3\nAnother new line\nLine 4\nLine 5');
      expect(result.operation_details.lines_affected).toBe(2);
      expect(result.operation_details.replaced_range).toEqual({
        start_line: 2,
        end_line: 3,
      });
    });

    it('should replace with different line count', async () => {
      // Replace 2 lines with 1 line
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace_lines',
        content: 'Single replacement line',
        start_line: 3,
        end_line: 4,
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad.content).toBe('Line 1\nLine 2\nSingle replacement line\nLine 5');
      expect(result.operation_details.lines_affected).toBe(1); // Final line count
    });

    it('should handle replacing entire content', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace_lines',
        content: 'Only line',
        start_line: 1,
        end_line: 5,
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad.content).toBe('Only line');
      expect(result.operation_details.lines_affected).toBe(1);
    });

    it('should reject invalid range (start > end)', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace_lines',
        content: 'Test',
        start_line: 3,
        end_line: 2, // Invalid: start > end
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('start_line must be <= end_line');
    });

    it('should reject missing range parameters', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace_lines',
        content: 'Test',
        start_line: 2,
        // missing end_line
      } as any);

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('end_line is required');
    });

    it('should handle out of bounds ranges gracefully', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace_lines',
        content: 'Beyond bounds replacement',
        start_line: 10,
        end_line: 15, // Way beyond the 5 existing lines
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      // Should append at the end
      expect(result.scratchpad.content).toBe('Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nBeyond bounds replacement');
    });
  });

  describe('Mode 4: append_section - Markdown Section Appending', () => {
    beforeEach(async () => {
      // Create a markdown-structured scratchpad for section testing
      const markdownContent = `# Project Overview

This is the project overview section.

## Features

- Feature 1
- Feature 2

## Implementation Notes

Some implementation details here.

## Conclusion

Final thoughts.`;

      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace',
        content: markdownContent,
      });
      expect(result).not.toHaveProperty('error');
    });

    it('should append to existing section', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'append_section',
        content: '- Feature 3\n- Feature 4',
        section_marker: '## Features',
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad.content).toContain('- Feature 1\n- Feature 2');
      expect(result.scratchpad.content).toContain('- Feature 3\n- Feature 4');
      expect(result.operation_details.mode).toBe('append_section');
      expect(result.operation_details.lines_affected).toBe(2);
    });

    it('should handle section marker not found (append at end)', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'append_section',
        content: 'New section content',
        section_marker: '## Non-existent Section',
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad.content).toContain('Final thoughts.');
      expect(result.scratchpad.content).toContain('New section content');
      // Should be appended at the very end
      expect(result.scratchpad.content.endsWith('New section content')).toBe(true);
    });

    it('should handle multiple same markers (append to first)', async () => {
      // First add a duplicate section
      await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace',
        content: `# Project Overview

This is the project overview section.

## Features

- Feature 1
- Feature 2

## Implementation Notes

Some implementation details here.

## Features

- Duplicate features section
- Another feature

## Conclusion

Final thoughts.`,
      });

      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'append_section',
        content: '- Additional feature',
        section_marker: '## Features',
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      // Should append to the first Features section, not the second one
      const content = result.scratchpad.content;
      const firstFeaturesIndex = content.indexOf('## Features');
      const addedFeatureIndex = content.indexOf('- Additional feature');
      const secondFeaturesIndex = content.indexOf('## Features', firstFeaturesIndex + 1);

      expect(addedFeatureIndex).toBeGreaterThan(firstFeaturesIndex);
      expect(addedFeatureIndex).toBeLessThan(secondFeaturesIndex);
    });

    it('should reject missing section_marker', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'append_section',
        content: 'Test content',
        // missing section_marker
      } as any);

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('section_marker is required');
    });

    it('should handle empty section_marker', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'append_section',
        content: 'Test content',
        section_marker: '',
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('section_marker is required');
    });
  });

  describe('Parameter Validation and Error Handling', () => {
    it('should reject invalid scratchpad id', async () => {
      const result = await helper.callEnhancedUpdate({
        id: 'invalid-scratchpad-id',
        mode: 'replace',
        content: 'Test content',
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toMatch(/scratchpad.*not found/i);
    });

    it('should reject missing required parameters', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace',
        // missing content
      } as any);

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('content');
    });

    it('should reject invalid mode', async () => {
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'invalid_mode' as any,
        content: 'Test content',
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('mode must be one of');
    });

    it('should handle include_content parameter correctly', async () => {
      // Test include_content: false
      const result1 = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace',
        content: 'New content without return',
        include_content: false,
      });

      expect(result1).not.toHaveProperty('error');
      expect(result1.scratchpad.content).toBeUndefined();
      expect(result1.message).toContain('Content not included in response');

      // Test include_content: true (explicit)
      const result2 = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace',
        content: 'New content with return',
        include_content: true,
      });

      expect(result2).not.toHaveProperty('error');
      expect(result2.scratchpad.content).toBe('New content with return');

      // Test default behavior (should include content)
      const result3 = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace',
        content: 'Default behavior content',
      });

      expect(result3).not.toHaveProperty('error');
      expect(result3.scratchpad.content).toBe('Default behavior content');
    });
  });

  describe('Integration with Existing Tools', () => {
    it('should work seamlessly with get-scratchpad tool', async () => {
      // Update using enhanced tool
      const updateResult = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'insert_at_line',
        content: 'Inserted via enhanced tool',
        line_number: 3,
      });

      expect(updateResult).not.toHaveProperty('error');

      // Verify with get-scratchpad tool
      const getResult = await helper.callGetScratchpad({ id: scratchpadId });
      expect(getResult).not.toHaveProperty('error');
      expect(getResult.scratchpad.content).toContain('Inserted via enhanced tool');
    });

    it('should maintain database consistency', async () => {
      const initialGet = await helper.callGetScratchpad({ id: scratchpadId });
      expect(initialGet).not.toHaveProperty('error');
      const initialSize = initialGet.scratchpad.size_bytes;

      // Perform multiple updates
      await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'append_section',
        content: 'Added content 1',
        section_marker: 'Line 3', // Use existing content as marker
      });

      await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'insert_at_line',
        content: 'Added content 2',
        line_number: 1,
      });

      const finalGet = await helper.callGetScratchpad({ id: scratchpadId });
      expect(finalGet).not.toHaveProperty('error');
      expect(finalGet.scratchpad.size_bytes).toBeGreaterThan(initialSize);
      expect(finalGet.scratchpad.content).toContain('Added content 1');
      expect(finalGet.scratchpad.content).toContain('Added content 2');
    });
  });

  describe('Performance and Limits', () => {
    it('should handle large content updates efficiently', async () => {
      const largeContent = 'Large line content '.repeat(1000); // ~20KB content

      const startTime = Date.now();
      const result = await helper.callEnhancedUpdate({
        id: scratchpadId,
        mode: 'replace',
        content: largeContent,
      });
      const endTime = Date.now();

      expect(result).not.toHaveProperty('error');
      expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
      expect(result.operation_details.size_change_bytes).toBeGreaterThan(18000);
    });

    it('should handle many small updates efficiently', async () => {
      const startTime = Date.now();

      // Perform 10 small updates
      for (let i = 0; i < 10; i++) {
        const result = await helper.callEnhancedUpdate({
          id: scratchpadId,
          mode: 'insert_at_line',
          content: `Update ${i + 1}`,
          line_number: i + 1,
        });
        expect(result).not.toHaveProperty('error');
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(500); // 10 updates in <500ms
    });
  });
});