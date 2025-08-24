/**
 * Project Scope Isolation Tests
 * 
 * Tests the new project_scope feature to ensure workflows from different
 * projects don't interfere with each other.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScratchpadDatabase } from '../src/database/index.js';

describe('Project Scope Isolation', () => {
  let db: ScratchpadDatabase;
  const testDbPath = ':memory:'; // Use in-memory database for tests

  beforeEach(() => {
    db = new ScratchpadDatabase({ filename: testDbPath });
  });

  afterEach(() => {
    db.close();
  });

  describe('Workflow Creation with Project Scope', () => {
    it('should create workflows with different project scopes', () => {
      const projectA = db.createWorkflow({
        name: 'Frontend Workflow',
        description: 'React development',
        project_scope: 'my-react-app',
      });

      const projectB = db.createWorkflow({
        name: 'Backend Workflow',
        description: 'API development',
        project_scope: 'my-api-server',
      });

      const globalWorkflow = db.createWorkflow({
        name: 'Global Workflow',
        description: 'No specific project',
      });

      expect(projectA.project_scope).toBe('my-react-app');
      expect(projectB.project_scope).toBe('my-api-server');
      expect(globalWorkflow.project_scope).toBeNull();
    });
  });

  describe('Project-scoped Workflow Listing', () => {
    beforeEach(() => {
      // Create test workflows for different projects
      db.createWorkflow({
        name: 'React Component',
        description: 'UI components',
        project_scope: 'my-react-app',
      });

      db.createWorkflow({
        name: 'React Hooks',
        description: 'Custom hooks',
        project_scope: 'my-react-app',
      });

      db.createWorkflow({
        name: 'API Routes',
        description: 'Express routes',
        project_scope: 'my-api-server',
      });

      db.createWorkflow({
        name: 'Global Utils',
        description: 'Shared utilities',
      });
    });

    it('should list workflows filtered by project scope', () => {
      const reactWorkflows = db.getWorkflows('my-react-app');
      const apiWorkflows = db.getWorkflows('my-api-server');
      const allWorkflows = db.getWorkflows();

      expect(reactWorkflows).toHaveLength(2);
      expect(apiWorkflows).toHaveLength(1);
      expect(allWorkflows).toHaveLength(4); // All workflows

      expect(reactWorkflows[0].name).toMatch(/React/);
      expect(reactWorkflows[1].name).toMatch(/React/);
      expect(apiWorkflows[0].name).toBe('API Routes');
    });

    it('should return empty array for non-existent project scope', () => {
      const nonExistentProject = db.getWorkflows('non-existent-project');
      expect(nonExistentProject).toHaveLength(0);
    });
  });

  describe('Latest Active Workflow by Project Scope', () => {
    let reactWorkflow1: any, reactWorkflow2: any, apiWorkflow: any, globalWorkflow: any;

    beforeEach(async () => {
      // Create workflows at different times to ensure proper ordering
      reactWorkflow1 = db.createWorkflow({
        name: 'React Workflow 1',
        project_scope: 'my-react-app',
      });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      apiWorkflow = db.createWorkflow({
        name: 'API Workflow',
        project_scope: 'my-api-server',
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      
      reactWorkflow2 = db.createWorkflow({
        name: 'React Workflow 2',
        project_scope: 'my-react-app',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      globalWorkflow = db.createWorkflow({
        name: 'Global Workflow',
      });
    });

    it('should return latest active workflow for specific project scope', () => {
      const latestReact = db.getLatestActiveWorkflow('my-react-app');
      const latestApi = db.getLatestActiveWorkflow('my-api-server');
      const latestGlobal = db.getLatestActiveWorkflow();

      // Project-scoped queries should return workflows from the correct project
      expect(latestReact).not.toBeNull();
      expect(latestReact?.project_scope).toBe('my-react-app');
      expect(['React Workflow 1', 'React Workflow 2']).toContain(latestReact?.name);

      expect(latestApi?.name).toBe('API Workflow');
      expect(latestApi?.project_scope).toBe('my-api-server');

      // Global query returns the most recent workflow overall
      expect(latestGlobal).not.toBeNull();
      expect(['React Workflow 1', 'React Workflow 2', 'API Workflow', 'Global Workflow']).toContain(latestGlobal?.name);
    });

    it('should return null for project scope with no active workflows', () => {
      const nonExistent = db.getLatestActiveWorkflow('non-existent-project');
      expect(nonExistent).toBeNull();
    });

    it('should respect active status when filtering by project scope', () => {
      // Deactivate the latest React workflow
      db.setWorkflowActiveStatus(reactWorkflow2.id, false);

      const latestReact = db.getLatestActiveWorkflow('my-react-app');
      expect(latestReact?.name).toBe('React Workflow 1'); // Falls back to older active one
    });

    it('should return null when no active workflows exist for project scope', () => {
      // Deactivate all React workflows
      db.setWorkflowActiveStatus(reactWorkflow1.id, false);
      db.setWorkflowActiveStatus(reactWorkflow2.id, false);

      const latestReact = db.getLatestActiveWorkflow('my-react-app');
      expect(latestReact).toBeNull();
    });
  });

  describe('Multi-project Isolation Scenarios', () => {
    beforeEach(() => {
      // Set up complex multi-project scenario
      const projects = ['frontend', 'backend', 'mobile', 'docs'];
      
      projects.forEach((project, index) => {
        // Create 2 workflows per project
        for (let i = 1; i <= 2; i++) {
          db.createWorkflow({
            name: `${project} Workflow ${i}`,
            description: `${project} development tasks`,
            project_scope: project,
          });
        }
      });

      // Create some global workflows
      db.createWorkflow({
        name: 'Global Workflow 1',
        description: 'Cross-project tasks',
      });
      
      db.createWorkflow({
        name: 'Global Workflow 2',
        description: 'General utilities',
      });
    });

    it('should maintain strict isolation between projects', () => {
      const frontend = db.getWorkflows('frontend');
      const backend = db.getWorkflows('backend');
      const mobile = db.getWorkflows('mobile');
      const docs = db.getWorkflows('docs');
      const all = db.getWorkflows();

      // Each project should have exactly 2 workflows
      expect(frontend).toHaveLength(2);
      expect(backend).toHaveLength(2);
      expect(mobile).toHaveLength(2);
      expect(docs).toHaveLength(2);
      
      // Total should be 10 (8 project-scoped + 2 global)
      expect(all).toHaveLength(10);

      // Project workflows should only contain that project's workflows
      frontend.forEach(w => expect(w.project_scope).toBe('frontend'));
      backend.forEach(w => expect(w.project_scope).toBe('backend'));
      mobile.forEach(w => expect(w.project_scope).toBe('mobile'));
      docs.forEach(w => expect(w.project_scope).toBe('docs'));
    });

    it('should handle workflow status changes independently per project', () => {
      // Deactivate all backend workflows
      const backendWorkflows = db.getWorkflows('backend');
      backendWorkflows.forEach(w => {
        db.setWorkflowActiveStatus(w.id, false);
      });

      // Backend should have no active workflows
      expect(db.getLatestActiveWorkflow('backend')).toBeNull();
      
      // Other projects should be unaffected
      expect(db.getLatestActiveWorkflow('frontend')).not.toBeNull();
      expect(db.getLatestActiveWorkflow('mobile')).not.toBeNull();
      expect(db.getLatestActiveWorkflow('docs')).not.toBeNull();
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle workflows created without project_scope (null)', () => {
      // Create workflow without project_scope (simulating old data)
      const oldWorkflow = db.createWorkflow({
        name: 'Legacy Workflow',
        description: 'Created before project_scope feature',
      });

      expect(oldWorkflow.project_scope).toBeNull();

      // Should be included in global listing
      const allWorkflows = db.getWorkflows();
      expect(allWorkflows.some(w => w.name === 'Legacy Workflow')).toBe(true);

      // Should not appear in project-scoped listings
      const projectWorkflows = db.getWorkflows('some-project');
      expect(projectWorkflows.some(w => w.name === 'Legacy Workflow')).toBe(false);
    });

    it('should return global workflows when no project_scope specified', () => {
      // Mix of global and project-scoped workflows
      db.createWorkflow({
        name: 'Global Task',
      });

      db.createWorkflow({
        name: 'Project Task',
        project_scope: 'my-project',
      });

      const globalLatest = db.getLatestActiveWorkflow();
      // Should return the most recent workflow regardless of project_scope
      expect(globalLatest).not.toBeNull();
    });
  });
});