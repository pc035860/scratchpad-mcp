/**
 * Phase 3: Critical Issue Fixes Validation Tests (Updated)
 * Tests for WAL checkpoint strategy and type safety enhancements
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import { ScratchpadDatabase } from '../src/database/index.js';
import { isScratchpad, isWorkflowDbRow, isVersionQueryResult } from '../src/database/types.js';

describe('Critical Issue Fixes Validation (Updated)', () => {
  let db: ScratchpadDatabase;
  const testDbPath = 'test-critical-fixes-v2.db';

  beforeEach(() => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // Clean up test database file
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('Phase 1: WAL Checkpoint Strategy Validation', () => {
    it('should complete TRUNCATE checkpoint successfully on startup', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      // Create database with WAL mode
      db = new ScratchpadDatabase({ filename: testDbPath });

      // Verify that debug message indicates successful TRUNCATE
      expect(consoleSpy).toHaveBeenCalledWith('WAL checkpoint (TRUNCATE) completed successfully');

      consoleSpy.mockRestore();
    });

    it('should handle database initialization robustly', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      db = new ScratchpadDatabase({ filename: testDbPath });

      // Database should initialize successfully
      expect(consoleSpy).toHaveBeenCalledWith('WAL checkpoint (TRUNCATE) completed successfully');

      // Database should be functional
      expect(() => {
        db.createWorkflow({ name: 'Test Workflow' });
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should maintain data consistency after multiple operations', () => {
      db = new ScratchpadDatabase({ filename: testDbPath });

      // Create test data
      const workflow = db.createWorkflow({ name: 'Consistency Test' });
      const scratchpad = db.createScratchpad({
        workflow_id: workflow.id,
        title: 'Test Scratchpad',
        content: 'Initial content for consistency test',
      });

      // Close and reopen database to trigger checkpoint again
      db.close();
      db = new ScratchpadDatabase({ filename: testDbPath });

      // Verify data integrity
      const retrievedWorkflow = db.getWorkflowById(workflow.id);
      const retrievedScratchpad = db.getScratchpadById(scratchpad.id);

      expect(retrievedWorkflow).toBeTruthy();
      expect(retrievedWorkflow?.name).toBe('Consistency Test');
      expect(retrievedScratchpad).toBeTruthy();
      expect(retrievedScratchpad?.content).toBe('Initial content for consistency test');
    });

    it('should have minimal impact on startup performance (<100ms)', () => {
      const startTime = performance.now();

      db = new ScratchpadDatabase({ filename: testDbPath });

      const endTime = performance.now();
      const initTime = endTime - startTime;

      // Startup should be under 100ms even with checkpoint operations
      expect(initTime).toBeLessThan(100);

      // Database should be fully functional
      expect(() => {
        db.getStats();
      }).not.toThrow();
    });

    it('should handle rapid database operations successfully', () => {
      db = new ScratchpadDatabase({ filename: testDbPath });

      const workflow = db.createWorkflow({ name: 'Rapid Operations Test' });

      // Rapidly create multiple scratchpads
      const scratchpads = [];
      for (let i = 0; i < 10; i++) {
        scratchpads.push(
          db.createScratchpad({
            workflow_id: workflow.id,
            title: `Rapid ${i}`,
            content: `Rapid test content ${i}`,
          })
        );
      }

      // Verify all operations completed successfully
      expect(scratchpads).toHaveLength(10);
      const listed = db.listScratchpads({ workflow_id: workflow.id });
      expect(listed).toHaveLength(10);

      // Search should work properly after rapid operations
      const searchResults = db.searchScratchpads({ query: 'rapid' });
      expect(searchResults.length).toBeGreaterThan(0);
    });
  });

  describe('Phase 2: Type Safety Enhancement Validation', () => {
    beforeEach(() => {
      db = new ScratchpadDatabase({ filename: testDbPath });
    });

    describe('Type Guard Functions', () => {
      it('should validate Scratchpad objects correctly', () => {
        const validScratchpad = {
          id: 'test-id',
          workflow_id: 'workflow-id',
          title: 'Test Title',
          content: 'Test Content',
          created_at: 1234567890,
          updated_at: 1234567890,
          size_bytes: 1024,
        };

        expect(isScratchpad(validScratchpad)).toBe(true);

        // Test invalid cases
        expect(isScratchpad(null)).toBe(false);
        expect(isScratchpad(undefined)).toBe(false);
        expect(isScratchpad('string')).toBe(false);
        expect(isScratchpad(123)).toBe(false);
        expect(isScratchpad({})).toBe(false);

        // Test partial objects
        expect(isScratchpad({ id: 'test-id' })).toBe(false);
        expect(isScratchpad({ ...validScratchpad, id: null })).toBe(false);
        expect(isScratchpad({ ...validScratchpad, created_at: 'invalid' })).toBe(false);
      });

      it('should validate WorkflowDbRow objects correctly', () => {
        const validWorkflowRow = {
          id: 'workflow-id',
          name: 'Test Workflow',
          description: 'Test Description',
          project_scope: null,
          created_at: 1234567890,
          updated_at: 1234567890,
          is_active: 1,
          scratchpad_count: 0,
        };

        expect(isWorkflowDbRow(validWorkflowRow)).toBe(true);

        // Test invalid cases
        expect(isWorkflowDbRow(null)).toBe(false);
        expect(isWorkflowDbRow(undefined)).toBe(false);
        expect(isWorkflowDbRow({ id: 'test' })).toBe(false);
        expect(isWorkflowDbRow({ ...validWorkflowRow, is_active: 'invalid' })).toBe(false);
      });

      it('should validate version query results correctly', () => {
        // Based on type definition: checks for 'value' field
        const validVersionResult = { value: '( t+e+s+t* OR test* )' };

        expect(isVersionQueryResult(validVersionResult)).toBe(true);

        // Test invalid cases
        expect(isVersionQueryResult(null)).toBe(false);
        expect(isVersionQueryResult({})).toBe(false);
        expect(isVersionQueryResult({ value: 123 })).toBe(false);
        expect(isVersionQueryResult({ result: '1.0' })).toBe(false); // Wrong field name
      });
    });

    describe('Database Operations Type Safety', () => {
      it('should handle getScratchpadById with type safety', () => {
        const workflow = db.createWorkflow({ name: 'Type Safety Test' });
        const scratchpad = db.createScratchpad({
          workflow_id: workflow.id,
          title: 'Type Test',
          content: 'Content for type safety testing',
        });

        const retrieved = db.getScratchpadById(scratchpad.id);
        expect(retrieved).toBeTruthy();
        expect(isScratchpad(retrieved)).toBe(true);

        // Test with non-existent ID (returns null for safety, doesn't throw)
        const nonExistent = db.getScratchpadById('non-existent-id');
        expect(nonExistent).toBeNull();
      });

      it('should handle getWorkflowById with type safety', () => {
        const workflow = db.createWorkflow({ name: 'Workflow Type Test' });

        const retrieved = db.getWorkflowById(workflow.id);
        expect(retrieved).toBeTruthy();
        // Verify the workflow has the expected structure
        expect(retrieved?.id).toBe(workflow.id);
        expect(retrieved?.name).toBe('Workflow Type Test');

        // Test with non-existent ID (returns null for safety, doesn't throw)
        const nonExistent = db.getWorkflowById('non-existent-id');
        expect(nonExistent).toBeNull();
      });

      it('should validate scratchpad structure in real database operations', () => {
        const workflow = db.createWorkflow({ name: 'Structure Test' });

        const scratchpad = db.createScratchpad({
          workflow_id: workflow.id,
          title: 'Structure Test Scratchpad',
          content: 'Content for structure validation',
        });

        // All returned scratchpads should pass type validation
        expect(isScratchpad(scratchpad)).toBe(true);

        const retrieved = db.getScratchpadById(scratchpad.id);
        expect(isScratchpad(retrieved)).toBe(true);

        const listed = db.listScratchpads({ workflow_id: workflow.id });
        expect(listed).toHaveLength(1);
        expect(isScratchpad(listed[0])).toBe(true);
      });
    });

    describe('Error Handling and Recovery', () => {
      it('should maintain system stability under type validation stress', () => {
        const workflow = db.createWorkflow({ name: 'Stress Test' });

        // Multiple operations to ensure type safety doesn't impact performance (within limits)
        const operations = [];
        for (let i = 0; i < 25; i++) {
          // Reduced to stay within MAX_SCRATCHPADS_PER_WORKFLOW limit
          operations.push(
            db.createScratchpad({
              workflow_id: workflow.id,
              title: `Stress Test ${i}`,
              content: `Content for stress test iteration ${i}`,
            })
          );
        }

        // All operations should complete successfully
        expect(operations).toHaveLength(25);
        operations.forEach((scratchpad) => {
          expect(isScratchpad(scratchpad)).toBe(true);
        });

        // Search should still work with type safety
        const searchResults = db.searchScratchpads({ query: 'stress' });
        expect(searchResults.length).toBeGreaterThan(0);
        searchResults.forEach((result) => {
          expect(isScratchpad(result.scratchpad)).toBe(true);
        });
      });

      it('should handle append operations with type validation', () => {
        const workflow = db.createWorkflow({ name: 'Append Safety Test' });
        const scratchpad = db.createScratchpad({
          workflow_id: workflow.id,
          title: 'Append Test',
          content: 'Initial content',
        });

        // Multiple append operations
        for (let i = 0; i < 5; i++) {
          const updated = db.appendToScratchpad({
            id: scratchpad.id,
            content: `\nAppended content ${i}`,
          });
          expect(isScratchpad(updated)).toBe(true);
        }

        // Final validation
        const final = db.getScratchpadById(scratchpad.id);
        expect(isScratchpad(final)).toBe(true);
        expect(final?.content).toContain('Appended content 4');
      });
    });
  });

  describe('Integration: WAL + Type Safety Combined', () => {
    it('should maintain type safety during checkpoint operations', () => {
      db = new ScratchpadDatabase({ filename: testDbPath });

      const workflow = db.createWorkflow({ name: 'Integration Test' });
      const scratchpad = db.createScratchpad({
        workflow_id: workflow.id,
        title: 'Integration Scratchpad',
        content: 'Content for integration testing',
      });

      // Verify type safety is maintained
      const retrieved = db.getScratchpadById(scratchpad.id);
      expect(isScratchpad(retrieved)).toBe(true);
      expect(retrieved?.content).toBe('Content for integration testing');
    });

    it('should handle concurrent operations with WAL and type validation', () => {
      db = new ScratchpadDatabase({ filename: testDbPath });

      const workflow = db.createWorkflow({ name: 'Concurrent Test' });

      // Create and immediately append to scratchpads
      const scratchpads = [];
      for (let i = 0; i < 10; i++) {
        const scratchpad = db.createScratchpad({
          workflow_id: workflow.id,
          title: `Concurrent ${i}`,
          content: `Content ${i}`,
        });

        const updated = db.appendToScratchpad({
          id: scratchpad.id,
          content: `\nAppended content ${i}`,
        });

        scratchpads.push(updated);
      }

      // All operations should complete successfully with type safety
      scratchpads.forEach((result) => {
        expect(isScratchpad(result)).toBe(true);
        expect(result.content).toContain('Appended content');
      });

      // Final verification
      const allScratchpads = db.listScratchpads({ workflow_id: workflow.id });
      expect(allScratchpads).toHaveLength(10);
      allScratchpads.forEach((scratchpad) => {
        expect(isScratchpad(scratchpad)).toBe(true);
      });
    });

    it('should demonstrate combined performance improvements', () => {
      const startTime = performance.now();

      db = new ScratchpadDatabase({ filename: testDbPath });

      // Create substantial test data within reasonable limits
      const workflow = db.createWorkflow({ name: 'Performance Test' });
      for (let i = 0; i < 20; i++) {
        db.createScratchpad({
          workflow_id: workflow.id,
          title: `Performance Test ${i}`,
          content: `Content for performance testing iteration ${i}. This includes various operations.`,
        });
      }

      // Search operations (benefits from WAL performance)
      const searchStart = performance.now();
      const searchResults = db.searchScratchpads({ query: 'performance' });
      const searchEnd = performance.now();

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchEnd - searchStart).toBeLessThan(100); // Should be under 100ms

      // List operations (benefits from type safety)
      const listStart = performance.now();
      const listResults = db.listScratchpads({ workflow_id: workflow.id });
      const listEnd = performance.now();

      expect(listResults).toHaveLength(20);
      expect(listEnd - listStart).toBeLessThan(50); // Should be under 50ms

      // All results should have proper type validation
      listResults.forEach((result) => {
        expect(isScratchpad(result)).toBe(true);
      });

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(300); // Total operation time should be reasonable
    });

    it('should maintain reliability under mixed workloads', () => {
      db = new ScratchpadDatabase({ filename: testDbPath });

      // Create multiple workflows
      const workflows = [];
      for (let i = 0; i < 3; i++) {
        workflows.push(db.createWorkflow({ name: `Mixed Workload ${i}` }));
      }

      // Create scratchpads across workflows
      const allScratchpads = [];
      workflows.forEach((workflow, workflowIndex) => {
        for (let i = 0; i < 5; i++) {
          const scratchpad = db.createScratchpad({
            workflow_id: workflow.id,
            title: `WF${workflowIndex}-SP${i}`,
            content: `Content for workflow ${workflowIndex}, scratchpad ${i}`,
          });
          allScratchpads.push(scratchpad);
        }
      });

      // Verify all operations maintain type safety
      expect(allScratchpads).toHaveLength(15);
      allScratchpads.forEach((scratchpad) => {
        expect(isScratchpad(scratchpad)).toBe(true);
      });

      // Cross-workflow searches should work
      const searchResults = db.searchScratchpads({ query: 'Content' });
      expect(searchResults.length).toBeGreaterThanOrEqual(15);
      searchResults.forEach((result) => {
        expect(isScratchpad(result.scratchpad)).toBe(true);
      });
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets with enhanced safety', () => {
      db = new ScratchpadDatabase({ filename: testDbPath });

      const workflow = db.createWorkflow({ name: 'Benchmark Test' });

      // Creation performance
      const createStart = performance.now();
      for (let i = 0; i < 10; i++) {
        db.createScratchpad({
          workflow_id: workflow.id,
          title: `Benchmark ${i}`,
          content: `Performance benchmark content ${i}`,
        });
      }
      const createEnd = performance.now();

      expect(createEnd - createStart).toBeLessThan(100); // 10 creations under 100ms

      // Search performance
      const searchStart = performance.now();
      const results = db.searchScratchpads({ query: 'benchmark' });
      const searchEnd = performance.now();

      expect(searchEnd - searchStart).toBeLessThan(50); // Search under 50ms
      expect(results.length).toBeGreaterThan(0);

      // Type validation doesn't significantly impact performance
      results.forEach((result) => {
        expect(isScratchpad(result.scratchpad)).toBe(true);
      });
    });
  });
});
