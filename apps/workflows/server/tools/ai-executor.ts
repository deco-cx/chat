/**
 * AI-powered tool executor
 *
 * This file contains tools for using AI to dynamically execute other tools
 * based on natural language queries.
 */
import { createPrivateTool, createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "../main.ts";

/**
 * List all available tools from all integrations in the workspace
 * This is used to show users what tools they can call in their generated code
 */
export const createListAvailableToolsTool = (_env: Env) =>
  createTool({
    id: "LIST_AVAILABLE_TOOLS",
    description:
      "List all available tools from all integrations in the workspace for use in generated code",
    inputSchema: z.object({}),
    outputSchema: z.object({
      integrations: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().optional(),
          url: z.string().optional(),
          toolCount: z.number(),
          tools: z.array(
            z.object({
              name: z.string(),
              description: z.string().optional(),
            }),
          ),
        }),
      ),
      totalTools: z.number(),
      summary: z.string(),
    }),
    execute: async () => {
      try {
        // Use static catalog of known integrations
        // Based on discovery from mcp_integration_INTEGRATIONS_LIST
        const integrationsWithTools = [
          {
            id: "i:workspace-management",
            name: "Workspace Management",
            description: "Complete workspace API with 100+ tools",
            url: "https://api.decocms.com/lucis/default/mcp",
            toolCount: 20,
            tools: [
              {
                name: "AI_GENERATE_OBJECT",
                description: "Generate structured JSON with AI",
              },
              { name: "AI_GENERATE", description: "Generate text with AI" },
              { name: "DATABASES_RUN_SQL", description: "Execute SQL queries" },
              {
                name: "DATABASES_GET_META",
                description: "Get database metadata",
              },
              {
                name: "KNOWLEDGE_BASE_SEARCH",
                description: "Search knowledge base",
              },
              {
                name: "KNOWLEDGE_BASE_ADD_FILE",
                description: "Add file to knowledge base",
              },
              {
                name: "DECO_TOOL_RUN_TOOL",
                description: "Execute dynamic code",
              },
              { name: "AGENTS_LIST", description: "List agents" },
              { name: "AGENTS_CREATE", description: "Create agent" },
              { name: "FS_READ", description: "Read file from filesystem" },
              { name: "FS_WRITE", description: "Write file to filesystem" },
              { name: "FS_LIST", description: "List files" },
              { name: "DECO_WORKFLOW_START", description: "Start workflow" },
              {
                name: "DECO_WORKFLOW_GET_STATUS",
                description: "Get workflow status",
              },
              { name: "MODELS_LIST", description: "List AI models" },
              { name: "HOSTING_APPS_LIST", description: "List hosted apps" },
              { name: "DATABASES_GET_META", description: "Get database info" },
              { name: "AGENTS_CREATE", description: "Create AI agent" },
              { name: "GET_WALLET_ACCOUNT", description: "Get wallet balance" },
              { name: "PROMPTS_LIST", description: "List prompts" },
            ],
          },
          {
            id: "SELF",
            name: "App Tools",
            description: "Your own app tools",
            url: "",
            toolCount: 0,
            tools: [],
          },
        ];

        const totalTools = integrationsWithTools.reduce(
          (sum, i) => sum + i.toolCount,
          0,
        );

        const summary = `Found ${integrationsWithTools.length} integrations with ${totalTools} total tools. Key integrations: ${integrationsWithTools
          .slice(0, 3)
          .map((i) => i.name)
          .join(", ")}`;

        return {
          integrations: integrationsWithTools,
          totalTools,
          summary,
        };
      } catch (error) {
        console.error("Error listing integrations:", error);
        return {
          integrations: [],
          totalTools: 0,
          summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });

const AI_TOOL_GENERATION_SCHEMA = {
  type: "object",
  properties: {
    toolName: {
      type: "string",
      description: "A descriptive name for the generated tool",
    },
    toolDescription: {
      type: "string",
      description: "Description of what the tool does",
    },
    inputSchema: {
      type: "object",
      description: "JSON schema for the tool input",
    },
    outputSchema: {
      type: "object",
      description: "JSON schema for the tool output",
    },
    executeCode: {
      type: "string",
      description:
        "ES module code with default export function. MUST be in format: 'export default async function (input, ctx) { /* code */ }'. The function receives (input, ctx) where ctx.env.SELF provides access to tools.",
    },
    input: {
      type: "object",
      description: "The input parameters to pass to the tool",
      additionalProperties: true,
    },
    reasoning: {
      type: "string",
      description: "Brief explanation of what you're doing and why",
    },
  },
  required: [
    "toolName",
    "toolDescription",
    "inputSchema",
    "outputSchema",
    "executeCode",
    "input",
    "reasoning",
  ],
};

export const createAIToolExecutorTool = (env: Env) =>
  createPrivateTool({
    id: "AI_TOOL_EXECUTOR",
    description:
      "Use AI to determine which tool to call and generate its input based on a natural language query",
    inputSchema: z.object({
      query: z.string(),
    }),
    outputSchema: z.object({
      reasoning: z.string(),
      toolUri: z.string(),
      generatedInput: z.any(),
      result: z.any().optional(),
      error: z.string().optional(),
    }),
    execute: async ({ context }) => {
      // Use AI to generate the tool code dynamically
      const aiPrompt = `You are a tool code generator. Generate stateless code for DECO_TOOL_RUN_TOOL.

User request: "${context.query}"

**Function Signature:** \`export default async function (input, ctx) { ... }\`

**Available via ctx.env['i:workspace-management']** (use bracket notation!):
- **AI_GENERATE_OBJECT** - Generate structured JSON with AI
- **DATABASES_RUN_SQL** - Execute SQL queries (returns: response.result[0].results)
- **KNOWLEDGE_BASE_SEARCH** - Search knowledge base
- **INTEGRATIONS_LIST** - List integrations (context only, DON'T use in code!)
- **AGENTS_CREATE** - Create agents
- And 100+ more tools!

**Examples:**

AI Generation:
\`\`\`javascript
export default async function (input, ctx) {
  try {
    const schema = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] };
    const ai = await ctx.env['i:workspace-management'].AI_GENERATE_OBJECT({
      model: 'openai:gpt-4.1-mini',
      messages: [{ role: 'user', content: input.prompt }],
      schema,
      temperature: 0.3
    });
    return { answer: String(ai.object?.answer || '') };
  } catch (error) {
    return { answer: \`Error: \${String(error)}\` };
  }
}
\`\`\`

Database Query:
\`\`\`javascript
export default async function (input, ctx) {
  try {
    const sql = "SELECT COUNT(*) as count FROM todos";
    const response = await ctx.env['i:workspace-management'].DATABASES_RUN_SQL({ 
      sql, 
      params: [] 
    });
    // ✅ CORRECT: response.result[0].results (NOT response.result.result!)
    const count = response.result?.[0]?.results?.[0]?.count ?? 0;
    return { count: Number(count) };
  } catch (error) {
    return { count: 0 };
  }
}
\`\`\`

**CRITICAL Rules:**
- Bracket notation: \`ctx.env['i:workspace-management']\`
- Try/catch mandatory
- Handle nested results: response.result[0].results (use optional chaining!)
- NEVER write response.result.result - that's WRONG!
- SQLite only: Use sqlite_master, not information_schema
- Type coercion (Number(), String(), Boolean())
- Return matches outputSchema exactly
- CRITICAL: In catch, return ALL required properties with defaults!
  Example: catch { return { requiredField: [], error: String(error) } }

Return JSON with: toolName, toolDescription, inputSchema, outputSchema, executeCode, input, reasoning.`;

      const aiResponse = await env.AI_GATEWAY.AI_GENERATE_OBJECT({
        model: "openai:gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that generates executable JavaScript code for tools. Always provide valid, executable code.",
          },
          {
            role: "user",
            content: aiPrompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent code generation
        schema: AI_TOOL_GENERATION_SCHEMA,
      });
      console.log("AI Response:", JSON.stringify(aiResponse.object, null, 2));

      const toolName = String(aiResponse.object?.toolName);
      const toolDescription = String(aiResponse.object?.toolDescription);
      const inputSchema =
        (aiResponse.object?.inputSchema as Record<string, unknown>) || {};
      const outputSchema =
        (aiResponse.object?.outputSchema as Record<string, unknown>) || {};
      const executeCode = String(aiResponse.object?.executeCode);
      const generatedInput =
        (aiResponse.object?.input as Record<string, unknown>) || {};
      const reasoning = String(aiResponse.object?.reasoning);

      console.log("Generated Execute Code:", executeCode);

      if (!executeCode || !toolName) {
        throw new Error("Failed to generate tool code");
      }

      // Validate that executeCode is in the correct format
      if (!executeCode.includes("export default async function")) {
        console.error(
          "Invalid execute code format. Expected ES module with default export.",
        );
        throw new Error(
          "Generated code is not in the correct ES module format. Code must start with 'export default async function (input, ctx) {'",
        );
      }

      // Execute the tool using DECO_TOOL_RUN_TOOL
      try {
        console.log(
          "Executing tool with input:",
          JSON.stringify(generatedInput, null, 2),
        );

        const toolResult = await env.TOOLS.DECO_TOOL_RUN_TOOL({
          tool: {
            name: toolName,
            description: toolDescription,
            inputSchema,
            outputSchema,
            execute: executeCode,
          },
          input: generatedInput,
        });

        console.log(
          "Tool execution result:",
          JSON.stringify(toolResult, null, 2),
        );

        // Check if there was an error in the tool execution
        if (toolResult.error) {
          console.error("Tool execution error:", toolResult.error);
          return {
            reasoning,
            toolUri: `DYNAMIC::${toolName}`,
            generatedInput,
            result: undefined,
            error: JSON.stringify(toolResult.error),
          };
        }

        return {
          reasoning,
          toolUri: `DYNAMIC::${toolName}`,
          generatedInput,
          result: toolResult.result,
          error: undefined,
        };
      } catch (error) {
        console.error("Exception during tool execution:", error);
        return {
          reasoning,
          toolUri: `DYNAMIC::${toolName}`,
          generatedInput,
          result: undefined,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        };
      }
    },
  });

/**
 * Generate a tool specification with AI (step 1)
 * This tool returns the full tool spec for inspection before execution
 */
export const createGenerateToolSpecTool = (env: Env) =>
  createPrivateTool({
    id: "GENERATE_TOOL_SPEC",
    description:
      "Generate a complete tool specification using AI based on a natural language description",
    inputSchema: z.object({
      description: z
        .string()
        .describe("Natural language description of what the tool should do"),
    }),
    outputSchema: z.object({
      toolSpec: z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        inputSchema: z.record(z.any()),
        outputSchema: z.record(z.any()),
        executeCode: z.string(),
      }),
      reasoning: z.string(),
      suggestedInput: z.record(z.any()).optional(),
    }),
    execute: async ({ context }) => {
      const aiPrompt = `You are a tool specification generator. Based on the user's request, generate a complete tool specification.

User request: "${context.description}"

**IMPORTANT: How to call tools in your code:**

The function signature is: \`export default async function (input, ctx) { ... }\`

Where:
- \`input\`: Contains the validated input parameters matching the inputSchema
- \`ctx\`: Context object containing:
  - \`ctx.env\`: Environment with available integrations and tools

**Available Integrations via ctx.env:**

CRITICAL: Always use bracket notation: \`ctx.env['integration-id'].TOOL_NAME(args)\`

**Workspace Management** - \`ctx.env['i:workspace-management']\` (100+ tools available!)

Key Tools:
1. **AI_GENERATE_OBJECT** - Generate structured JSON with AI
   \`\`\`javascript
   await ctx.env['i:workspace-management'].AI_GENERATE_OBJECT({
     model: 'openai:gpt-4.1-mini',
     messages: [{ role: 'user', content: 'Your prompt' }],
     schema: { type: 'object', properties: { result: { type: 'string' } } },
     temperature: 0.7
   })
   // Returns: { object: {...}, usage: {...} }
   \`\`\`

2. **DATABASES_RUN_SQL** - Execute SQL queries
   \`\`\`javascript
   await ctx.env['i:workspace-management'].DATABASES_RUN_SQL({
     sql: 'SELECT * FROM todos',
     params: []
   })
   // Returns: { result: [{ results: [...] }] } (nested!)
   \`\`\`

3. **KNOWLEDGE_BASE_SEARCH** - Search knowledge base
   \`\`\`javascript
   await ctx.env['i:workspace-management'].KNOWLEDGE_BASE_SEARCH({
     query: 'search term',
     topK: 5,
     content: true
   })
   // Returns: array of search results
   \`\`\`

4. **INTEGRATIONS_LIST** - List all integrations (DON'T include in final code!)
5. **AGENTS_CREATE** - Create AI agents
6. **Many more** - Use appropriate tool for the task

**Examples:**

1. Simple utility tool (no tool calls needed):
\`\`\`javascript
export default async function (input, ctx) {
  const { number1, number2 } = input;
  const sum = number1 + number2;
  return { sum };
}
\`\`\`

2. Tool calling AI Gateway:
\`\`\`javascript
export default async function (input, ctx) {
  try {
    const schema = {
      type: 'object',
      properties: { quote: { type: 'string' } },
      required: ['quote']
    };
    
    const ai = await ctx.env['i:workspace-management'].AI_GENERATE_OBJECT({
      model: 'openai:gpt-4.1-mini',
      messages: [{ role: 'user', content: 'Give me a motivational quote' }],
      schema,
      temperature: 0.7
    });
    
    return { quote: String(ai.object?.quote || '') };
  } catch (error) {
    return { quote: \`Error: \${String(error)}\` };
  }
}
\`\`\`

3. Tool calling Database (SQLite):
\`\`\`javascript
export default async function (input, ctx) {
  try {
    const sql = "SELECT COUNT(*) as count FROM todos WHERE completed = 1";
    const response = await ctx.env['i:workspace-management'].DATABASES_RUN_SQL({ 
      sql, 
      params: [] 
    });
    // ✅ CORRECT: response.result[0].results[0] (NOT response.result.result!)
    const count = response.result?.[0]?.results?.[0]?.count ?? 0;
    return { completedCount: Number(count) };
  } catch (error) {
    return { completedCount: 0 };  // ✅ Returns required property with default
  }
}
\`\`\`

4. SQLite List Tables:
\`\`\`javascript
export default async function (input, ctx) {
  try {
    // ✅ SQLite: Use sqlite_master, not information_schema
    const sql = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
    const response = await ctx.env['i:workspace-management'].DATABASES_RUN_SQL({ 
      sql, 
      params: [] 
    });
    const tables = response.result?.[0]?.results?.map(row => row.name) || [];
    return { tables };
  } catch (error) {
    return { tables: [], error: String(error) };  // ✅ Required property + error
  }
}
\`\`\`

**Generate a tool specification with:**
1. **id**: A unique identifier in SCREAMING_SNAKE_CASE (e.g., "CALCULATE_SUM", "LIST_COMPLETED_TODOS")
2. **name**: A descriptive human-readable name
3. **description**: Clear description of what the tool does
4. **inputSchema**: JSON Schema object for inputs (use type, properties, required, etc.)
5. **outputSchema**: JSON Schema object for outputs
6. **executeCode**: Complete ES module code as a string

**CRITICAL Requirements for executeCode:**
- MUST start with \`export default async function (input, ctx) {\`
- MUST end with \`}\`
- The 'input' parameter contains validated data from inputSchema
- Access integrations via \`ctx.env['integration-id'].TOOL_NAME(params)\` with bracket notation
- Use async/await for all tool calls
- Return a JSON object matching the outputSchema
- Handle errors gracefully with try/catch
- Use console.log/warn/error for debugging

**Also provide:**
- **suggestedInput**: Example input object that matches the inputSchema
- **reasoning**: Brief explanation of the tool design and why you chose this approach

Return everything in JSON format.`;

      const aiResponse = await env.AI_GATEWAY.AI_GENERATE_OBJECT({
        model: "openai:gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that generates tool specifications with executable JavaScript code. Always provide valid, complete specifications.",
          },
          {
            role: "user",
            content: aiPrompt,
          },
        ],
        temperature: 0.3,
        schema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Tool ID in SCREAMING_SNAKE_CASE",
            },
            name: { type: "string", description: "Human-readable tool name" },
            description: { type: "string", description: "What the tool does" },
            inputSchema: {
              type: "object",
              description: "JSON Schema for input",
            },
            outputSchema: {
              type: "object",
              description: "JSON Schema for output",
            },
            executeCode: {
              type: "string",
              description: "Complete ES module code string",
            },
            suggestedInput: {
              type: "object",
              description: "Example input matching inputSchema",
            },
            reasoning: {
              type: "string",
              description: "Explanation of the tool design",
            },
          },
          required: [
            "id",
            "name",
            "description",
            "inputSchema",
            "outputSchema",
            "executeCode",
            "suggestedInput",
            "reasoning",
          ],
        },
      });

      const spec = aiResponse.object as any;

      if (!spec || !spec.executeCode || !spec.id) {
        throw new Error("Failed to generate valid tool specification");
      }

      // Validate executeCode format
      if (!spec.executeCode.includes("export default async function")) {
        throw new Error(
          "Generated code is not in the correct ES module format",
        );
      }

      return {
        toolSpec: {
          id: String(spec.id),
          name: String(spec.name),
          description: String(spec.description),
          inputSchema: spec.inputSchema as Record<string, any>,
          outputSchema: spec.outputSchema as Record<string, any>,
          executeCode: String(spec.executeCode),
        },
        reasoning: String(spec.reasoning),
        suggestedInput: spec.suggestedInput as Record<string, any>,
      };
    },
  });

/**
 * Execute a generated tool specification (step 2)
 */
export const createExecuteToolSpecTool = (env: Env) =>
  createPrivateTool({
    id: "EXECUTE_TOOL_SPEC",
    description:
      "Execute a previously generated tool specification with provided input",
    inputSchema: z.object({
      toolSpec: z.object({
        name: z.string(),
        description: z.string(),
        inputSchema: z.record(z.any()),
        outputSchema: z.record(z.any()),
        executeCode: z.string(),
      }),
      input: z.record(z.any()),
    }),
    outputSchema: z.object({
      result: z.any().optional(),
      error: z.string().optional(),
      success: z.boolean(),
    }),
    execute: async ({ context }) => {
      try {
        console.log("Executing tool spec:", context.toolSpec.name);
        console.log("With input:", JSON.stringify(context.input, null, 2));

        const toolResult = await env.TOOLS.DECO_TOOL_RUN_TOOL({
          tool: {
            name: context.toolSpec.name,
            description: context.toolSpec.description,
            inputSchema: context.toolSpec.inputSchema,
            outputSchema: context.toolSpec.outputSchema,
            execute: context.toolSpec.executeCode,
          },
          input: context.input,
        });

        console.log(
          "Tool execution result:",
          JSON.stringify(toolResult, null, 2),
        );

        if (toolResult.error) {
          return {
            result: undefined,
            error: JSON.stringify(toolResult.error),
            success: false,
          };
        }

        return {
          result: toolResult.result,
          error: undefined,
          success: true,
        };
      } catch (error) {
        console.error("Exception during tool execution:", error);
        return {
          result: undefined,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
          success: false,
        };
      }
    },
  });

/**
 * Public tool to run generated tools - can be called directly from MCP
 */
export const createRunGeneratedToolTool = (env: Env) =>
  createTool({
    id: "RUN_GENERATED_TOOL",
    description:
      "Execute a dynamically generated tool with provided specification and input",
    inputSchema: z.object({
      toolSpec: z.object({
        name: z.string().describe("Human-readable tool name"),
        description: z.string().describe("What the tool does"),
        inputSchema: z.record(z.any()).describe("JSON Schema for input"),
        outputSchema: z.record(z.any()).describe("JSON Schema for output"),
        executeCode: z
          .string()
          .describe(
            "Complete ES module code string starting with 'export default async function (input, ctx) {'",
          ),
      }),
      input: z.record(z.any()).describe("Input parameters to pass to the tool"),
    }),
    outputSchema: z.object({
      result: z.any().optional(),
      error: z.string().optional(),
      success: z.boolean(),
    }),
    execute: async ({ context }) => {
      try {
        console.log("RUN_GENERATED_TOOL - Executing:", context.toolSpec.name);
        console.log("With input:", JSON.stringify(context.input, null, 2));
        console.log("Execute code:", context.toolSpec.executeCode);

        const toolResult = await env.TOOLS.DECO_TOOL_RUN_TOOL({
          tool: {
            name: context.toolSpec.name,
            description: context.toolSpec.description,
            inputSchema: context.toolSpec.inputSchema,
            outputSchema: context.toolSpec.outputSchema,
            execute: context.toolSpec.executeCode,
          },
          input: context.input,
        });

        console.log(
          "Tool execution result:",
          JSON.stringify(toolResult, null, 2),
        );

        if (toolResult.error) {
          return {
            result: undefined,
            error: JSON.stringify(toolResult.error),
            success: false,
          };
        }

        return {
          result: toolResult.result,
          error: undefined,
          success: true,
        };
      } catch (error) {
        console.error("Exception during tool execution:", error);
        return {
          result: undefined,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        };
      }
    },
  });

// Export all AI executor tools
export const aiExecutorTools = [
  createListAvailableToolsTool,
  createAIToolExecutorTool,
  createGenerateToolSpecTool,
  createExecuteToolSpecTool,
  createRunGeneratedToolTool,
];
