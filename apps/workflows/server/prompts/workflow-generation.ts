/**
 * AI Prompts for Workflow Step Generation
 * Compartmentalized for easy editing and testing
 */

/**
 * Catalog of verified working tools
 */
export const AVAILABLE_TOOLS_CATALOG = `
VERIFIED WORKING TOOLS (Use These!):

1. AI_GENERATE_OBJECT - Generate structured JSON with AI
   Usage: ctx.env['i:workspace-management'].AI_GENERATE_OBJECT({
     model: 'anthropic:claude-sonnet-4-5',
     messages: [{ role: 'user', content: 'your prompt here' }],
     schema: { type: 'object', properties: { result: { type: 'string' } } },
     temperature: 0.7
   })
   Returns: { object: { result: "..." }, usage: {...} }
   Example: Generate poems, quotes, structured data

2. DATABASES_RUN_SQL - Execute SQL queries (SQLite database!)
   Usage: ctx.env['i:workspace-management'].DATABASES_RUN_SQL({
     sql: 'SELECT COUNT(*) as count FROM todos',
     params: []
   })
   Returns: { result: [{ results: [...] }] }
   CRITICAL: Response structure is response.result[0].results (NOT response.result.result!)
   Example: const results = response.result?.[0]?.results || [];
   
   SQLite Specific:
   - List tables: SELECT name FROM sqlite_master WHERE type='table'
   - NO information_schema (that's PostgreSQL!)
   - Table column name: 'name' (not 'table_name')
   - Quote table names: SELECT * FROM "tableName"
   
   Always use optional chaining and fallback to empty array

3. KNOWLEDGE_BASE_SEARCH - Search documents
   Usage: ctx.env['i:workspace-management'].KNOWLEDGE_BASE_SEARCH({
     query: 'search term',
     topK: 5
   })
   Returns: Array of documents
   Example: Search for specific documents

4. Simple JavaScript - No tool calls needed
   For: Math, string manipulation, data transformation
   Example: Sum numbers, format text, filter arrays

CRITICAL RULES:
- ALWAYS use bracket notation: ctx.env['i:workspace-management']
- ALWAYS wrap in try/catch
- ALWAYS return object matching outputSchema EXACTLY
- CRITICAL: In catch block, return ALL required properties with default values!
  Example: catch { return { requiredProp1: [], requiredProp2: {}, error: String(error) } }
- For AI: Use claude-sonnet-4-5 model
- For DB: Access response.result[0].results (with optional chaining!)
- For DB: NEVER write response.result.result - that's WRONG!
- For DB: SQLite only! Use sqlite_master, not information_schema
`;

/**
 * Required fields for generated steps
 */
export const STEP_FIELDS_REQUIREMENTS = `
YOU MUST GENERATE ALL FIELDS:
1. id: unique step ID (step-1, step-2, etc)
2. name: clear, human-readable name
3. description: what this step does
4. execute: ES module with export default async function (input, ctx) { ... }
5. inputSchema: COMPLETE JSON Schema with properties, types, descriptions, required fields
6. outputSchema: COMPLETE JSON Schema for the return value
7. input: COMPLETE input object with DEFAULT VALUES for all inputSchema fields
8. inputDescription: (OPTIONAL) Descriptions for where input values come from
9. primaryIntegration: which integration ID is used (e.g., "i:workspace-management")
10. primaryTool: which tool is called (e.g., "AI_GENERATE_OBJECT")
`;

/**
 * @refs handling guidelines with EXACT IDs
 */
export const AT_REF_GUIDELINES = `
@ REFERENCE HANDLING (CRITICAL - USE EXACT IDs!):
When objective references previous steps, YOU MUST use the EXACT step ID provided in "Previous steps available" section.

CORRECT @ref format:
- Use FULL step ID as shown: "@step_1759490947550_p9ugp5tmn.output.result"
- NEVER shorten to: "@step1" or "@step-1" (these IDs don't exist!)
- Always include path to field: ".output.result" or ".output.data"

Example:
If previousSteps shows:
  - ID: step_1759490947550_abc123
    Name: Generate City Name
    Reference as: @step_1759490947550_abc123.output

Then your input MUST use the EXACT ID:
{
  "input": { 
    "city": "@step_1759490947550_abc123.output.cityName"
  },
  "inputDescription": { 
    "city": "City name from previous step output" 
  },
  "execute": "const city = input.city; // Will be resolved to actual value by runtime"
}

WRONG examples (these will FAIL):
- "@step1.output" - NO! Use full ID
- "@step-1.output" - NO! Use full ID
- "@previous.output" - NO! Use full ID
`;

/**
 * Schema validation rules
 */
export const SCHEMA_VALIDATION_RULES = `
CRITICAL - inputSchema MUST have:
- "type": "object"
- "properties": { fieldName: { "type": "string", "description": "..." }, ... }
- "required": ["fieldName"]

CRITICAL - input MUST have:
- Default/example values for ALL fields in inputSchema
- Can use @refs with EXACT step IDs (see above)
- Must be a valid object matching inputSchema
`;

/**
 * Build context for selected tools with their schemas
 */
export function buildToolsContext(
  selectedTools: Array<{
    name: string; // Tool name (from extractMentionedTools)
    integrationId: string;
    integrationName: string;
    description?: string;
    inputSchema?: any;
    outputSchema?: any;
  }>,
): string {
  if (!selectedTools || selectedTools.length === 0) {
    return "";
  }

  return `
========================================
🔧 SELECTED TOOLS CONTEXT (IMPORTANT!)
========================================

The user has explicitly mentioned these tools in their prompt with @ syntax.
YOU MUST use these tools according to their exact signatures!

${selectedTools
  .map(
    (tool, idx) => `
${idx + 1}. ${tool.name} - ${tool.integrationName}
   ${tool.description || "No description available"}
   
   Integration ID: ${tool.integrationId}
   
   Input Schema:
   ${tool.inputSchema ? JSON.stringify(tool.inputSchema, null, 2) : "Not available"}
   
   Output Schema:
   ${tool.outputSchema ? JSON.stringify(tool.outputSchema, null, 2) : "Not available"}
   
   HOW TO CALL:
   const result = await ctx.env['${tool.integrationId}'].${tool.name}({
     // Input based on inputSchema above
   });
   
   CRITICAL: Use EXACT integration ID and tool name as shown!
`,
  )
  .join("\n---\n")}

RULES FOR SELECTED TOOLS:
1. If user mentions @tool-name, YOU MUST use that exact tool
2. Use the integration ID and tool name EXACTLY as shown above
3. CRITICAL: When calling MCP tools, your outputSchema MUST wrap the tool's output in this structure:
   {
     "type": "object",
     "properties": {
       "success": { "type": "boolean" },
       "result": { <PASTE THE TOOL'S OUTPUT SCHEMA HERE> },
       "error": { "type": "string" }
     },
     "required": ["success"]
   }
4. Your code should return: { success: true, result: toolResult } or { success: false, error: "..." }
5. NEVER invent a custom output schema that doesn't match the tool's actual output
6. ALWAYS wrap tool calls in try/catch
7. In catch block, return { success: false, error: String(error), result: null }

EXAMPLE for calling an MCP tool:
If THREADS_LIST has outputSchema: { threads: [], pagination: {} }
Then YOUR outputSchema should be:
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "result": {
      "type": "object",
      "properties": {
        "threads": { "type": "array" },
        "pagination": { "type": "object" }
      }
    },
    "error": { "type": "string" }
  },
  "required": ["success"]
}

And your code:
const result = await ctx.env['i:...'].THREADS_LIST(input);
return { success: true, result: result };

========================================
`;
}

/**
 * Working example
 */
export const WORKING_EXAMPLE = `
MANDATORY EXAMPLE - THIS IS VERIFIED TO WORK:
{
  "id": "step-1",
  "name": "Generate City Poem",
  "description": "Generate a poem about a city using AI",
  "execute": "export default async function (input, ctx) {\\n  try {\\n    const schema = { type: 'object', properties: { poem: { type: 'string' } } };\\n    const ai = await ctx.env['i:workspace-management'].AI_GENERATE_OBJECT({\\n      model: 'anthropic:claude-sonnet-4-5',\\n      messages: [{ role: 'user', content: \`Write a beautiful poem about \${input.cityName}\` }],\\n      schema,\\n      temperature: 0.7\\n    });\\n    return { poem: ai.object.poem };\\n  } catch (error) {\\n    return { error: String(error) };\\n  }\\n}",
  "inputSchema": {
    "type": "object",
    "properties": {
      "cityName": {
        "type": "string",
        "description": "Name of the city for the poem"
      }
    },
    "required": ["cityName"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "poem": { 
        "type": "string",
        "description": "The generated poem"
      }
    },
    "required": ["poem"]
  },
  "input": {
    "cityName": "Rio de Janeiro"
  },
  "primaryIntegration": "i:workspace-management",
  "primaryTool": "AI_GENERATE_OBJECT"
}
`;

/**
 * Critical warnings
 */
export const CRITICAL_WARNINGS = `
CRITICAL - ALL FIELDS ARE REQUIRED:
1. id - Generate unique ID
2. name - Human readable name
3. description - What it does
4. code - ES module with try/catch
5. inputSchema - MUST include "type", "properties", "required"
6. outputSchema - MUST include "type", "properties", "required"
   ⚠️ CRITICAL: When calling MCP tools, ALWAYS use this structure:
   {
     "type": "object",
     "properties": {
       "success": { "type": "boolean" },
       "result": { <COPY THE TOOL'S ACTUAL OUTPUT SCHEMA HERE> },
       "error": { "type": "string" }
     },
     "required": ["success"]
   }
7. input - MUST have values for ALL inputSchema.properties
8. primaryIntegration - Integration ID
9. primaryTool - Tool name being called

IF YOU SKIP inputSchema, outputSchema, or input, THE SYSTEM WILL FAIL!

⚠️ COMMON MISTAKE: DO NOT invent custom output properties when calling MCP tools!
   BAD:  { threads: [], count: 0, success: true }  ❌
   GOOD: { success: true, result: { threads: [], pagination: {} } }  ✅
`;

/**
 * Integration access rules
 */
export const BRACKET_NOTATION_RULES = `
BRACKET NOTATION ONLY:
- Use: ctx.env['i:workspace-management'].TOOL_NAME()
- Never: ctx.env.SELF or ctx.env.DECO_CHAT_WORKSPACE_API
`;

/**
 * Build complete prompt for GENERATE_STEP
 */
export function buildGenerateStepPrompt(
  objective: string,
  previousStepsContext: string,
): string {
  const parts = [
    `Generate a workflow step that accomplishes this objective: ${objective}`,
    "",
    AVAILABLE_TOOLS_CATALOG,
  ];

  if (previousStepsContext) {
    parts.push(previousStepsContext);
    parts.push("");
  }

  parts.push(
    STEP_FIELDS_REQUIREMENTS,
    "",
    AT_REF_GUIDELINES,
    "",
    SCHEMA_VALIDATION_RULES,
    "",
    WORKING_EXAMPLE,
    "",
    CRITICAL_WARNINGS,
    "",
    BRACKET_NOTATION_RULES,
  );

  return parts.join("\n");
}
