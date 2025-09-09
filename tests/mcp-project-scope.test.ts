/**
 * MCP Tools Project Scope Tests
 * 
 * Tests the project_scope parameter handling in MCP tools layer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScratchpadDatabase } from '../src/database/index.js';
import {
  createWorkflowTool,
  listWorkflowsTool,
  getLatestActiveWorkflowTool,
  updateWorkflowStatusTool,
} from '../src/tools/workflow.js';
import {
  validateCreateWorkflowArgs,
  validateListWorkflowsArgs,
  validateGetLatestActiveWorkflowArgs,
  validateUpdateWorkflowStatusArgs,
} from '../src/server-helpers.js';

describe('MCP Tools Project Scope Integration', () => {
  let db: ScratchpadDatabase;
  const testDbPath = ':memory:';

  beforeEach(() => {
    db = new ScratchpadDatabase({ filename: testDbPath });
  });

  afterEach(() => {
    db.close();
  });

  describe('create-workflow tool with project_scope', () => {
    it('should create workflow with project_scope parameter', async () => {
      const createWorkflow = createWorkflowTool(db);
      
      const args = validateCreateWorkflowArgs({
        name: 'Frontend Tasks',
        description: 'React development workflow',
        project_scope: 'my-react-app',
      });

      const result = await createWorkflow(args);

      expect(result.workflow.name).toBe('Frontend Tasks');
      expect(result.workflow.project_scope).toBe('my-react-app');
      expect(result.message).toContain('(scope: my-react-app)');
    });

    it('should create workflow without project_scope (global)', async () => {
      const createWorkflow = createWorkflowTool(db);
      
      const args = validateCreateWorkflowArgs({
        name: 'Global Tasks',
        description: 'Cross-project workflow',
      });

      const result = await createWorkflow(args);

      expect(result.workflow.name).toBe('Global Tasks');
      expect(result.workflow.project_scope).toBeNull();
      expect(result.message).not.toContain('(scope:');
    });

    it('should validate project_scope parameter correctly', () => {
      // Valid string project_scope
      const validArgs = validateCreateWorkflowArgs({
        name: 'Test',
        project_scope: 'my-project',
      });
      expect(validArgs.project_scope).toBe('my-project');

      // No project_scope (should be undefined)
      const noScopeArgs = validateCreateWorkflowArgs({
        name: 'Test',
      });
      expect(noScopeArgs.project_scope).toBeUndefined();

      // Invalid project_scope type should throw
      expect(() => {
        validateCreateWorkflowArgs({
          name: 'Test',
          project_scope: 123, // Invalid: not a string
        });
      }).toThrow('project_scope must be a string');
    });
  });

  describe('list-workflows tool with project_scope', () => {
    beforeEach(async () => {
      // Set up test data
      const createWorkflow = createWorkflowTool(db);
      
      await createWorkflow(validateCreateWorkflowArgs({
        name: 'React Components',
        project_scope: 'frontend-app',
      }));

      await createWorkflow(validateCreateWorkflowArgs({
        name: 'React Hooks',
        project_scope: 'frontend-app',
      }));

      await createWorkflow(validateCreateWorkflowArgs({
        name: 'API Routes',
        project_scope: 'backend-api',
      }));

      await createWorkflow(validateCreateWorkflowArgs({
        name: 'Global Utils',
      }));
    });

    it('should list workflows for specific project_scope', async () => {
      const listWorkflows = listWorkflowsTool(db);
      
      const frontendArgs = validateListWorkflowsArgs({
        project_scope: 'frontend-app',
      });

      const result = await listWorkflows(frontendArgs);

      expect(result.workflows).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(result.workflows.every(w => w.project_scope === 'frontend-app')).toBe(true);
      expect(result.workflows.map(w => w.name)).toContain('React Components');
      expect(result.workflows.map(w => w.name)).toContain('React Hooks');
    });

    it('should list all workflows when no project_scope specified', async () => {
      const listWorkflows = listWorkflowsTool(db);
      
      const allArgs = validateListWorkflowsArgs({});
      const result = await listWorkflows(allArgs);

      expect(result.workflows).toHaveLength(4);
      expect(result.count).toBe(4);
    });

    it('should return empty list for non-existent project_scope', async () => {
      const listWorkflows = listWorkflowsTool(db);
      
      const nonExistentArgs = validateListWorkflowsArgs({
        project_scope: 'non-existent-project',
      });

      const result = await listWorkflows(nonExistentArgs);

      expect(result.workflows).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should validate project_scope parameter correctly', () => {
      // Valid string project_scope
      const validArgs = validateListWorkflowsArgs({
        project_scope: 'my-project',
      });
      expect(validArgs.project_scope).toBe('my-project');

      // No project_scope (should be undefined)
      const noScopeArgs = validateListWorkflowsArgs({});
      expect(noScopeArgs.project_scope).toBeUndefined();

      // Invalid project_scope type should throw
      expect(() => {
        validateListWorkflowsArgs({
          project_scope: 123, // Invalid: not a string
        });
      }).toThrow('project_scope must be a string');
    });
  });

  describe('get-latest-active-workflow tool with project_scope', () => {
    let frontendWorkflow: any, backendWorkflow: any, globalWorkflow: any;

    beforeEach(async () => {
      const createWorkflow = createWorkflowTool(db);
      
      frontendWorkflow = await createWorkflow(validateCreateWorkflowArgs({
        name: 'Frontend Workflow',
        project_scope: 'frontend-app',
      }));

      backendWorkflow = await createWorkflow(validateCreateWorkflowArgs({
        name: 'Backend Workflow',
        project_scope: 'backend-api',
      }));

      globalWorkflow = await createWorkflow(validateCreateWorkflowArgs({
        name: 'Global Workflow',
      }));
    });

    it('should get latest active workflow for specific project_scope', async () => {
      const getLatestActiveWorkflow = getLatestActiveWorkflowTool(db);
      
      const frontendArgs = validateGetLatestActiveWorkflowArgs({
        project_scope: 'frontend-app',
      });

      const result = await getLatestActiveWorkflow(frontendArgs);

      expect(result.workflow).not.toBeNull();
      expect(result.workflow?.name).toBe('Frontend Workflow');
      expect(result.workflow?.project_scope).toBe('frontend-app');
      expect(result.message).toContain('(scope: frontend-app)');
    });

    it('should return no workflow found message for non-existent project_scope', async () => {
      const getLatestActiveWorkflow = getLatestActiveWorkflowTool(db);
      
      const nonExistentArgs = validateGetLatestActiveWorkflowArgs({
        project_scope: 'test-project'
      });
      const result = await getLatestActiveWorkflow(nonExistentArgs);

      expect(result.workflow).toBeNull();
      expect(result.message).toBe('No active workflow found in scope "test-project"');
    });

    it('should return null for project_scope with no workflows', async () => {
      const getLatestActiveWorkflow = getLatestActiveWorkflowTool(db);
      
      const nonExistentArgs = validateGetLatestActiveWorkflowArgs({
        project_scope: 'non-existent-project',
      });

      const result = await getLatestActiveWorkflow(nonExistentArgs);

      expect(result.workflow).toBeNull();
      expect(result.message).toBe('No active workflow found in scope "non-existent-project"');
    });

    it('should respect active status when filtering by project_scope', async () => {
      const getLatestActiveWorkflow = getLatestActiveWorkflowTool(db);
      const updateWorkflowStatus = updateWorkflowStatusTool(db);

      // Deactivate the frontend workflow
      await updateWorkflowStatus(validateUpdateWorkflowStatusArgs({
        workflow_id: frontendWorkflow.workflow.id,
        is_active: false,
      }));

      const frontendArgs = validateGetLatestActiveWorkflowArgs({
        project_scope: 'frontend-app',
      });

      const result = await getLatestActiveWorkflow(frontendArgs);

      expect(result.workflow).toBeNull();
      expect(result.message).toBe('No active workflow found in scope "frontend-app"');
    });

    it('should validate project_scope parameter correctly', () => {
      // Valid string project_scope
      const validArgs = validateGetLatestActiveWorkflowArgs({
        project_scope: 'my-project',
      });
      expect(validArgs.project_scope).toBe('my-project');

      // Missing project_scope should throw
      expect(() => {
        validateGetLatestActiveWorkflowArgs({});
      }).toThrow('project_scope must be a string');

      // Invalid project_scope type should throw
      expect(() => {
        validateGetLatestActiveWorkflowArgs({
          project_scope: 123, // Invalid: not a string
        });
      }).toThrow('project_scope must be a string');
    });
  });

  describe('Multi-project MCP Integration Scenarios', () => {
    beforeEach(async () => {
      const createWorkflow = createWorkflowTool(db);
      
      // Create workflows for different projects
      await createWorkflow(validateCreateWorkflowArgs({
        name: 'Frontend Dev',
        description: 'UI development tasks',
        project_scope: 'web-app',
      }));

      await createWorkflow(validateCreateWorkflowArgs({
        name: 'Backend Dev',
        description: 'API development tasks',
        project_scope: 'api-server',
      }));

      await createWorkflow(validateCreateWorkflowArgs({
        name: 'Mobile Dev',
        description: 'Mobile app tasks',
        project_scope: 'mobile-app',
      }));

      await createWorkflow(validateCreateWorkflowArgs({
        name: 'DevOps Tasks',
        description: 'Infrastructure and deployment',
      })); // Global workflow
    });

    it('should maintain complete isolation between projects', async () => {
      const listWorkflows = listWorkflowsTool(db);
      const getLatestActiveWorkflow = getLatestActiveWorkflowTool(db);

      // Each project should only see its own workflows
      const webAppWorkflows = await listWorkflows(validateListWorkflowsArgs({
        project_scope: 'web-app',
      }));
      expect(webAppWorkflows.count).toBe(1);
      expect(webAppWorkflows.workflows[0].name).toBe('Frontend Dev');

      const apiServerWorkflows = await listWorkflows(validateListWorkflowsArgs({
        project_scope: 'api-server',
      }));
      expect(apiServerWorkflows.count).toBe(1);
      expect(apiServerWorkflows.workflows[0].name).toBe('Backend Dev');

      const mobileAppWorkflows = await listWorkflows(validateListWorkflowsArgs({
        project_scope: 'mobile-app',
      }));
      expect(mobileAppWorkflows.count).toBe(1);
      expect(mobileAppWorkflows.workflows[0].name).toBe('Mobile Dev');

      // Latest active should be project-specific
      const webAppLatest = await getLatestActiveWorkflow(validateGetLatestActiveWorkflowArgs({
        project_scope: 'web-app',
      }));
      expect(webAppLatest.workflow?.name).toBe('Frontend Dev');

      const apiServerLatest = await getLatestActiveWorkflow(validateGetLatestActiveWorkflowArgs({
        project_scope: 'api-server',
      }));
      expect(apiServerLatest.workflow?.name).toBe('Backend Dev');

      // Global view should see all workflows
      const allWorkflows = await listWorkflows(validateListWorkflowsArgs({}));
      expect(allWorkflows.count).toBe(4);
    });

    it('should handle workflow status changes independently per project', async () => {
      const updateWorkflowStatus = updateWorkflowStatusTool(db);
      const listWorkflows = listWorkflowsTool(db);
      const getLatestActiveWorkflow = getLatestActiveWorkflowTool(db);

      // Deactivate web-app workflow
      const webAppWorkflows = await listWorkflows(validateListWorkflowsArgs({
        project_scope: 'web-app',
      }));

      await updateWorkflowStatus(validateUpdateWorkflowStatusArgs({
        workflow_id: webAppWorkflows.workflows[0].id,
        is_active: false,
      }));

      // web-app should have no active workflows
      const webAppLatest = await getLatestActiveWorkflow(validateGetLatestActiveWorkflowArgs({
        project_scope: 'web-app',
      }));
      expect(webAppLatest.workflow).toBeNull();

      // Other projects should be unaffected
      const apiServerLatest = await getLatestActiveWorkflow(validateGetLatestActiveWorkflowArgs({
        project_scope: 'api-server',
      }));
      expect(apiServerLatest.workflow).not.toBeNull();
      expect(apiServerLatest.workflow?.name).toBe('Backend Dev');

      const mobileAppLatest = await getLatestActiveWorkflow(validateGetLatestActiveWorkflowArgs({
        project_scope: 'mobile-app',
      }));
      expect(mobileAppLatest.workflow).not.toBeNull();
      expect(mobileAppLatest.workflow?.name).toBe('Mobile Dev');
    });
  });
});