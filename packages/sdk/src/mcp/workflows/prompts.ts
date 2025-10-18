/**
 * Workflow Prompts for Resources 2.0
 *
 * This module contains comprehensive prompts and descriptions for workflow
 * creation, updating, and management using the Resources 2.0 system.
 */

export const WORKFLOW_CREATE_PROMPT = `Create a workflow when requested by the user.

## Execution Pattern

Workflows execute tool calls sequentially in steps, where **each step can call tools and reference previous steps results (with @refs resolved)**:

**Key Rules:**
1. **All steps are Tool Calls** - Each step is an ES module exporting an async function
2. **Each step receives resolved input** - The input parameter contains values with @refs already resolved
3. **Steps call tools via ctx.env** - Use bracket notation to access integration tools
4. **Output reusability** - The output of each step can be used by other steps in the workflow by referencing it with @refs. Example: step 1 returns { poem: 'Generated poem' }, step 2 can use { input: { poem: '@step-1.poem' } }

## Input Schema

The input schema is the schema of the input object that will be passed to the step. JSON Schema format.

**Example:**
\`\`\`json
{
  "cityName": { "type": "string", "description": "Name of the city" }
}
\`\`\`

## Output Schema

The output schema is the schema of the output object that will be returned by the step. JSON Schema format.

**Example:**
\`\`\`json
{ "poem": { "type": "string", "description": "Generated poem" } }
\`\`\`
## Execute Function

Steps (same as tool calls) export a default async function with signature \`(input, ctx)\`:

\`\`\`javascript
export default async function(input, ctx) {
  // input: Object with all @refs already resolved to actual values (example: input.poem)
  // ctx.env: Object to access integration tools
  
  const cityName = input.cityName; // Could be from @ref to previous step
  
  // ALWAYS wrap tool calls in try/catch
  try {
    const result = await ctx.env['i:ai-generation'].AI_GENERATE_OBJECT({
      model: 'anthropic:claude-sonnet-4-5',
      messages: [{ role: 'user', content: \`Generate poem about \${cityName}\` }],
      schema: { type: 'object', properties: { poem: { type: 'string' } } },
      temperature: 0.7
    });
    
    // CRITICAL: Return ALL properties from outputSchema
    // Check actual tool response structure - don't assume property names!
    return { 
      poem: result.object?.poem || '', 
    };
  } catch (error) {
    // On error, return ALL outputSchema properties with safe defaults
    return { 
      poem: '', 
      error: String(error)
    };
  }
}
\`\`\`

**Important Rules:**
1. **Function signature is \`(input, ctx)\`** - Input is first parameter, NOT \`(ctx)\` alone
2. **Return value MUST match outputSchema** - Include ALL properties, even if null/empty/error
3. **Always use try/catch** - Return safe defaults for all required properties on error
4. **Check tool response structure** - Use optional chaining (\`result?.property\`) and fallbacks

## Step Structure

Each step has this structure:

\`\`\`json
{
  "def": {
    "name": "generate-poem",
    "description": "Generate a poem about a city using AI",
    "execute": "export default async function(input, ctx) { ... }",
    "inputSchema": {
      "type": "object",
      "properties": {
        "cityName": { "type": "string", "description": "Name of the city" }
      },
      "required": ["cityName"]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "poem": { "type": "string" }
      }
    },
    "dependencies": [{ "integrationId": "i:ai-generation", "toolNames": ["AI_GENERATE_OBJECT"] }]
  },
  "input": {
    "cityName": "@previous-step.cityName"
  }
}
\`\`\`

## @Reference Resolution

Use @refs in the \`input\` field to reference previous steps results

**@refs are resolved BEFORE your function executes:**
- \`@stepId.fieldName\` - Reference previous step output field (example: \`@step-1.poem\`)
- By the time your function runs, all @refs are replaced with actual values
- You access these resolved values directly from the \`input\` parameter (example: \`input.poem\`)

**Example:**
\`\`\`json
{
  "def": {
    "name": "step-2",
    "execute": "export default async function(input, ctx) { return { result: input.poem.length }; }"
  },
  "input": {
    "poem": "@step-1.poem"
  }
}
\`\`\`

When step-2 executes, \`input.poem\` already contains the actual poem string from step-1.

## Common @Reference Errors

**Error: "Path not found in step result"**

This happens when your @ref points to a property that doesn't exist in the previous step's output.

**Example Problem:**
\`\`\`json
// Step 1 outputSchema says it returns { searchResult, originalQuery }
"outputSchema": {
  "properties": {
    "searchResult": { "type": "string" },
    "originalQuery": { "type": "string" }
  }
}

// But step 1 execute code only returns { originalQuery }
"execute": "... return { originalQuery: input.query };"

// Step 2 tries to reference the missing field
"input": { "searchResult": "@step-1.searchResult" }  // ❌ FAILS!
\`\`\`

**Solution:**
- Make sure your return statement includes ALL properties from outputSchema
- Use optional chaining and fallbacks: \`result?.content || ''\`
- Add try/catch to return safe defaults for all properties

\`\`\`javascript
// ✅ CORRECT: Returns ALL outputSchema properties
return {
  searchResult: result?.content || 'No result',
  originalQuery: input.query
};
\`\`\`

## Integration Tool Calls

**Built-in Tools:**
- Use \`ctx.env['i:ai-generation']\` for built-in AI generation tools

**HTTP Requests:**
- \`fetch\` is NOT available in this environment
- Use the \`i:http\` integration with the \`HTTP_FETCH\` tool
- Example: \`await ctx.env['i:http'].HTTP_FETCH({ url: '...', method: 'GET' })\`
- Remember to add \`{ integrationId: 'i:http' }\` to dependencies

**Integration IDs:**
- Use exact integration IDs like \`i:ai-generation\`, \`i:http\`
- Validation errors will show available integrations if an ID doesn't exist
- Always use bracket notation: \`ctx.env['integration-id']\`

## Best Practices

1. **Function signature is (input, ctx)** - Input is first parameter, already resolved
2. **Define complete schemas** - Both inputSchema and outputSchema with types and descriptions
3. **Use @refs in step.input field** - Not in the execute code
4. **Keep steps focused** - Each step should do one clear thing
5. **Use stopAfter parameter** to test steps incrementally
6. **CRITICAL: Return value MUST match outputSchema exactly** - Include ALL properties defined in outputSchema, even if null/empty
7. **Wrap tool calls in try/catch** - Always return an object with ALL outputSchema properties, use defaults on error`;

export const WORKFLOW_UPDATE_PROMPT = `Update a workflow while maintaining sequential tool call execution.
Only use this tool if you are updating multiple steps at once or properties of the workflow itself.

## Execution Pattern Reminder

**Key Rules:**
1. **Each step receives previous step's output as input** - @refs are resolved before execution - just declare how each step input should access a previous step's output (example: \`@stepId.fieldName.subfield\`)
2. **Steps call tools via ctx.env** - Integration tools accessed with bracket notation (example: \`ctx.env['i:ai-generation'].AI_GENERATE_OBJECT({ model: 'anthropic:claude-sonnet-4-5', messages: [{ role: 'user', content: 'Generate poem' }], schema: { type: 'object', properties: { poem: { type: 'string' } } }, temperature: 0.7 })\`)
3. **Return data matching outputSchema** - Each step's return becomes next step's input (example: \`return { poem: 'Generated poem' }\`) - next step could use { input: { poem: '@poem-generation-step.poem' } }
4. **Update dependencies** - Add \`{ integrationId }\` to dependencies array alongside used tool names if using ctx.env (example: \`[{ "integrationId": "i:ai-generation", "toolNames": ["AI_GENERATE_OBJECT"] }]\`)
5. **Always use try/catch** - Return safe defaults for all properties on error (example: \`return { poem: '', error: String(error) }\`)
6. **Test incrementally** - Use stopAfter to test each updated step (example: \`stopAfter: 'poem-generation-step'\`)

## Step Execute API

\`\`\`javascript
export default async function(input, ctx) {
  // input: Object matching step inputSchema
  // ctx.env: Object to access integration tools
  
  const poem = input.poem;
  
  try {
    const result = await ctx.env['i:ai-generation'].AI_GENERATE_OBJECT({
  } catch (error) {
    // On error, return ALL outputSchema properties with safe defaults
    return { 
      poem: '', 
      error: String(error)
    };
  }
}
\`\`\`

**Important Rules:**
1. **Function signature is \`(input, ctx)\`** - Input is first parameter
2. **Return value MUST match outputSchema** - Include ALL properties
3. **Always use try/catch** - Return safe defaults on error
4. **Use optional chaining** - Don't assume tool response structure

## Update Guidelines

1. **Use correct function signature** - \`async function(input, ctx)\` with input as first parameter
2. **CRITICAL: Return ALL outputSchema properties** - Every property in outputSchema must be in the return statement
3. **Match schemas** - Each step's outputSchema should match next step's inputSchema (or use @refs) - this is important for the workflow to be able to execute
4. **Update @refs in step.input** - Use \`@stepId.fieldName\` format. This is the input that will be passed to the step.
5. **Update dependencies** - Add \`{ integrationId, toolNames }\` to dependencies array if using ctx.env
6. **Always use try/catch** - Return safe defaults for all properties on error
7. **Test incrementally** - Use stopAfter to test each updated step
`;

export const WORKFLOW_SEARCH_PROMPT = `Search workflows in the workspace. 

Supports filtering by:
- Workflow title and description
- Workflow status (draft, active, inactive)
- Workflow tags and categories
- Author and version information

Use the 'term' parameter for text search across title, description, and tags.
Use the 'filters' parameter for structured filtering by status, category, etc.`;

export const WORKFLOW_READ_PROMPT = `Read a specific workflow by its Resources 2.0 URI.

Returns the complete workflow definition including:
- Workflow metadata (title, description, status, tags, etc.)
- Workflow definition with input/output schemas
- Step definitions (code steps with execute functions, schemas, and @refs)
- Execution statistics and timestamps`;

export const WORKFLOW_DELETE_PROMPT = `Delete a workflow from the workspace.

This will permanently remove the workflow file from the DECONFIG storage.
Use with caution as this action cannot be undone.`;

export const WORKFLOWS_START_WITH_URI_PROMPT = `Execute a workflow by URI with optional partial execution and state injection.

## Overview

This tool starts a workflow execution using a Resources 2.0 URI. Workflows are sequential automation processes consisting of code steps that execute in order. Each step receives the previous step's output as input (with @refs resolved), can call integration tools via ctx.env, and returns data for the next step. The workflow validates input against its schema and executes steps until completion or until stopped at a specified step.

## Parameters

### uri
The Resources 2.0 URI of the workflow to execute (e.g., rsc://workflow/my-workflow).

### input
The input data passed to the workflow. This data:
- Will be validated against the workflow's defined input schema
- Is accessible to steps via @refs: \`@stepId.fieldName\` in step.input fields
- Becomes the input to the first step of the workflow

### stopAfter (Optional)
The name of the step where execution should halt. When specified:
- The workflow executes **up to and including** the named step
- Execution stops after the specified step completes
- Useful for debugging, testing individual steps, or partial workflow execution

### state (Optional)
Pre-computed step results to inject into the workflow execution state. Format: \`{ "step-name": STEP_RESULT }\`

This allows you to:
- **Skip steps**: Provide expected outputs for steps you want to bypass
- **Resume workflows**: Continue from a specific point with known intermediate results  
- **Test workflows**: Inject mock data to test specific scenarios
- **Debug workflows**: Isolate problems by providing known good inputs to later steps

## Return Value

Returns an object with:
- \`runId\`: Unique identifier for tracking this workflow execution (legacy)
- \`uri\`: The Resources 2.0 URI of the workflow run (format: rsc://i:workflows-management/workflow_run/{runId})
- \`error\`: Error message if workflow failed to start (validation errors, missing workflow, etc.)

## Monitoring Workflow Execution

After starting a workflow, use the returned \`uri\` with **DECO_RESOURCE_WORKFLOW_RUN_READ** to monitor progress and retrieve results:
- The workflow_run resource includes status, current step, step results, logs, and timing information
- For running workflows, call DECO_RESOURCE_WORKFLOW_RUN_READ repeatedly to poll for updates
- The resource automatically refreshes with the latest execution state`;

export const WORKFLOW_RUN_READ_PROMPT = `Read the status and results of a workflow run using its Resources 2.0 URI.

## Overview

This tool retrieves comprehensive information about a workflow execution, including real-time status, step results, logs, and timing information. Use this after starting a workflow with DECO_WORKFLOW_START to monitor progress and retrieve results.

## Input

- **uri**: The Resources 2.0 URI of the workflow run (format: rsc://i:workflows-management/workflow_run/{runId})
  - This URI is returned by DECO_WORKFLOW_START when you start a workflow
  - You can also search for workflow runs using DECO_RESOURCE_WORKFLOW_RUN_SEARCH

## Return Value

Returns a workflow_run resource object with:

### Core Fields
- **status**: Current execution status ("pending", "running", "completed", "failed", "errored")
- **runId**: Unique identifier for this execution
- **workflowURI**: The URI of the workflow definition that was executed

### Execution Details
- **currentStep**: Name of the step currently executing (if status is "running")
- **stepResults**: Object mapping step names to their output values (for completed steps)
- **finalResult**: The final workflow output (if status is "completed")
- **partialResult**: Intermediate results from completed steps (if still running)

### Error Information
- **error**: Error message and details (if status is "failed" or "errored")
- **logs**: Array of log entries from step execution, including errors and warnings

### Timing
- **startTime**: Unix timestamp when the workflow started
- **endTime**: Unix timestamp when the workflow finished (if completed/failed)
- **created_at**: ISO 8601 timestamp when the run was created
- **updated_at**: ISO 8601 timestamp of the last status update

### Raw Data
- **workflowStatus**: Complete raw workflow status from Cloudflare Workflows (for advanced use cases)

## Usage Pattern

\`\`\`javascript
// 1. Start a workflow
const { uri } = await DECO_WORKFLOW_START({
  uri: "rsc://workflow/my-workflow",
  input: { userId: "123" }
});

// 2. Monitor execution
const run = await DECO_RESOURCE_WORKFLOW_RUN_READ({ uri });
console.log(run.data.status); // "running"
console.log(run.data.currentStep); // "step-2-process-data"

// 3. Poll until complete
while (run.data.status === "running" || run.data.status === "pending") {
  await sleep(2000);
  run = await DECO_RESOURCE_WORKFLOW_RUN_READ({ uri });
}

// 4. Get results
if (run.data.status === "completed") {
  console.log(run.data.finalResult);
} else {
  console.error(run.data.error);
  console.log(run.data.logs);
}
\`\`\`

## Common Use Cases

- **Monitor Progress**: Poll this tool to track workflow execution in real-time
- **Retrieve Results**: Get the final output once a workflow completes
- **Debug Failures**: Access error messages and logs when workflows fail
- **Inspect Steps**: View intermediate results from each completed step
- **Resume Workflows**: Use partialResult to continue from a checkpoint`;
