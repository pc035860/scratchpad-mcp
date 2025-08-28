/**
 * GPT-5 Workflow Extraction Tool
 * Extracts specific information from workflows using OpenAI's GPT models
 */
import OpenAI from 'openai';
import type { ScratchpadDatabase } from '../database/index.js';
import type { Scratchpad } from '../database/types.js';
import type { ToolHandler, ExtractWorkflowInfoArgs, ExtractWorkflowInfoResult } from './types.js';

/**
 * Format timestamp for consistent display
 */
const formatTimestamp = (unixTimestamp: number): string => {
  return new Date(unixTimestamp * 1000).toISOString();
};

/**
 * Combine all scratchpad content into a structured context string
 */
const buildWorkflowContext = (scratchpads: Scratchpad[]): string => {
  if (scratchpads.length === 0) {
    return 'No scratchpads found in this workflow.';
  }

  let context = `Workflow contains ${scratchpads.length} scratchpad(s):\n\n`;

  scratchpads.forEach((scratchpad, index) => {
    context += `--- Scratchpad ${index + 1}: ${scratchpad.title} ---\n`;
    context += `Created: ${formatTimestamp(scratchpad.created_at)}\n`;
    context += `Updated: ${formatTimestamp(scratchpad.updated_at)}\n`;
    context += `Size: ${scratchpad.size_bytes} bytes\n\n`;
    context += `Content:\n${scratchpad.content}\n\n`;
    context += `--- End of ${scratchpad.title} ---\n\n`;
  });

  return context;
};

/**
 * Initialize OpenAI client with API key from environment
 */
const getOpenAIClient = (): OpenAI => {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  return new OpenAI({ apiKey });
};

/**
 * Extract workflow information using GPT model
 */
export const extractWorkflowInfoTool = (
  db: ScratchpadDatabase
): ToolHandler<ExtractWorkflowInfoArgs, ExtractWorkflowInfoResult> => {
  return async (args: ExtractWorkflowInfoArgs): Promise<ExtractWorkflowInfoResult> => {
    try {
      // Validate workflow exists
      const workflow = db.getWorkflowById(args.workflow_id);
      if (!workflow) {
        throw new Error(`Workflow with ID ${args.workflow_id} not found`);
      }

      // Get all scratchpads for this workflow
      const scratchpads = db.listScratchpads({ workflow_id: args.workflow_id });

      // Build context from scratchpads
      const workflowContext = buildWorkflowContext(scratchpads);

      // Prepare OpenAI client and model
      const client = getOpenAIClient();
      const model = args.model || 'gpt-5-nano';

      // Create extraction instructions for Response API using GPT-5 best practices
      const extractionInstructions = `<analysis_framework>
<role>Expert workflow analyzer specializing in development project analysis</role>
<core_objectives>
- Extract precise information from workflow scratchpads with zero hallucination
- Provide comprehensive, evidence-based analysis with detailed findings
- Reference specific scratchpad content to support all conclusions
- Maintain strict adherence to provided workflow content only
</core_objectives>
<analysis_principles>
- Base all findings strictly on provided scratchpad content
- Include specific references to scratchpad titles and sections
- Provide detailed, comprehensive responses without length constraints
- When information is unavailable, explicitly state "Not found in provided workflow content"
- Structure findings with clear headings, evidence, and logical flow
</analysis_principles>
</analysis_framework>`;

      const inputText = `${extractionInstructions}

<workflow_analysis>
<workflow_context>
${workflowContext}
</workflow_context>

<extraction_request>
${args.extraction_prompt}
</extraction_request>

<output_requirements>
- Analyze the workflow content comprehensively and extract the requested information
- Base all analysis strictly on the provided scratchpad content above
- Include specific references to scratchpad titles and relevant sections
- Provide detailed, structured responses with clear headings and evidence
- If specific information is not available in the workflow content, explicitly state this
- Structure your response with appropriate headings, bullet points, and clear organization
- Support all findings with direct references to the scratchpad content
</output_requirements>
</workflow_analysis>`;

      // Use Response API with model-specific parameters
      const apiParams: any = {
        model: model,
        input: inputText,
      };

      // Add model-specific parameters
      if (model.includes('gpt-5')) {
        // Use reasoning_effort parameter from args or default to 'medium'
        const reasoningEffort = args.reasoning_effort || 'medium';
        apiParams.reasoning = { effort: reasoningEffort };
      }

      const response = await client.responses.create(apiParams);

      const extractionResult = response.output_text || 'No response generated';

      // Return structured result
      return {
        workflow_id: args.workflow_id,
        extraction_result: extractionResult,
        model_used: model,
        scratchpads_processed: scratchpads.length,
        message: `Successfully extracted information from workflow ${args.workflow_id} using ${model} (processed ${scratchpads.length} scratchpad(s))`,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error(
            'OpenAI API configuration error: Please set OPENAI_API_KEY environment variable'
          );
        }
        if (error.message.includes('model')) {
          throw new Error(
            `OpenAI model error: ${error.message}. Please check if the model '${args.model || 'gpt-5-nano'}' is available.`
          );
        }
        throw new Error(`Failed to extract workflow information: ${error.message}`);
      }
      throw new Error(`Failed to extract workflow information: Unknown error`);
    }
  };
};
