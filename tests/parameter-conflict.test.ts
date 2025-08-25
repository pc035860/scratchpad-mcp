/**
 * Test parameter conflict detection and smart defaults
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScratchpadDatabase } from '../src/database/index.js';
import { getScratchpadTool, listScratchpadsTool } from '../src/tools/scratchpad.js';
import { searchScratchpadsTool } from '../src/tools/search.js';

describe('Parameter Conflict Detection and Smart Defaults', () => {
  let db: ScratchpadDatabase;
  let testWorkflowId: string;
  let testScratchpadId: string;

  beforeEach(async () => {
    db = new ScratchpadDatabase(':memory:');
    
    // Create test workflow
    const workflow = db.createWorkflow({
      name: 'Test Parameter Conflict Workflow',
      description: 'Testing parameter conflict detection',
    });
    testWorkflowId = workflow.id;

    // Create test scratchpad with substantial content
    const scratchpad = db.createScratchpad({
      workflow_id: testWorkflowId,
      title: 'Test Conflict Scratchpad',
      content: 'This is a long test content that will be used to test parameter conflicts and smart defaults. '.repeat(20), // ~1400+ chars
    });
    testScratchpadId = scratchpad.id;
  });

  afterEach(() => {
    db.close();
  });

  describe('Parameter Conflict Detection', () => {
    it('should detect and warn when include_content=false conflicts with max_content_chars', async () => {
      const getScratchpad = getScratchpadTool(db);
      
      const result = await getScratchpad({
        id: testScratchpadId,
        include_content: false,
        max_content_chars: 500,
      });

      expect(result.scratchpad).toBeTruthy();
      expect(result.scratchpad!.content).toBe(''); // Content should be empty
      expect(result.scratchpad!.parameter_warning).toBeDefined();
      expect(result.scratchpad!.parameter_warning).toContain('Parameter conflict');
      expect(result.scratchpad!.parameter_warning).toContain('max_content_chars (500) ignored');
      expect(result.message).toContain('WARNING');
    });

    it('should detect conflicts in list operations', async () => {
      const listScratchpads = listScratchpadsTool(db);
      
      const result = await listScratchpads({
        workflow_id: testWorkflowId,
        include_content: false,
        max_content_chars: 300,
      });

      expect(result.scratchpads).toHaveLength(1);
      expect(result.scratchpads[0].content).toBe('');
      expect(result.scratchpads[0].parameter_warning).toBeDefined();
      expect(result.message).toContain('parameter conflicts');
    });

    it('should detect conflicts in search operations', async () => {
      const searchScratchpads = searchScratchpadsTool(db);
      
      const result = await searchScratchpads({
        query: 'test',
        workflow_id: testWorkflowId,
        include_content: false,
        max_content_chars: 200,
      });

      expect(result.results.length).toBeGreaterThan(0);
      const firstResult = result.results[0];
      expect(firstResult.scratchpad.content).toBe('');
      expect(firstResult.scratchpad.parameter_warning).toBeDefined();
      expect(result.message).toContain('parameter conflicts');
    });
  });

  describe('Smart Default Logic', () => {
    it('should auto-set include_content=true when max_content_chars is specified', async () => {
      const getScratchpad = getScratchpadTool(db);
      
      // Don't specify include_content, but do specify max_content_chars
      const result = await getScratchpad({
        id: testScratchpadId,
        max_content_chars: 100,
        // include_content is undefined - should default to true
      });

      expect(result.scratchpad).toBeTruthy();
      expect(result.scratchpad!.content).toBeTruthy(); // Should have content
      expect(result.scratchpad!.content).toHaveLength(107); // 100 chars + '...（截斷）'
      expect(result.scratchpad!.content_truncated).toBe(true);
      expect(result.scratchpad!.content_control_applied).toContain('truncated to 100 chars');
      expect(result.message).toContain('Content control: truncated to 100 chars');
    });

    it('should respect explicit include_content=true with max_content_chars', async () => {
      const getScratchpad = getScratchpadTool(db);
      
      const result = await getScratchpad({
        id: testScratchpadId,
        include_content: true,
        max_content_chars: 200,
      });

      expect(result.scratchpad).toBeTruthy();
      expect(result.scratchpad!.content).toBeTruthy();
      expect(result.scratchpad!.content_truncated).toBe(true);
      expect(result.scratchpad!.content_control_applied).toContain('truncated to 200 chars');
      expect(result.scratchpad!.parameter_warning).toBeUndefined(); // No conflict
    });
  });

  describe('Preview Mode Priority', () => {
    it('should prioritize preview_mode over max_content_chars', async () => {
      const getScratchpad = getScratchpadTool(db);
      
      const result = await getScratchpad({
        id: testScratchpadId,
        preview_mode: true,
        max_content_chars: 50, // This should be used as the preview length
      });

      expect(result.scratchpad).toBeTruthy();
      expect(result.scratchpad!.content).toBeTruthy();
      expect(result.scratchpad!.preview_summary).toBeDefined();
      expect(result.scratchpad!.content_control_applied).toContain('preview_mode with 50 chars');
      expect(result.scratchpad!.parameter_warning).toBeUndefined(); // No conflict
    });

    it('should use default preview length when max_content_chars not specified', async () => {
      const getScratchpad = getScratchpadTool(db);
      
      const result = await getScratchpad({
        id: testScratchpadId,
        preview_mode: true,
        // max_content_chars not specified - should use default 500
      });

      expect(result.scratchpad).toBeTruthy();
      expect(result.scratchpad!.content_control_applied).toContain('preview_mode with 500 chars');
    });
  });

  describe('Content Control Status Messages', () => {
    it('should provide clear status messages for truncation', async () => {
      const getScratchpad = getScratchpadTool(db);
      
      const result = await getScratchpad({
        id: testScratchpadId,
        max_content_chars: 300,
      });

      expect(result.message).toBeDefined();
      expect(result.message).toContain('Content control: truncated to 300 chars');
      expect(result.scratchpad!.content_control_applied).toBe('truncated to 300 chars');
    });

    it('should provide clear status messages for preview mode', async () => {
      const getScratchpad = getScratchpadTool(db);
      
      const result = await getScratchpad({
        id: testScratchpadId,
        preview_mode: true,
        max_content_chars: 150,
      });

      expect(result.message).toContain('Content control: preview_mode with 150 chars');
      expect(result.scratchpad!.content_control_applied).toBe('preview_mode with 150 chars');
    });

    it('should not show control messages when no control is applied', async () => {
      // Create a small scratchpad that won't be truncated
      const smallScratchpad = db.createScratchpad({
        workflow_id: testWorkflowId,
        title: 'Small Scratchpad',
        content: 'Small content',
      });

      const getScratchpad = getScratchpadTool(db);
      
      const result = await getScratchpad({
        id: smallScratchpad.id,
        max_content_chars: 1000, // Much larger than content
      });

      expect(result.message).not.toContain('Content control');
      expect(result.scratchpad!.content_control_applied).toBeUndefined();
      expect(result.scratchpad!.content_truncated).toBeUndefined();
    });
  });
});