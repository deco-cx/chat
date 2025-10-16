import { useMutation } from "@tanstack/react-query";
import { ToolReference } from "../mcp/workflows/schemas";

interface GenerateStepInput {
  prompt: string;
  selectedTools: string[];
  previousSteps?: Array<{
    id: string;
    title: string;
  }>;
}

interface GenerateStepOutput {
  code: string;
  usedTools: ToolReference[];
}

/**
 * Clean integration ID to be a valid JavaScript identifier
 */
function cleanIntegrationId(id: string): string {
  // Remove prefixes like "i:" or "a:"
  let cleaned = id.replace(/^[ia]:/, "");

  // Replace invalid characters with underscores
  cleaned = cleaned.replace(/[^a-zA-Z0-9_]/g, "_");

  // Ensure it starts with a letter or underscore
  if (/^[0-9]/.test(cleaned)) {
    cleaned = "_" + cleaned;
  }

  return cleaned;
}

/**
 * Generate more realistic code based on the prompt
 */
function generateCodeFromPrompt(
  prompt: string,
  selectedTools: string[],
  previousSteps?: Array<{ id: string; title: string }>,
): string {
  const cleanedTools = selectedTools.map(cleanIntegrationId);

  // Analyze prompt for common patterns
  const isEmail = /email|mail|send|notify/i.test(prompt);
  const isData = /get|fetch|retrieve|load|read/i.test(prompt);
  const _isProcess = /process|transform|calculate|analyze/i.test(prompt);
  const isWrite = /save|store|write|update|create/i.test(prompt);

  let code = `export default async function(ctx) {
  // ${prompt}
  
  try {`;

  // Add previous step data access if needed
  if (previousSteps?.length) {
    code += `
    // Get data from previous step
    const previousResult = await ctx.getStepResult('${previousSteps[previousSteps.length - 1].id}');
    console.log('Previous step data:', previousResult);`;
  }

  // Add tool-specific code
  if (selectedTools.length > 0) {
    selectedTools.forEach((toolId, index) => {
      const cleanId = cleanedTools[index];
      const originalId = toolId;

      code += `
    
    // Access ${originalId} integration
    const ${cleanId} = ctx.env['${originalId}'];
    if (!${cleanId}) {
      throw new Error('Integration ${originalId} not found');
    }`;

      // Generate appropriate method calls based on prompt
      if (isEmail && toolId.includes("mail")) {
        code += `
    
    // Send email using ${originalId}
    const emailResult = await ${cleanId}.send({
      to: previousResult?.email || 'user@example.com',
      subject: 'Welcome to our platform',
      body: 'Thank you for joining us!',
      // TODO: Customize email parameters
    });
    console.log('Email sent:', emailResult);`;
      } else if (isData) {
        code += `
    
    // Fetch data using ${originalId}
    const data = await ${cleanId}.list({
      limit: 100,
      // TODO: Add query parameters
    });
    console.log('Fetched ${toolId} data:', data);`;
      } else if (isWrite) {
        code += `
    
    // Save data using ${originalId}
    const saveResult = await ${cleanId}.create({
      data: previousResult || {},
      // TODO: Add save parameters
    });
    console.log('Data saved:', saveResult);`;
      } else {
        code += `
    
    // Call ${originalId} integration
    // TODO: Replace with actual method and parameters
    const ${cleanId}Result = await ${cleanId}.execute({
      input: previousResult || {},
    });
    console.log('${originalId} result:', ${cleanId}Result);`;
      }
    });
  } else {
    // No tools selected, generate basic processing code
    code += `
    
    // Process data without external tools
    const processedData = {
      ...previousResult,
      processed: true,
      processedAt: new Date().toISOString(),
    };`;
  }

  // Add return statement
  code += `
    
    // Return result for next step
    return {
      success: true,
      timestamp: new Date().toISOString(),${
        selectedTools.length > 0
          ? selectedTools
              .map(
                (_, i) => `
      ${cleanedTools[i]}Data: ${cleanedTools[i]}Result,`,
              )
              .join("")
          : `
      data: processedData,`
      }
      message: 'Step completed successfully'
    };
    
  } catch (error) {
    console.error('Step execution failed:', error);
    throw error;
  }
}`;

  return code;
}

/**
 * Hook to generate workflow step code using AI
 * This is a mock implementation - actual implementation will call the AI service
 */
export function useGenerateWorkflowStep() {
  return useMutation<GenerateStepOutput, Error, GenerateStepInput>({
    mutationFn: async ({ prompt, selectedTools, previousSteps }) => {
      console.log("Generating step with:", {
        prompt,
        selectedTools,
        previousSteps,
      });

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Generate realistic code
      const code = generateCodeFromPrompt(prompt, selectedTools, previousSteps);

      // Create tool references with cleaned IDs
      const usedTools: ToolReference[] = selectedTools.map((toolId) => {
        // Try to extract a meaningful tool name from the prompt
        let toolName = "execute"; // default

        if (/send|email|notify/i.test(prompt)) {
          toolName = "send";
        } else if (/get|fetch|list|read/i.test(prompt)) {
          toolName = "list";
        } else if (/create|save|write|store/i.test(prompt)) {
          toolName = "create";
        } else if (/update|modify|edit/i.test(prompt)) {
          toolName = "update";
        } else if (/delete|remove/i.test(prompt)) {
          toolName = "delete";
        }

        return {
          integrationId: toolId,
          toolName,
          description: `Integration: ${toolId}`,
        };
      });

      return {
        code,
        usedTools,
      };
    },
  });
}
