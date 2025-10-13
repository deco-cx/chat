/**
 * Workflow Prompts for Resources 2.0
 *
 * This module contains comprehensive prompts and descriptions for workflow
 * creation, updating, and management using the Resources 2.0 system.
 */

export const WORKFLOW_CREATE_PROMPT = `Create a workflow with sequential code steps.

## Execution Pattern

Workflows consist of sequential code steps where each step can reference previous step outputs using @ syntax:

\`\`\`
Input → Step 1 → Step 2 → Step 3 → Output
\`\`\`

**Key Rules:**
1. **Each step has inputSchema, outputSchema, input, and execute code**
2. **Use @ references** in the input object to reference previous step outputs or workflow input
3. **@ References** are resolved before step execution
4. **Final step output** must match the workflow's output schema

## Step Structure

Each step must define:

\`\`\`json
{
  "name": "send-notification",
  "description": "Send a notification using the Slack API",
  "inputSchema": {
    "type": "object",
    "properties": {
      "channel": { "type": "string" },
      "message": { "type": "string" }
    },
    "required": ["channel", "message"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "timestamp": { "type": "string" }
    }
  },
  "input": {
    "channel": "@input.slackChannel",
    "message": "@process-data.output.formattedMessage"
  },
  "execute": "export default async function(input, ctx) { ... }",
  "dependencies": [{ "integrationId": "i:slack-123" }]
}
\`\`\`

## @ Reference Syntax

Use @ references to declaratively connect step inputs to outputs:

- **Workflow input**: \`@input.propertyName\`
- **Previous step output**: \`@<step-name>.output.propertyName\`
- **Nested properties**: \`@step-1.output.data.user.name\`

The system automatically resolves these references before executing each step.

## Execute Function

The execute function receives the **resolved input** (with @ references replaced by actual values):

\`\`\`javascript
export default async function(input, ctx) {
  // input already has @ references resolved
  // No need for ctx.readWorkflowInput() or ctx.readStepResult()
  
  // Call integration tools (must declare in dependencies array)
  const result = await ctx.env['i:slack-123'].send_message({
    channel: input.channel,
    text: input.message
  });
  
  // Return data matching outputSchema
  return { success: true, timestamp: new Date().toISOString() };
}
\`\`\`

**HTTP Requests:**
- \`fetch\` is NOT available in this environment
- To make HTTP requests, use the \`i:http\` integration with the \`HTTP_FETCH\` tool
- Example: \`await ctx.env['i:http'].HTTP_FETCH({ url: '...', method: 'GET' })\`
- Remember to add \`{ integrationId: 'i:http' }\` to dependencies

## Best Practices

1. **Define clear schemas** - inputSchema and outputSchema should be precise
2. **Use @ references** - Declaratively wire data flow between steps
3. **Keep steps focused** - Each step should do one thing well
4. **Use placeholders for integration IDs** - Validation errors will list available integrations
5. **Test incrementally** - Use stopAfter to test each step individually`;

export const WORKFLOW_UPDATE_PROMPT = `Update a workflow with sequential code steps using @ references.

## Execution Pattern Reminder

\`\`\`
Input → Step 1 → Step 2 → Step 3 → Output
\`\`\`

**Key Rules:**
1. **Each step has inputSchema, outputSchema, input, and execute code**
2. **Use @ references** to connect step inputs to previous outputs
3. **@ References are resolved** before step execution
4. **Final step output** must match workflow's output schema

## Update Guidelines

1. **Define clear schemas** - Update inputSchema and outputSchema as needed
2. **Use @ references** - Update the input object to wire data between steps
3. **Update execute code** - Remember that input is already resolved (no ctx.readStepResult needed)
4. **Update dependencies** - Add \`{ integrationId }\` if using ctx.env
5. **Test incrementally** - Use stopAfter to test each updated step

## @ Reference Examples

\`\`\`json
{
  "input": {
    "userId": "@input.userId",
    "previousResult": "@step-1.output.data",
    "nestedValue": "@step-2.output.user.email"
  }
}
\`\`\`

## Execute Function Signature

\`\`\`javascript
export default async function(input, ctx) {
  // input already has @ references resolved
  // ctx.env contains integration tools
  
  const result = await ctx.env['i:integration-id'].tool_name(input);
  return { success: true, data: result };
}
\`\`\`

**HTTP Requests:**
- \`fetch\` is NOT available in this environment
- To make HTTP requests, use the \`i:http\` integration with the \`HTTP_FETCH\` tool
- Example: \`await ctx.env['i:http'].HTTP_FETCH({ url: '...', method: 'GET' })\`
- Remember to add \`{ integrationId: 'i:http' }\` to dependencies`;

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
- Step definitions with @ references for data flow
- Execution statistics and timestamps`;

export const WORKFLOW_DELETE_PROMPT = `Delete a workflow from the workspace.

This will permanently remove the workflow file from the DECONFIG storage.
Use with caution as this action cannot be undone.`;

export const WORKFLOWS_START_WITH_URI_PROMPT = `Execute a workflow by URI with optional partial execution and state injection.

## Overview

This tool starts a workflow execution using a Resources 2.0 URI. Workflows are sequential automation processes consisting of code steps that use @ references to declaratively wire data between steps. Each workflow validates input against its schema and executes steps in order until completion or until stopped at a specified step.

## Parameters

### uri
The Resources 2.0 URI of the workflow to execute (e.g., rsc://workflow/my-workflow).

### input
The input data passed to the workflow. This data:
- Will be validated against the workflow's defined input schema
- Is accessible to steps via \`@input.propertyName\` references in their input objects
- Should match the structure expected by the workflow's input schema

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
- \`runId\`: Unique identifier for tracking this workflow execution
- \`error\`: Error message if workflow failed to start (validation errors, missing workflow, etc.)`;

export const WORKFLOWS_GET_STATUS_PROMPT = `Get the status and output of a workflow run.

This tool retrieves the current status and results of a workflow execution, including:
- Current execution status (pending, running, completed, failed)
- Results from completed steps
- Final workflow output (if completed)
- Error information (if failed)
- Execution logs and timing information

Use this tool to monitor workflow progress, retrieve results, or debug failed executions.`;
export const WORKFLOWS_START_PROMPT = `Execute a multi-step workflow with optional partial execution and state injection.

## Overview

This tool starts a workflow execution. Workflows are sequential automation processes consisting of code steps that use @ references to declaratively wire data between steps. Each workflow validates input against its schema and executes steps in order until completion or until stopped at a specified step.

## Parameters

### name
The identifier of the workflow to execute. This must match an existing workflow definition in the workspace.

### input
The input data passed to the workflow. This data:
- Will be validated against the workflow's defined input schema
- Is accessible to steps via \`@input.propertyName\` references in their input objects
- Should match the structure expected by the workflow's input schema

### stopAfter (Optional)
The name of the step where execution should halt. When specified:
- The workflow executes **up to and including** the named step
- Execution stops after the specified step completes
- Useful for debugging, testing individual steps, or partial workflow execution
- Example: If workflow has steps ["validate", "process", "notify"], setting \`stopAfter: "process"\` will run "validate" and "process" but skip "notify"

### state (Optional)
Pre-computed step results to inject into the workflow execution state. Format: \`{ "step-name": STEP_RESULT }\`

This allows you to:
- **Skip steps**: Provide expected outputs for steps you want to bypass
- **Resume workflows**: Continue from a specific point with known intermediate results  
- **Test workflows**: Inject mock data to test specific scenarios
- **Debug workflows**: Isolate problems by providing known good inputs to later steps

Example:
\`\`\`json
{
  "validate-input": { "isValid": true, "errors": [] },
  "fetch-data": { "records": [{"id": 1, "name": "test"}] }
}
\`\`\`

## Execution Flow

1. **Validation**: Input is validated against the workflow's input schema
2. **State Injection**: Any provided state results are loaded into the workflow context
3. **Step Execution**: Steps run sequentially, with @ references resolved before each step:
   - \`@input.property\` resolves to workflow input values
   - \`@step-name.output.property\` resolves to previous step outputs
   - Resolved input is passed to the execute function
4. **Stopping**: If \`stopAfter\` is specified, execution halts after that step completes
5. **Tracking**: Returns a \`runId\` for monitoring progress with \`WORKFLOWS_GET_STATUS\`

## Common Use Cases

- **Full Execution**: Run complete workflow from start to finish
- **Step-by-Step Debugging**: Use \`stopAfter\` to test each step individually
- **Workflow Resumption**: Use \`state\` to continue from a previous execution point
- **Testing with Mock Data**: Use \`state\` to inject test results for upstream steps
- **Partial Processing**: Stop at intermediate steps to inspect results before continuing

## Return Value

Returns an object with:
- \`runId\`: Unique identifier for tracking this workflow execution
- \`error\`: Error message if workflow failed to start (validation errors, missing workflow, etc.)`;
