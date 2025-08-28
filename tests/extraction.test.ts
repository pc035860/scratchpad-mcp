/**
 * GPT-5 Workflow Extraction Tool Tests
 *
 * Tests the GPT-5 workflow extraction tool with Mock OpenAI API
 * to avoid costs and external dependencies while ensuring comprehensive coverage.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScratchpadDatabase } from '../src/database/index.js';
import { extractWorkflowInfoTool } from '../src/tools/extraction.js';
import type { ExtractWorkflowInfoArgs } from '../src/tools/types.js';

// Mock OpenAI module for Response API
const mockResponseCreate = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    responses: {
      create: mockResponseCreate,
    },
  })),
}));

/**
 * Test helper for extraction tool testing
 */
class ExtractionToolTestHelper {
  private db: ScratchpadDatabase;
  private extractWorkflowInfo: ReturnType<typeof extractWorkflowInfoTool>;
  private mockOpenAI: any;

  constructor() {
    this.db = new ScratchpadDatabase({ filename: ':memory:' });
    this.extractWorkflowInfo = extractWorkflowInfoTool(this.db);

    // Reference the global mock for Response API
    this.mockOpenAI = {
      responses: {
        create: mockResponseCreate,
      },
    };
  }

  async createTestWorkflow() {
    const workflow = this.db.createWorkflow({
      name: 'test-extraction-workflow',
      description: 'Test workflow for extraction testing',
      project_scope: 'test-project',
    });

    // Create test scratchpads
    const scratchpad1 = this.db.createScratchpad({
      workflow_id: workflow.id,
      title: 'requirements-analysis',
      content: `# Requirements Analysis

## Core Features
- User authentication system
- Dashboard with analytics
- Data export functionality

## Technical Requirements  
- React 18 with TypeScript
- Node.js backend with Express
- PostgreSQL database
- JWT authentication

## Success Criteria
- Login/logout functionality
- Secure API endpoints
- Responsive design
`,
    });

    const scratchpad2 = this.db.createScratchpad({
      workflow_id: workflow.id,
      title: 'technical-design',
      content: `# Technical Design

## Architecture Overview
- Frontend: React SPA with TypeScript
- Backend: Node.js REST API
- Database: PostgreSQL with migrations
- Authentication: JWT with refresh tokens

## Key Components
1. AuthService: Handle login/logout
2. UserDashboard: Main application view  
3. DataExporter: CSV/PDF export functionality
4. APIMiddleware: Security and validation

## Implementation Plan
Phase 1: Authentication system
Phase 2: Dashboard UI
Phase 3: Export functionality
`,
    });

    return { workflow, scratchpads: [scratchpad1, scratchpad2] };
  }

  setupMockResponse(response: string, error?: any) {
    if (error) {
      this.mockOpenAI.responses.create.mockRejectedValue(error);
    } else {
      this.mockOpenAI.responses.create.mockResolvedValue({
        output_text: response,
        status: 'completed',
      });
    }
  }

  resetMocks() {
    vi.clearAllMocks();
  }

  close() {
    this.db.close();
  }
}

describe('extractWorkflowInfoTool', () => {
  let helper: ExtractionToolTestHelper;

  beforeEach(() => {
    helper = new ExtractionToolTestHelper();

    // Set environment variable for API key
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    helper.resetMocks();
    helper.close();
    delete process.env.OPENAI_API_KEY;
  });

  describe('Parameter Validation', () => {
    it('should require workflow_id parameter', async () => {
      const invalidArgs = {
        extraction_prompt: 'Extract key features',
      } as ExtractWorkflowInfoArgs;

      await expect(helper['extractWorkflowInfo'](invalidArgs)).rejects.toThrow();
    });

    it('should require extraction_prompt parameter', async () => {
      const invalidArgs = {
        workflow_id: 'test-id',
      } as ExtractWorkflowInfoArgs;

      await expect(helper['extractWorkflowInfo'](invalidArgs)).rejects.toThrow();
    });

    it('should accept optional model parameter', async () => {
      const { workflow } = await helper.createTestWorkflow();

      helper.setupMockResponse('Mock extraction result');

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Extract features',
        model: 'gpt-4o',
      };

      const result = await helper['extractWorkflowInfo'](args);
      expect(result.model_used).toBe('gpt-4o');
      expect(result.extraction_result).toBe('Mock extraction result');
    });

    it('should use default model when not specified', async () => {
      const { workflow } = await helper.createTestWorkflow();

      helper.setupMockResponse('Mock extraction result');

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Extract features',
      };

      await helper['extractWorkflowInfo'](args);

      // Verify the mock was called with default model
      expect(helper['mockOpenAI'].responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-nano',
        })
      );
    });

    it('should handle reasoning_effort parameter for GPT-5 models', async () => {
      const { workflow } = await helper.createTestWorkflow();
      helper.setupMockResponse('Detailed reasoning result');

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Extract features with reasoning',
        model: 'gpt-5-nano',
        reasoning_effort: 'high',
      };

      await helper['extractWorkflowInfo'](args);

      // Verify the mock was called with reasoning configuration
      expect(helper['mockOpenAI'].responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-nano',
          reasoning: { effort: 'high' },
        })
      );
    });
  });

  describe('Workflow Validation', () => {
    it('should reject non-existent workflow', async () => {
      const args: ExtractWorkflowInfoArgs = {
        workflow_id: 'non-existent-workflow-id',
        extraction_prompt: 'Extract features',
      };

      await expect(helper['extractWorkflowInfo'](args)).rejects.toThrow(
        'Workflow with ID non-existent-workflow-id not found'
      );
    });

    it('should handle workflow with no scratchpads', async () => {
      const workflow = helper['db'].createWorkflow({
        name: 'empty-workflow',
        description: 'Workflow with no scratchpads',
      });

      helper.setupMockResponse('No content found to analyze');

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Extract features',
      };

      const result = await helper['extractWorkflowInfo'](args);
      expect(result.extraction_result).toBe('No content found to analyze');
      expect(result.scratchpads_processed).toBe(0);
    });
  });

  describe('OpenAI API Integration', () => {
    it('should successfully extract workflow information', async () => {
      const { workflow } = await helper.createTestWorkflow();

      const mockResponse = `
# Extracted Features

## Core Functionality
1. **User Authentication System**
   - JWT-based authentication with refresh tokens
   - Secure login/logout functionality
   - Referenced in: requirements-analysis, technical-design

2. **Dashboard with Analytics**
   - Main application view with user dashboard
   - Referenced in: requirements-analysis, technical-design

3. **Data Export Functionality**
   - CSV/PDF export capabilities
   - Dedicated DataExporter component
   - Referenced in: requirements-analysis, technical-design

## Technical Stack
- Frontend: React 18 with TypeScript
- Backend: Node.js with Express
- Database: PostgreSQL with migrations
- Authentication: JWT tokens

## Implementation Phases
Phase 1: Authentication system
Phase 2: Dashboard UI  
Phase 3: Export functionality
`;

      helper.setupMockResponse(mockResponse);

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Extract key features and technical requirements from this workflow',
      };

      const result = await helper['extractWorkflowInfo'](args);

      expect(result.workflow_id).toBe(workflow.id);
      expect(result.extraction_result).toBe(mockResponse);
      expect(result.scratchpads_processed).toBe(2);
      expect(result.model_used).toBe('gpt-5-nano');
    });

    it('should pass correct parameters to OpenAI API', async () => {
      const { workflow } = await helper.createTestWorkflow();

      helper.setupMockResponse('Mock response');

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Extract features',
        model: 'gpt-4o',
      };

      await helper['extractWorkflowInfo'](args);

      expect(helper['mockOpenAI'].responses.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        input: expect.stringContaining('Extract features'),
      });
    });

    it('should format scratchpad content correctly', async () => {
      const { workflow } = await helper.createTestWorkflow();

      helper.setupMockResponse('Mock response');

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Extract features',
      };

      await helper['extractWorkflowInfo'](args);

      const callArgs = helper['mockOpenAI'].responses.create.mock.calls[0][0];
      const inputText = callArgs.input;

      // Verify workflow context formatting
      expect(inputText).toContain('Workflow contains 2 scratchpad(s)');
      expect(inputText).toContain('requirements-analysis');
      expect(inputText).toContain('technical-design');
      expect(inputText).toContain('User authentication system');
      expect(inputText).toContain('React 18 with TypeScript');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing OpenAI API key', async () => {
      delete process.env.OPENAI_API_KEY;

      const { workflow } = await helper.createTestWorkflow();

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Extract features',
      };

      await expect(helper['extractWorkflowInfo'](args)).rejects.toThrow(
        'OPENAI_API_KEY environment variable is required'
      );
    });

    it('should handle OpenAI API errors', async () => {
      const { workflow } = await helper.createTestWorkflow();

      const apiError = new Error('API rate limit exceeded');
      helper.setupMockResponse('', apiError);

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Extract features',
      };

      await expect(helper['extractWorkflowInfo'](args)).rejects.toThrow(
        'Failed to extract workflow information: API rate limit exceeded'
      );
    });

    it('should handle model not found error', async () => {
      const { workflow } = await helper.createTestWorkflow();

      const modelError = new Error('Model not found: invalid-model');
      helper.setupMockResponse('', modelError);

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Extract features',
        model: 'invalid-model',
      };

      await expect(helper['extractWorkflowInfo'](args)).rejects.toThrow(
        'OpenAI model error: Model not found: invalid-model'
      );
    });

    it('should handle network errors', async () => {
      const { workflow } = await helper.createTestWorkflow();

      const networkError = new Error('Network request failed');
      helper.setupMockResponse('', networkError);

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Extract features',
      };

      await expect(helper['extractWorkflowInfo'](args)).rejects.toThrow(
        'Failed to extract workflow information: Network request failed'
      );
    });
  });

  describe('Response Formatting', () => {
    it('should return structured success response', async () => {
      const { workflow } = await helper.createTestWorkflow();

      const mockResponse = 'Extracted workflow information';
      helper.setupMockResponse(mockResponse);

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Extract features',
      };

      const result = await helper['extractWorkflowInfo'](args);

      expect(result).toEqual({
        workflow_id: workflow.id,
        extraction_result: mockResponse,
        model_used: 'gpt-5-nano',
        scratchpads_processed: 2,
        message: expect.stringContaining('Successfully extracted information from workflow'),
      });
    });

    it('should throw error with expected message format', async () => {
      const { workflow } = await helper.createTestWorkflow();

      const apiError = new Error('Test error');
      helper.setupMockResponse('', apiError);

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Extract features',
      };

      await expect(helper['extractWorkflowInfo'](args)).rejects.toThrow(
        'Failed to extract workflow information: Test error'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely long scratchpad content', async () => {
      const workflow = helper['db'].createWorkflow({
        name: 'large-content-workflow',
        description: 'Workflow with large scratchpad content',
      });

      // Create scratchpad with very long content
      const longContent = 'Very long content '.repeat(1000); // ~17KB content
      helper['db'].createScratchpad({
        workflow_id: workflow.id,
        title: 'large-scratchpad',
        content: longContent,
      });

      helper.setupMockResponse('Processed large content successfully');

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Summarize this content',
      };

      const result = await helper['extractWorkflowInfo'](args);
      expect(result.extraction_result).toBe('Processed large content successfully');
      expect(result.scratchpads_processed).toBe(1);
    });

    it('should handle special characters in content', async () => {
      const workflow = helper['db'].createWorkflow({
        name: 'special-chars-workflow',
        description: 'Workflow with special characters',
      });

      const specialContent = `# Special Characters Test

## Code Examples
\`\`\`javascript
const text = "Hello 'world' with \\"quotes\\"";
const regex = /[\\w\\s]+/g;
\`\`\`

## Unicode & Emojis
Testing unicode: 中文測試 🚀 ⭐ 💖

## Markdown Edge Cases
- List item with **bold** and *italic*
- [Link](https://example.com)
- \`inline code\`
`;

      helper['db'].createScratchpad({
        workflow_id: workflow.id,
        title: 'special-content',
        content: specialContent,
      });

      helper.setupMockResponse('Processed special characters successfully');

      const args: ExtractWorkflowInfoArgs = {
        workflow_id: workflow.id,
        extraction_prompt: 'Extract code examples',
      };

      const result = await helper['extractWorkflowInfo'](args);
      expect(result.extraction_result).toBe('Processed special characters successfully');
      expect(result.scratchpads_processed).toBe(1);
    });
  });
});
