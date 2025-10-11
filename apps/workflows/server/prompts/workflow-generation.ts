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
4. code: ES module with export default async function (input, ctx) { ... }
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
  "code": "const city = input.city; // Will be resolved to actual value by runtime"
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
 * Working example
 */
export const WORKING_EXAMPLE = `
MANDATORY EXAMPLE - THIS IS VERIFIED TO WORK:
{
  "id": "step-1",
  "name": "Generate City Poem",
  "description": "Generate a poem about a city using AI",
  "code": "export default async function (input, ctx) {\\n  try {\\n    const schema = { type: 'object', properties: { poem: { type: 'string' } } };\\n    const ai = await ctx.env['i:workspace-management'].AI_GENERATE_OBJECT({\\n      model: 'anthropic:claude-sonnet-4-5',\\n      messages: [{ role: 'user', content: \`Write a beautiful poem about \${input.cityName}\` }],\\n      schema,\\n      temperature: 0.7\\n    });\\n    return { poem: ai.object.poem };\\n  } catch (error) {\\n    return { error: String(error) };\\n  }\\n}",
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
7. input - MUST have values for ALL inputSchema.properties
8. primaryIntegration - Integration ID
9. primaryTool - Tool name being called

IF YOU SKIP inputSchema, outputSchema, or input, THE SYSTEM WILL FAIL!
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
