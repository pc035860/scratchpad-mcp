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

      expect(updated.content).toBe('Initial content\n\n---\n<!--- block start --->\n\nAppended content');
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

    it('should handle hyphenated search terms correctly', () => {
      const workflow = db.createWorkflow({ name: 'Test Workflow' });
      
      // 測試連字號搜尋 - 這是錯誤1的修復測試
      db.createScratchpad({
        workflow_id: workflow.id,
        title: 'Claude-MD 專案筆記',
        content: 'This project uses Claude-MD configuration system',
      });
      
      db.createScratchpad({
        workflow_id: workflow.id,
        title: 'Regular Notes',
        content: 'This is a regular note without special characters',
      });

      // 測試帶連字號的搜尋（之前會導致 "no such column: MD" 錯誤）
      const hyphenResults = db.searchScratchpads({ query: 'Claude-MD' });
      expect(hyphenResults).toHaveLength(1);
      expect(hyphenResults[0]?.scratchpad.title).toBe('Claude-MD 專案筆記');
    });

    it('should handle special characters in search queries', () => {
      const workflow = db.createWorkflow({ name: 'Test Workflow' });
      
      // 測試各種特殊字符的搜尋
      db.createScratchpad({
        workflow_id: workflow.id,
        title: 'Special Chars: "quotes" (parentheses) *asterisks*',
        content: 'Content with various special characters',
      });

      // 這些搜尋之前可能會導致 FTS5 語法錯誤
      const quoteResults = db.searchScratchpads({ query: '"quotes"' });
      expect(quoteResults.length).toBeGreaterThanOrEqual(0); // 至少不應該報錯

      const parenResults = db.searchScratchpads({ query: '(parentheses)' });
      expect(parenResults.length).toBeGreaterThanOrEqual(0);

      const asteriskResults = db.searchScratchpads({ query: '*asterisks*' });
      expect(asteriskResults.length).toBeGreaterThanOrEqual(0);
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

    it('should throw error for non-existent scratchpad append', () => {
      expect(() => {
        db.appendToScratchpad({
          id: 'non-existent-id',
          content: 'Additional content',
        });
      }).toThrow('Scratchpad not found');
    });
  });

  describe('Append Operation Stability', () => {
    it('should successfully append content multiple times', () => {
      const workflow = db.createWorkflow({ name: 'Test Workflow' });
      const scratchpad = db.createScratchpad({
        workflow_id: workflow.id,
        title: 'Append Test',
        content: 'Initial content',
      });

      // 多次 append 操作，測試穩定性（錯誤2的修復驗證）
      const append1 = db.appendToScratchpad({
        id: scratchpad.id,
        content: '\nFirst append',
      });
      expect(append1.content).toBe('Initial content\n\n---\n<!--- block start --->\n\nFirst append');

      const append2 = db.appendToScratchpad({
        id: append1.id,
        content: '\nSecond append',
      });
      expect(append2.content).toBe('Initial content\n\n---\n<!--- block start --->\n\nFirst append\n\n---\n<!--- block start --->\n\nSecond append');

      const append3 = db.appendToScratchpad({
        id: append2.id,
        content: '\nThird append',
      });
      expect(append3.content).toBe('Initial content\n\n---\n<!--- block start --->\n\nFirst append\n\n---\n<!--- block start --->\n\nSecond append\n\n---\n<!--- block start --->\n\nThird append');
      
      // 驗證更新時間有正確遞增
      expect(append3.updated_at).toBeGreaterThanOrEqual(append2.updated_at);
      expect(append2.updated_at).toBeGreaterThanOrEqual(append1.updated_at);
    });

    it('should handle append with special characters', () => {
      const workflow = db.createWorkflow({ name: 'Test Workflow' });
      const scratchpad = db.createScratchpad({
        workflow_id: workflow.id,
        title: 'Special Chars Test',
        content: 'Initial content',
      });

      // 測試包含特殊字符的 append（這些字符之前可能導致 FTS5 問題）
      const updated = db.appendToScratchpad({
        id: scratchpad.id,
        content: '\n\n## 🌸 Hanabi 的測試\n這是一個包含特殊字符的測試：Claude-MD、"引號"、(括號)、*星號*',
      });

      expect(updated.content).toContain('🌸 Hanabi');
      expect(updated.content).toContain('Claude-MD');
      expect(updated.content).toContain('"引號"');
      expect(updated.content).toContain('(括號)');
      expect(updated.content).toContain('*星號*');
    });

    it('should maintain searchability after append operations', () => {
      const workflow = db.createWorkflow({ name: 'Test Workflow' });
      const scratchpad = db.createScratchpad({
        workflow_id: workflow.id,
        title: 'Search Test',
        content: 'Original searchable content',
      });

      // Append 後應該仍然可以搜尋到
      db.appendToScratchpad({
        id: scratchpad.id,
        content: '\nAdded Claude-MD configuration',
      });

      // 測試搜尋原始內容
      const originalResults = db.searchScratchpads({ query: 'searchable' });
      expect(originalResults).toHaveLength(1);
      expect(originalResults[0]?.scratchpad.id).toBe(scratchpad.id);

      // 測試搜尋新增的內容（包含連字號）
      const appendedResults = db.searchScratchpads({ query: 'Claude-MD' });
      expect(appendedResults).toHaveLength(1);
      expect(appendedResults[0]?.scratchpad.id).toBe(scratchpad.id);
      expect(appendedResults[0]?.scratchpad.content).toContain('Claude-MD');
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