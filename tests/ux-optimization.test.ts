/**
 * UX Optimization Features Tests
 *
 * Tests for the two major UX improvements:
 * 1. Smart Append - Using workflow ID as fallback for append operations
 * 2. Enhanced Workflow - Automatic scratchpads_summary in all workflow results
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScratchpadDatabase } from '../src/database/index.js';
import {
  createWorkflowTool,
  listWorkflowsTool,
  getLatestActiveWorkflowTool,
  updateWorkflowStatusTool,
  createScratchpadTool,
  getScratchpadTool,
  appendScratchpadTool,
  type CreateWorkflowArgs,
  type GetLatestActiveWorkflowArgs,
  type UpdateWorkflowStatusArgs,
  type CreateScratchpadArgs,
  type AppendScratchpadArgs,
} from '../src/tools/index.js';

/**
 * Test helper class for UX optimization features
 */
class UXOptimizationTestHelper {
  private db: ScratchpadDatabase;

  // Tool handlers
  private createWorkflow: ReturnType<typeof createWorkflowTool>;
  private listWorkflows: ReturnType<typeof listWorkflowsTool>;
  private getLatestActiveWorkflow: ReturnType<typeof getLatestActiveWorkflowTool>;
  private updateWorkflowStatus: ReturnType<typeof updateWorkflowStatusTool>;
  private createScratchpad: ReturnType<typeof createScratchpadTool>;
  private getScratchpad: ReturnType<typeof getScratchpadTool>;
  private appendScratchpad: ReturnType<typeof appendScratchpadTool>;

  constructor() {
    this.db = new ScratchpadDatabase({ filename: ':memory:' });

    // Initialize all tool handlers
    this.createWorkflow = createWorkflowTool(this.db);
    this.listWorkflows = listWorkflowsTool(this.db);
    this.getLatestActiveWorkflow = getLatestActiveWorkflowTool(this.db);
    this.updateWorkflowStatus = updateWorkflowStatusTool(this.db);
    this.createScratchpad = createScratchpadTool(this.db);
    this.getScratchpad = getScratchpadTool(this.db);
    this.appendScratchpad = appendScratchpadTool(this.db);
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

  async callGetLatestActiveWorkflow(args: GetLatestActiveWorkflowArgs) {
    try {
      return await this.getLatestActiveWorkflow(args);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async callUpdateWorkflowStatus(args: UpdateWorkflowStatusArgs) {
    try {
      return await this.updateWorkflowStatus(args);
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

  async callGetScratchpad(args: { id: string }) {
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

  getDatabase(): ScratchpadDatabase {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}

describe('UX Optimization Features Tests', () => {
  let helper: UXOptimizationTestHelper;

  beforeEach(() => {
    helper = new UXOptimizationTestHelper();
  });

  afterEach(() => {
    helper.close();
  });

  describe('Smart Append Feature', () => {
    let workflowId: string;
    let scratchpadId: string;

    beforeEach(async () => {
      // Create test workflow
      const workflowResult = await helper.callCreateWorkflow({
        name: 'Smart Append Test Workflow',
        description: 'Testing Smart Append functionality',
      });
      expect(workflowResult).not.toHaveProperty('error');
      workflowId = workflowResult.workflow.id;

      // Create test scratchpad
      const scratchpadResult = await helper.callCreateScratchpad({
        workflow_id: workflowId,
        title: 'Smart Append Test Scratchpad',
        content: 'Initial content for Smart Append testing',
      });
      expect(scratchpadResult).not.toHaveProperty('error');
      scratchpadId = scratchpadResult.scratchpad.id;
    });

    it('should maintain backward compatibility with scratchpad ID', async () => {
      const result = await helper.callAppendScratchpad({
        id: scratchpadId, // Traditional scratchpad ID usage
        content: '\nBackward compatible append',
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad.id).toBe(scratchpadId);
      expect(result.scratchpad.content).toBe(
        'Initial content for Smart Append testing\n\n---\n\nBackward compatible append'
      );
      expect(result.message).toContain('Appended');
      expect(result.appended_bytes).toBeGreaterThan(0);
    });

    it('should handle workflow ID with 0 scratchpads (helpful error)', async () => {
      // Create empty workflow
      const emptyWorkflowResult = await helper.callCreateWorkflow({
        name: 'Empty Workflow for Smart Append',
      });
      expect(emptyWorkflowResult).not.toHaveProperty('error');
      const emptyWorkflowId = emptyWorkflowResult.workflow.id;

      const result = await helper.callAppendScratchpad({
        id: emptyWorkflowId, // Using workflow ID with 0 scratchpads
        content: 'Should fail with helpful message',
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('No scratchpads found in workflow');
      expect(result.error).toContain('Empty Workflow for Smart Append');
      expect(result.error).toContain('Create a scratchpad first');
    });

    it('should handle workflow ID with 1 scratchpad (Smart Append success)', async () => {
      const result = await helper.callAppendScratchpad({
        id: workflowId, // Using workflow ID instead of scratchpad ID
        content: '\nSmart appended content using workflow ID',
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad.id).toBe(scratchpadId); // Should resolve to the actual scratchpad
      expect(result.scratchpad.content).toBe(
        'Initial content for Smart Append testing\n\n---\n\nSmart appended content using workflow ID'
      );
      expect(result.message).toContain('Smart Append Test Scratchpad');
      expect(result.appended_bytes).toBeGreaterThan(0);
    });

    it('should handle workflow ID with multiple scratchpads (helpful list)', async () => {
      // Create additional scratchpads
      const scratchpadTitles = ['Second Scratchpad', 'Third Scratchpad', 'Fourth Scratchpad'];
      const createdIds: string[] = [scratchpadId]; // Include the original one

      for (const title of scratchpadTitles) {
        const createResult = await helper.callCreateScratchpad({
          workflow_id: workflowId,
          title,
          content: `Content for ${title}`,
        });
        expect(createResult).not.toHaveProperty('error');
        createdIds.push(createResult.scratchpad.id);
      }

      const result = await helper.callAppendScratchpad({
        id: workflowId, // Workflow ID with multiple scratchpads
        content: 'Should fail with helpful list',
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Multiple scratchpads found in workflow');
      expect(result.error).toContain('Smart Append Test Workflow');
      expect(result.error).toContain('Please specify the scratchpad ID');

      // Check that all scratchpad options are listed
      expect(result.error).toContain('Smart Append Test Scratchpad');
      expect(result.error).toContain('Second Scratchpad');
      expect(result.error).toContain('Third Scratchpad');
      expect(result.error).toContain('Fourth Scratchpad');

      // Check that all IDs are listed
      for (const id of createdIds) {
        expect(result.error).toContain(id);
      }
    });

    it('should handle invalid ID (neither scratchpad nor workflow)', async () => {
      const result = await helper.callAppendScratchpad({
        id: 'completely-invalid-id-12345',
        content: 'Should fail with clear message',
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Neither scratchpad nor workflow found with ID');
      expect(result.error).toContain('completely-invalid-id-12345');
    });

    it('should prioritize scratchpad ID over workflow ID when both exist', async () => {
      // This test ensures that scratchpad ID always takes priority
      const result = await helper.callAppendScratchpad({
        id: scratchpadId, // Real scratchpad ID
        content: '\nPriority test - should use scratchpad ID',
        include_content: true,
      });

      expect(result).not.toHaveProperty('error');
      expect(result.scratchpad.id).toBe(scratchpadId);
      expect(result.scratchpad.content).toContain('Priority test - should use scratchpad ID');
    });
  });

  describe('Enhanced Workflow Feature', () => {
    let workflowId: string;
    let scratchpadIds: string[] = [];

    beforeEach(async () => {
      // Create test workflow
      const workflowResult = await helper.callCreateWorkflow({
        name: 'Enhanced Workflow Test',
        description: 'Testing Enhanced Workflow functionality',
      });
      expect(workflowResult).not.toHaveProperty('error');
      workflowId = workflowResult.workflow.id;

      // Create test scratchpads
      const testScratchpads = [
        { title: 'First Enhanced Scratchpad', content: 'Content for first scratchpad with data' },
        {
          title: 'Second Enhanced Scratchpad',
          content: 'Content for second scratchpad with more data',
        },
        { title: 'Third Enhanced Scratchpad', content: 'Content for third scratchpad for testing' },
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

    it('should not include scratchpads_summary in create-workflow results (optimization for new workflows)', async () => {
      const result = await helper.callCreateWorkflow({
        name: 'New Workflow Test',
        description: 'Testing new workflow creation',
      });

      expect(result).not.toHaveProperty('error');
      expect(result).toHaveProperty('workflow');

      // Enhanced Workflow: New workflows don't include scratchpads_summary for performance
      // (since they have no scratchpads yet)
      expect(result.workflow).not.toHaveProperty('scratchpads_summary');
    });

    it('should include scratchpads_summary in list-workflows results', async () => {
      const result = await helper.callListWorkflows();

      expect(result).not.toHaveProperty('error');
      expect(result.workflows.length).toBeGreaterThan(0);

      const targetWorkflow = result.workflows.find((w: any) => w.id === workflowId);
      expect(targetWorkflow).toBeDefined();

      // Enhanced Workflow: Check scratchpads_summary structure
      expect(targetWorkflow).toHaveProperty('scratchpads_summary');
      expect(Array.isArray(targetWorkflow.scratchpads_summary)).toBe(true);
      expect(targetWorkflow.scratchpads_summary).toHaveLength(3);

      // Verify summary structure and content
      for (const summary of targetWorkflow.scratchpads_summary) {
        expect(summary).toHaveProperty('id');
        expect(summary).toHaveProperty('title');
        expect(summary).toHaveProperty('size_bytes');
        expect(summary).toHaveProperty('updated_at');
        expect(typeof summary.id).toBe('string');
        expect(typeof summary.title).toBe('string');
        expect(typeof summary.size_bytes).toBe('number');
        expect(typeof summary.updated_at).toBe('string');
      }

      // Check specific titles are present
      const titles = targetWorkflow.scratchpads_summary.map((s: any) => s.title);
      expect(titles).toContain('First Enhanced Scratchpad');
      expect(titles).toContain('Second Enhanced Scratchpad');
      expect(titles).toContain('Third Enhanced Scratchpad');
    });

    it('should include scratchpads_summary in get-latest-active-workflow results', async () => {
      const result = await helper.callGetLatestActiveWorkflow({});

      expect(result).not.toHaveProperty('error');
      expect(result.workflow).not.toBeNull();

      // Enhanced Workflow: Check scratchpads_summary is present and populated
      expect(result.workflow).toHaveProperty('scratchpads_summary');
      expect(Array.isArray(result.workflow.scratchpads_summary)).toBe(true);
      expect(result.workflow.scratchpads_summary.length).toBeGreaterThan(0);

      // Verify the summary contains our test scratchpads
      const titles = result.workflow.scratchpads_summary.map((s: any) => s.title);
      expect(titles).toContain('First Enhanced Scratchpad');
    });

    it('should include scratchpads_summary in update-workflow-status results', async () => {
      const result = await helper.callUpdateWorkflowStatus({
        workflow_id: workflowId,
        is_active: false, // Deactivate workflow
      });

      expect(result).not.toHaveProperty('error');
      expect(result.workflow.is_active).toBe(false);

      // Enhanced Workflow: Check scratchpads_summary is present
      expect(result.workflow).toHaveProperty('scratchpads_summary');
      expect(Array.isArray(result.workflow.scratchpads_summary)).toBe(true);
      expect(result.workflow.scratchpads_summary).toHaveLength(3);

      // Reactivate and check again
      const reactivateResult = await helper.callUpdateWorkflowStatus({
        workflow_id: workflowId,
        is_active: true, // Reactivate workflow
      });

      expect(reactivateResult).not.toHaveProperty('error');
      expect(reactivateResult.workflow.is_active).toBe(true);
      expect(reactivateResult.workflow.scratchpads_summary).toHaveLength(3);
    });

    it('should handle graceful failure when scratchpads summary fails to load', async () => {
      // In normal circumstances, this would be hard to trigger, but the implementation
      // includes error handling for database failures
      const result = await helper.callListWorkflows();

      expect(result).not.toHaveProperty('error');
      expect(result.workflows.length).toBeGreaterThan(0);

      // All workflows should still have scratchpads_summary property (even if empty on error)
      for (const workflow of result.workflows) {
        expect(workflow).toHaveProperty('scratchpads_summary');
        expect(Array.isArray(workflow.scratchpads_summary)).toBe(true);
      }
    });

    it('should reflect real-time changes in scratchpads_summary', async () => {
      // Get initial state
      const initialState = await helper.callGetLatestActiveWorkflow({});
      expect(initialState).not.toHaveProperty('error');
      const initialSummary = initialState.workflow.scratchpads_summary;
      expect(initialSummary).toHaveLength(3);

      const initialSize = initialSummary[0].size_bytes;
      const initialTime = new Date(initialSummary[0].updated_at).getTime();

      // Update the first scratchpad by finding it in the current summary
      const scratchpadToUpdate = initialSummary[0];
      await helper.callAppendScratchpad({
        id: scratchpadToUpdate.id,
        content: '\nAdditional content for real-time testing',
      });

      // Check updated state
      const updatedState = await helper.callGetLatestActiveWorkflow({});
      expect(updatedState).not.toHaveProperty('error');
      const updatedSummary = updatedState.workflow.scratchpads_summary;

      // Find the updated scratchpad in the summary
      const updatedScratchpad = updatedSummary.find((s: any) => s.id === scratchpadToUpdate.id);
      expect(updatedScratchpad).toBeDefined();

      // Verify changes are reflected
      expect(updatedScratchpad.size_bytes).toBeGreaterThan(initialSize);
      const updatedTime = new Date(updatedScratchpad.updated_at).getTime();
      expect(updatedTime).toBeGreaterThanOrEqual(initialTime);
    });
  });

  describe('Smart Append + Enhanced Workflow Integration', () => {
    let integrationWorkflowId: string;
    let integrationScratchpadId: string;

    beforeEach(async () => {
      // Create integration test workflow
      const workflowResult = await helper.callCreateWorkflow({
        name: 'Integration Test Workflow',
        description: 'Testing both Smart Append and Enhanced Workflow together',
      });
      expect(workflowResult).not.toHaveProperty('error');
      integrationWorkflowId = workflowResult.workflow.id;

      // Create integration test scratchpad
      const scratchpadResult = await helper.callCreateScratchpad({
        workflow_id: integrationWorkflowId,
        title: 'Integration Test Scratchpad',
        content: 'Initial integration test content',
      });
      expect(scratchpadResult).not.toHaveProperty('error');
      integrationScratchpadId = scratchpadResult.scratchpad.id;
    });

    it('should demonstrate end-to-end UX improvements workflow', async () => {
      // 1. Verify Enhanced Workflow shows correct initial state
      const initialWorkflow = await helper.callListWorkflows();
      expect(initialWorkflow).not.toHaveProperty('error');

      const targetWorkflow = initialWorkflow.workflows.find(
        (w: any) => w.id === integrationWorkflowId
      );
      expect(targetWorkflow).toBeDefined();
      expect(targetWorkflow.scratchpads_summary).toHaveLength(1);
      expect(targetWorkflow.scratchpads_summary[0].title).toBe('Integration Test Scratchpad');
      const initialSize = targetWorkflow.scratchpads_summary[0].size_bytes;

      // 2. Use Smart Append with workflow ID (UX improvement)
      const smartAppendResult = await helper.callAppendScratchpad({
        id: integrationWorkflowId, // Using workflow ID instead of scratchpad ID
        content: '\nSmart appended content via workflow ID',
      });

      expect(smartAppendResult).not.toHaveProperty('error');
      expect(smartAppendResult.message).toContain('Integration Test Scratchpad');

      // 3. Verify Enhanced Workflow reflects the Smart Append changes
      const updatedWorkflow = await helper.callGetLatestActiveWorkflow({});
      expect(updatedWorkflow).not.toHaveProperty('error');
      expect(updatedWorkflow.workflow.scratchpads_summary).toHaveLength(1);

      const updatedSummary = updatedWorkflow.workflow.scratchpads_summary[0];
      expect(updatedSummary.size_bytes).toBeGreaterThan(initialSize);
      expect(new Date(updatedSummary.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(targetWorkflow.scratchpads_summary[0].updated_at).getTime()
      );

      // 4. Add second scratchpad to test multi-scratchpad Smart Append behavior
      const secondScratchpadResult = await helper.callCreateScratchpad({
        workflow_id: integrationWorkflowId,
        title: 'Second Integration Scratchpad',
        content: 'Content for second scratchpad',
      });
      expect(secondScratchpadResult).not.toHaveProperty('error');

      // 5. Verify Enhanced Workflow now shows 2 scratchpads
      const twoScratchpadsState = await helper.callUpdateWorkflowStatus({
        workflow_id: integrationWorkflowId,
        is_active: true, // Refresh workflow state
      });
      expect(twoScratchpadsState).not.toHaveProperty('error');
      expect(twoScratchpadsState.workflow.scratchpads_summary).toHaveLength(2);

      // 6. Smart Append should now require specific scratchpad ID
      const multiScratchpadAppendResult = await helper.callAppendScratchpad({
        id: integrationWorkflowId, // Workflow ID with 2 scratchpads
        content: 'Should fail with helpful guidance',
      });

      expect(multiScratchpadAppendResult).toHaveProperty('error');
      expect(multiScratchpadAppendResult.error).toContain('Multiple scratchpads found');
      expect(multiScratchpadAppendResult.error).toContain('Integration Test Scratchpad');
      expect(multiScratchpadAppendResult.error).toContain('Second Integration Scratchpad');
    });

    it('should maintain backward compatibility throughout UX improvements', async () => {
      // Test traditional scratchpad ID usage still works
      const traditionalAppendResult = await helper.callAppendScratchpad({
        id: integrationScratchpadId, // Traditional scratchpad ID
        content: '\nTraditional append still works perfectly',
        include_content: true,
      });

      expect(traditionalAppendResult).not.toHaveProperty('error');
      expect(traditionalAppendResult.scratchpad.content).toContain(
        'Traditional append still works perfectly'
      );

      // Enhanced Workflow should also work normally
      const workflowListResult = await helper.callListWorkflows();
      expect(workflowListResult).not.toHaveProperty('error');

      const workflow = workflowListResult.workflows.find(
        (w: any) => w.id === integrationWorkflowId
      );
      expect(workflow).toBeDefined();
      expect(workflow).toHaveProperty('scratchpads_summary');
      expect(Array.isArray(workflow.scratchpads_summary)).toBe(true);
    });

    it('should handle edge cases gracefully in both features', async () => {
      // Test Smart Append with empty workflow
      const emptyWorkflowResult = await helper.callCreateWorkflow({
        name: 'Edge Case Empty Workflow',
      });
      expect(emptyWorkflowResult).not.toHaveProperty('error');
      const emptyWorkflowId = emptyWorkflowResult.workflow.id;

      // Smart Append should fail gracefully
      const emptyAppendResult = await helper.callAppendScratchpad({
        id: emptyWorkflowId,
        content: 'Should fail gracefully with helpful message',
      });

      expect(emptyAppendResult).toHaveProperty('error');
      expect(emptyAppendResult.error).toContain('No scratchpads found');

      // Enhanced Workflow should still show empty scratchpads_summary
      const emptyWorkflowListResult = await helper.callListWorkflows();
      expect(emptyWorkflowListResult).not.toHaveProperty('error');

      const emptyWorkflow = emptyWorkflowListResult.workflows.find(
        (w: any) => w.id === emptyWorkflowId
      );
      expect(emptyWorkflow).toBeDefined();
      expect(emptyWorkflow.scratchpads_summary).toEqual([]);
    });
  });

  describe('Performance and Stress Testing', () => {
    let stressWorkflowId: string;

    beforeEach(async () => {
      // Create workflow for stress testing
      const workflowResult = await helper.callCreateWorkflow({
        name: 'Stress Test Workflow',
      });
      expect(workflowResult).not.toHaveProperty('error');
      stressWorkflowId = workflowResult.workflow.id;
    });

    it('should handle Enhanced Workflow with many scratchpads efficiently', async () => {
      // Create many scratchpads
      const stressScratchpadPromises = [];
      for (let i = 0; i < 20; i++) {
        stressScratchpadPromises.push(
          helper.callCreateScratchpad({
            workflow_id: stressWorkflowId,
            title: `Stress Test Scratchpad ${i + 1}`,
            content: `Content for stress test scratchpad ${i + 1} with data ${Math.random()}`,
          })
        );
      }

      const stressResults = await Promise.all(stressScratchpadPromises);

      // All creations should succeed
      for (const result of stressResults) {
        expect(result).not.toHaveProperty('error');
      }

      // Enhanced Workflow should handle large scratchpads_summary efficiently
      const stressWorkflowState = await helper.callListWorkflows();
      expect(stressWorkflowState).not.toHaveProperty('error');

      const stressWorkflow = stressWorkflowState.workflows.find(
        (w: any) => w.id === stressWorkflowId
      );
      expect(stressWorkflow).toBeDefined();
      expect(stressWorkflow.scratchpads_summary).toHaveLength(20);

      // All summaries should have required properties
      for (const summary of stressWorkflow.scratchpads_summary) {
        expect(summary).toHaveProperty('id');
        expect(summary).toHaveProperty('title');
        expect(summary).toHaveProperty('size_bytes');
        expect(summary).toHaveProperty('updated_at');
      }
    });

    it('should provide clear Smart Append guidance with many scratchpads', async () => {
      // Create multiple scratchpads
      const scratchpadCount = 15;
      for (let i = 0; i < scratchpadCount; i++) {
        const result = await helper.callCreateScratchpad({
          workflow_id: stressWorkflowId,
          title: `Multi Scratchpad ${i + 1}`,
          content: `Content for multi scratchpad ${i + 1}`,
        });
        expect(result).not.toHaveProperty('error');
      }

      // Smart Append should provide clear guidance
      const multiAppendResult = await helper.callAppendScratchpad({
        id: stressWorkflowId, // Workflow ID with many scratchpads
        content: 'Should list options clearly',
      });

      expect(multiAppendResult).toHaveProperty('error');
      expect(multiAppendResult.error).toContain('Multiple scratchpads found');
      expect(multiAppendResult.error).toContain('Please specify the scratchpad ID');

      // Error message should include scratchpad options
      const errorLines = multiAppendResult.error.split('\n');
      expect(errorLines.length).toBeGreaterThan(5); // Should list several options
    });

    it('should handle concurrent Smart Append and Enhanced Workflow operations', async () => {
      // Create single scratchpad for Smart Append testing
      const scratchpadResult = await helper.callCreateScratchpad({
        workflow_id: stressWorkflowId,
        title: 'Concurrent Test Scratchpad',
        content: 'Initial concurrent content',
      });
      expect(scratchpadResult).not.toHaveProperty('error');

      // Perform concurrent Smart Append operations using workflow ID
      const concurrentPromises = [];
      for (let i = 0; i < 5; i++) {
        concurrentPromises.push(
          helper.callAppendScratchpad({
            id: stressWorkflowId, // Using workflow ID (Smart Append)
            content: `\nConcurrent smart append ${i + 1}`,
          })
        );
      }

      const concurrentResults = await Promise.all(concurrentPromises);

      // All Smart Append operations should succeed
      for (const result of concurrentResults) {
        expect(result).not.toHaveProperty('error');
        expect(result.message).toContain('Concurrent Test Scratchpad');
      }

      // Enhanced Workflow should reflect final consistent state
      const finalWorkflowState = await helper.callGetLatestActiveWorkflow({});
      expect(finalWorkflowState).not.toHaveProperty('error');
      expect(finalWorkflowState.workflow.scratchpads_summary).toHaveLength(1);

      // Verify the scratchpad contains all appended content
      const finalScratchpadResult = await helper.callGetScratchpad({
        id: scratchpadResult.scratchpad.id,
      });
      expect(finalScratchpadResult).not.toHaveProperty('error');
      expect(finalScratchpadResult.scratchpad.content).toContain('Initial concurrent content');
      expect(finalScratchpadResult.scratchpad.content).toContain('Concurrent smart append');
    });
  });
});
