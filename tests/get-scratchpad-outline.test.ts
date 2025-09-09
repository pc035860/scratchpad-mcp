/**
 * Get Scratchpad Outline Tool Tests
 *
 * Tests the get-scratchpad-outline tool functionality including:
 * - Markdown header parsing and line number detection
 * - Parameter validation and control options
 * - Edge cases and error handling
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScratchpadDatabase } from '../src/database/index.js';
import {
  createWorkflowTool,
  createScratchpadTool,
  getScratchpadOutlineTool,
  type CreateWorkflowArgs,
  type CreateScratchpadArgs,
  type GetScratchpadOutlineArgs,
} from '../src/tools/index.js';

/**
 * Test helper class for get-scratchpad-outline tool
 */
class OutlineTestHelper {
  private db: ScratchpadDatabase;
  private createWorkflow: ReturnType<typeof createWorkflowTool>;
  private createScratchpad: ReturnType<typeof createScratchpadTool>;
  private getScratchpadOutline: ReturnType<typeof getScratchpadOutlineTool>;

  constructor() {
    this.db = new ScratchpadDatabase({ filename: ':memory:' });
    this.createWorkflow = createWorkflowTool(this.db);
    this.createScratchpad = createScratchpadTool(this.db);
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

  async callGetScratchpadOutline(args: GetScratchpadOutlineArgs) {
    try {
      return await this.getScratchpadOutline(args);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

describe('Get Scratchpad Outline Tool Tests', () => {
  let helper: OutlineTestHelper;
  let workflowId: string;

  beforeEach(async () => {
    helper = new OutlineTestHelper();
    
    // Create test workflow
    const workflowResult = await helper.callCreateWorkflow({
      name: 'Test Workflow for Outline',
      description: 'Testing get-scratchpad-outline functionality',
    });
    expect(workflowResult).not.toHaveProperty('error');
    workflowId = workflowResult.workflow.id;
  });

  afterEach(async () => {
    helper.getDatabase().close();
  });

  describe('Basic Header Parsing', () => {
    it('should parse simple markdown headers with line numbers', async () => {
      const content = `# Main Title
This is some content.

## Section 1
Some section content here.

### Subsection 1.1
More detailed content.

## Section 2
Another section.`;

      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Simple Headers Test',
        content,
      });
      expect(createResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpadOutline({
        id: createResult.scratchpad.id,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.outline.headers).toHaveLength(4);
      
      expect(result.outline.headers[0]).toEqual({
        level: 1,
        text: 'Main Title',
        line: 1,
      });
      
      expect(result.outline.headers[1]).toEqual({
        level: 2,
        text: 'Section 1',
        line: 4,
      });
      
      expect(result.outline.headers[2]).toEqual({
        level: 3,
        text: 'Subsection 1.1',
        line: 7,
      });
      
      expect(result.outline.headers[3]).toEqual({
        level: 2,
        text: 'Section 2',
        line: 10,
      });

      expect(result.outline.total_headers).toBe(4);
      expect(result.outline.max_depth_found).toBe(3);
    });

    it('should handle all header levels (1-6)', async () => {
      const content = `# Level 1
## Level 2
### Level 3
#### Level 4
##### Level 5
###### Level 6
####### This should not be parsed as header`;

      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'All Header Levels Test',
        content,
      });
      expect(createResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpadOutline({
        id: createResult.scratchpad.id,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.outline.headers).toHaveLength(6);
      
      expect(result.outline.headers[0].level).toBe(1);
      expect(result.outline.headers[1].level).toBe(2);
      expect(result.outline.headers[2].level).toBe(3);
      expect(result.outline.headers[3].level).toBe(4);
      expect(result.outline.headers[4].level).toBe(5);
      expect(result.outline.headers[5].level).toBe(6);
      
      expect(result.outline.max_depth_found).toBe(6);
    });

    it('should handle headers with special characters and emojis', async () => {
      const content = `# 🎯 Main Title with 中文
## Section with "quotes" and symbols!@#$%
### 測試中文標題
#### Section with &lt;HTML&gt; entities`;

      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Special Characters Test',
        content,
      });
      expect(createResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpadOutline({
        id: createResult.scratchpad.id,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.outline.headers).toHaveLength(4);
      
      expect(result.outline.headers[0].text).toBe('🎯 Main Title with 中文');
      expect(result.outline.headers[1].text).toBe('Section with "quotes" and symbols!@#$%');
      expect(result.outline.headers[2].text).toBe('測試中文標題');
      expect(result.outline.headers[3].text).toBe('Section with &lt;HTML&gt; entities');
    });
  });

  describe('Parameter Control Options', () => {
    let scratchpadId: string;
    
    beforeEach(async () => {
      const content = `# Main Title
Some introductory content here.
This spans multiple lines.

## Section 1
Section content with details.
More information here.

### Subsection 1.1
Detailed subsection content.

#### Deep Subsection
Very deep content.

##### Deeper Section
Even deeper.

###### Deepest Section
Maximum depth content.`;

      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Parameter Control Test',
        content,
      });
      expect(createResult).not.toHaveProperty('error');
      scratchpadId = createResult.scratchpad.id;
    });

    it('should respect max_depth parameter', async () => {
      const result = await helper.callGetScratchpadOutline({
        id: scratchpadId,
        max_depth: 3,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.outline.headers).toHaveLength(3);
      
      expect(result.outline.headers.every(h => h.level <= 3)).toBe(true);
      expect(result.outline.max_depth_found).toBe(3);
    });

    it('should handle max_depth = 1 (only main titles)', async () => {
      const result = await helper.callGetScratchpadOutline({
        id: scratchpadId,
        max_depth: 1,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.outline.headers).toHaveLength(1);
      expect(result.outline.headers[0].level).toBe(1);
      expect(result.outline.headers[0].text).toBe('Main Title');
      expect(result.outline.max_depth_found).toBe(1);
    });

    it('should include content preview when requested', async () => {
      const result = await helper.callGetScratchpadOutline({
        id: scratchpadId,
        include_content_preview: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.outline.headers[0]).toHaveProperty('content_preview');
      expect(result.outline.headers[1]).toHaveProperty('content_preview');
      
      expect(result.outline.headers[0].content_preview).toContain('Some introductory');
      expect(result.outline.headers[1].content_preview).toContain('Section content');
    });

    it('should not include content preview by default', async () => {
      const result = await helper.callGetScratchpadOutline({
        id: scratchpadId,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.outline.headers[0]).not.toHaveProperty('content_preview');
      expect(result.outline.headers[1]).not.toHaveProperty('content_preview');
    });

    it('should handle include_line_numbers parameter', async () => {
      // Test with include_line_numbers: true (default)
      const resultWithLines = await helper.callGetScratchpadOutline({
        id: scratchpadId,
        include_line_numbers: true,
      });

      expect(resultWithLines).not.toHaveProperty('error');
      expect(resultWithLines.message).toContain('with line numbers');

      // Test with include_line_numbers: false
      const resultWithoutLines = await helper.callGetScratchpadOutline({
        id: scratchpadId,
        include_line_numbers: false,
      });

      expect(resultWithoutLines).not.toHaveProperty('error');
      expect(resultWithoutLines.message).not.toContain('with line numbers');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty content', async () => {
      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Empty Content Test',
        content: '',
      });
      expect(createResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpadOutline({
        id: createResult.scratchpad.id,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.outline.headers).toHaveLength(0);
      expect(result.outline.total_headers).toBe(0);
      expect(result.outline.max_depth_found).toBe(0);
    });

    it('should handle content with no headers', async () => {
      const content = `This is just regular content.
No headers here at all.
Just plain text content.
Multiple paragraphs.`;

      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'No Headers Test',
        content,
      });
      expect(createResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpadOutline({
        id: createResult.scratchpad.id,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.outline.headers).toHaveLength(0);
      expect(result.outline.total_headers).toBe(0);
      expect(result.outline.max_depth_found).toBe(0);
    });

    it('should handle headers at the very end of content', async () => {
      const content = `Some content here.
More content.
# Header at the end`;

      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Header At End Test',
        content,
      });
      expect(createResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpadOutline({
        id: createResult.scratchpad.id,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.outline.headers).toHaveLength(1);
      expect(result.outline.headers[0]).toEqual({
        level: 1,
        text: 'Header at the end',
        line: 3,
      });
    });

    it('should handle headers with whitespace content', async () => {
      const content = `# Header with space
## Whitespace Title
### Another header
#### Normal Title`;

      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Whitespace Headers Test',
        content,
      });
      expect(createResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpadOutline({
        id: createResult.scratchpad.id,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.outline.headers).toHaveLength(4);
      
      // Check that all headers are found correctly
      expect(result.outline.headers[0].text).toBe('Header with space');
      expect(result.outline.headers[1].text).toBe('Whitespace Title');
      expect(result.outline.headers[2].text).toBe('Another header');
      expect(result.outline.headers[3].text).toBe('Normal Title');
    });

    it('should handle mixed line endings (CRLF and LF)', async () => {
      const content = `# Title 1\r\nSome content\n## Title 2\r\nMore content\n### Title 3`;

      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Mixed Line Endings Test',
        content,
      });
      expect(createResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpadOutline({
        id: createResult.scratchpad.id,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.outline.headers).toHaveLength(3);
      expect(result.outline.headers[0].line).toBe(1);
      expect(result.outline.headers[1].line).toBe(3);
      expect(result.outline.headers[2].line).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent scratchpad', async () => {
      const result = await helper.callGetScratchpadOutline({
        id: 'non-existent-id',
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Scratchpad not found');
    });

    it('should handle invalid max_depth values gracefully', async () => {
      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Test',
        content: '# Title',
      });
      expect(createResult).not.toHaveProperty('error');

      // Note: Direct tool calls bypass server validation, so these won't error
      // but would be caught by server-helpers.ts in actual MCP usage
      const result1 = await helper.callGetScratchpadOutline({
        id: createResult.scratchpad.id,
        max_depth: 0,
      } as any);
      expect(result1).not.toHaveProperty('error');

      const result2 = await helper.callGetScratchpadOutline({
        id: createResult.scratchpad.id,
        max_depth: 7,
      } as any);
      expect(result2).not.toHaveProperty('error');
    });
  });

  describe('Response Format Validation', () => {
    it('should return proper response structure', async () => {
      const content = `# Main
## Sub`;

      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Response Format Test',
        content,
      });
      expect(createResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpadOutline({
        id: createResult.scratchpad.id,
      });

      expect(result).not.toHaveProperty('error');
      expect(result).toHaveProperty('outline');
      expect(result).toHaveProperty('message');

      expect(result.outline).toHaveProperty('id');
      expect(result.outline).toHaveProperty('workflow_id');
      expect(result.outline).toHaveProperty('title');
      expect(result.outline).toHaveProperty('headers');
      expect(result.outline).toHaveProperty('total_headers');
      expect(result.outline).toHaveProperty('max_depth_found');

      expect(result.outline.id).toBe(createResult.scratchpad.id);
      expect(result.outline.workflow_id).toBe(workflowId);
      expect(result.outline.title).toBe('Response Format Test');
      expect(Array.isArray(result.outline.headers)).toBe(true);
      expect(typeof result.outline.total_headers).toBe('number');
      expect(typeof result.outline.max_depth_found).toBe('number');
      expect(typeof result.message).toBe('string');
    });

    it('should have consistent header object structure', async () => {
      const content = `# Test Header
Some content below the header.`;

      const createResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Header Structure Test',
        content,
      });
      expect(createResult).not.toHaveProperty('error');

      const result = await helper.callGetScratchpadOutline({
        id: createResult.scratchpad.id,
        include_content_preview: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.outline.headers).toHaveLength(1);

      const header = result.outline.headers[0];
      expect(typeof header.level).toBe('number');
      expect(typeof header.text).toBe('string');
      expect(typeof header.line).toBe('number');
      expect(header).toHaveProperty('content_preview');
      expect(typeof header.content_preview).toBe('string');
    });
  });
});