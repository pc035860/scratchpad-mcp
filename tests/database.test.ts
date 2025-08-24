/**
 * Basic database functionality tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import { ScratchpadDatabase } from '../src/database/index.js';

describe('ScratchpadDatabase', () => {
  let db: ScratchpadDatabase;
  const testDbPath = ':memory:'; // Use in-memory database for tests

  beforeEach(() => {
    db = new ScratchpadDatabase({ filename: testDbPath });
  });

  afterEach(() => {
    db.close();
  });

  describe('Workflow Management', () => {
    it('should create and retrieve a workflow', () => {
      const workflow = db.createWorkflow({
        name: 'Test Workflow',
        description: 'A test workflow',
      });

      expect(workflow.id).toBeDefined();
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.description).toBe('A test workflow');
      expect(workflow.scratchpad_count).toBe(0);

      const retrieved = db.getWorkflowById(workflow.id);
      expect(retrieved).toEqual(workflow);
    });

    it('should list workflows', () => {
      const w1 = db.createWorkflow({ name: 'Workflow 1' });
      // Small delay to ensure different timestamps
      const w2 = db.createWorkflow({ name: 'Workflow 2' });

      const workflows = db.getWorkflows();
      expect(workflows).toHaveLength(2);
      
      const workflowNames = workflows.map(w => w.name);
      expect(workflowNames).toContain('Workflow 1');
      expect(workflowNames).toContain('Workflow 2');
    });
  });

  describe('Scratchpad Management', () => {
    it('should create and retrieve a scratchpad', () => {
      const workflow = db.createWorkflow({ name: 'Test Workflow' });
      
      const scratchpad = db.createScratchpad({
        workflow_id: workflow.id,
        title: 'Test Scratchpad',
        content: 'This is test content',
      });

      expect(scratchpad.id).toBeDefined();
      expect(scratchpad.workflow_id).toBe(workflow.id);
      expect(scratchpad.title).toBe('Test Scratchpad');
      expect(scratchpad.content).toBe('This is test content');

      const retrieved = db.getScratchpadById(scratchpad.id);
      expect(retrieved).toEqual(scratchpad);
    });

    it('should append to scratchpad', () => {
      const workflow = db.createWorkflow({ name: 'Test Workflow' });
      const scratchpad = db.createScratchpad({
        workflow_id: workflow.id,
        title: 'Test Scratchpad',
        content: 'Initial content',
      });

      const updated = db.appendToScratchpad({
        id: scratchpad.id,
        content: '\nAppended content',
      });

      expect(updated.content).toBe('Initial content\nAppended content');
      expect(updated.updated_at).toBeGreaterThanOrEqual(scratchpad.updated_at);
    });

    it('should list scratchpads by workflow', () => {
      const workflow = db.createWorkflow({ name: 'Test Workflow' });
      
      const s1 = db.createScratchpad({
        workflow_id: workflow.id,
        title: 'Scratchpad 1',
        content: 'Content 1',
      });
      
      const s2 = db.createScratchpad({
        workflow_id: workflow.id,
        title: 'Scratchpad 2',
        content: 'Content 2',
      });

      const scratchpads = db.listScratchpads({ workflow_id: workflow.id });
      expect(scratchpads).toHaveLength(2);
      
      const titles = scratchpads.map(s => s.title);
      expect(titles).toContain('Scratchpad 1');
      expect(titles).toContain('Scratchpad 2');
    });
  });

  describe('Search Functionality', () => {
    it('should search scratchpads by content', () => {
      const workflow = db.createWorkflow({ name: 'Test Workflow' });
      
      db.createScratchpad({
        workflow_id: workflow.id,
        title: 'JavaScript Notes',
        content: 'This is about JavaScript programming',
      });
      
      db.createScratchpad({
        workflow_id: workflow.id,
        title: 'Python Notes',
        content: 'This is about Python programming',
      });

      const jsResults = db.searchScratchpads({ query: 'JavaScript' });
      expect(jsResults).toHaveLength(1);
      expect(jsResults[0]?.scratchpad.title).toBe('JavaScript Notes');

      const programmingResults = db.searchScratchpads({ query: 'programming' });
      expect(programmingResults).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent workflow', () => {
      expect(() => {
        db.createScratchpad({
          workflow_id: 'non-existent-id',
          title: 'Test',
          content: 'Content',
        });
      }).toThrow('Workflow not found');
    });

    it('should throw error for oversized content', () => {
      const workflow = db.createWorkflow({ name: 'Test Workflow' });
      const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB content

      expect(() => {
        db.createScratchpad({
          workflow_id: workflow.id,
          title: 'Large Scratchpad',
          content: largeContent,
        });
      }).toThrow('Scratchpad content too large');
    });
  });

  describe('Database Statistics', () => {
    it('should return correct statistics', () => {
      const initialStats = db.getStats();
      expect(initialStats.totalWorkflows).toBe(0);
      expect(initialStats.totalScratchpads).toBe(0);
      expect(typeof initialStats.hasFTS5).toBe('boolean');

      const workflow = db.createWorkflow({ name: 'Test Workflow' });
      db.createScratchpad({
        workflow_id: workflow.id,
        title: 'Test Scratchpad',
        content: 'Content',
      });

      const updatedStats = db.getStats();
      expect(updatedStats.totalWorkflows).toBe(1);
      expect(updatedStats.totalScratchpads).toBe(1);
    });
  });
});