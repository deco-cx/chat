/**
 * Workflow Prompts for Resources 2.0
 *
 * This module contains comprehensive prompts and descriptions for workflow
 * creation, updating, and management using the Resources 2.0 system.
 */

export const WORKFLOW_CREATE_PROMPT = `Create a new workflow in the workspace using Resources 2.0.

## Overview

Workflows are powerful automation tools that execute a sequence of steps sequentially to accomplish complex tasks. Each workflow consists of:

- **Input Schema**: Defines the data structure and parameters required to start the workflow
- **Output Schema**: Defines the final result structure after all steps complete
- **Steps**: An ordered array of individual operations that run one after another (alternating between tool calls and code steps)

The workflow's final output is determined by the last step in the sequence, which should be a code step that aggregates and returns the desired result.

## Required Data Fields

The workflow data must include:
- **name**: A descriptive name for the workflow
- **definition**: Complete workflow definition with steps and schemas
- **status**: Workflow status (draft, active, inactive)

Optional fields:
- **description**: Additional description of the workflow
- **tags**: Array of tags for categorization
- **category**: Category for organizing workflows
- **version**: Workflow version (defaults to "1.0.0")
- **author**: Workflow author information

## Workflow Steps

Workflows alternate between two types of steps:

### 1. Tool Call Steps
Execute tools from integrations using the workflow input:
- **type**: "tool_call"
- **def**: Tool call step definition containing:
  - **name**: Unique identifier within the workflow
  - **description**: Clear explanation of the step's purpose
  - **options**: Configuration with retry/timeout settings and custom properties
  - **tool_name**: The name of the tool to call
  - **integration**: The integration ID of the integration that provides this tool

**Important**: The \`integration\` property must be set to the integration ID (format: \`i:<uuid>\`), not the integration name. To find the correct integration ID:
1. Use the \`integration_list\` tool to get available integrations
2. Look for the integration that provides the tool you need
3. Use the integration's ID (e.g., \`i:123e4567-e89b-12d3-a456-426614174000\`) in the \`integration\` property

Tool calls receive the workflow input directly. Use code steps before tool calls to transform the input as needed.

### 2. Code Steps
Transform data between tool calls:
- **type**: "code"
- **def**: Code step definition containing:
  - **name**: Unique identifier within the workflow
  - **description**: Clear explanation of the step's purpose
  - **execute**: ES module code with a default async function

### Code Step Execution Function
Each code step's execute function follows this pattern:
\`\`\`javascript
export default async function(ctx) {
  // ctx contains WellKnownOptions helper functions:
  // - await ctx.readWorkflowInput(): Returns the initial workflow input
  // - await ctx.readStepResult(stepName): Returns output from a previous step
  // - await ctx.sleep(name, duration): Sleeps for a specified duration
  // - await ctx.sleepUntil(name, date): Sleeps until a specified date or timestamp
  
  // Transform data between tool calls
  const input = await ctx.readWorkflowInput();
  const previousResult = await ctx.readStepResult('previous-step');
  
  // Your code logic here
  return transformedData;
}
\`\`\`

## Final Output

The workflow's final output is automatically determined by the last step in the sequence. This should be a code step that:
1. Aggregates data from previous steps using ctx.readStepResult(stepName)
2. Transforms the data to match the workflow's output schema
3. Returns the final result

## Best Practices

1. **Alternating Steps**: Design workflows to alternate between tool calls and code
2. **Final Code Step**: Always end with a code step that aggregates and returns the final result
3. **Input Transformation**: Use code steps before tool calls to transform workflow input as needed
4. **Integration Discovery**: Always use the \`integration_list\` tool to find the correct integration ID before creating tool_call steps
5. **Minimal Output**: Keep code step outputs minimal to improve performance
6. **Error Handling**: Use retry and timeout configurations appropriately for tool calls
7. **Schema Validation**: Define clear input/output schemas for type safety
8. **Step Independence**: Design steps to be testable in isolation
9. **Business Configuration**: Use options to expose tunable parameters for tool calls
10. **Sequential Execution**: Steps run in order - design accordingly
11. **Data Flow**: Use code to transform data between tool calls

The workflow definition will be validated against the existing workflow schema system.`;

export const WORKFLOW_UPDATE_PROMPT = `Update an existing workflow using Resources 2.0.

## Overview

You can update any part of the workflow:
- Workflow metadata (title, description, status, tags, etc.)
- Workflow definition (steps, schemas, etc.)
- Execution statistics

## Workflow Structure

Workflows are powerful automation tools that execute a sequence of steps sequentially to accomplish complex tasks. Each workflow consists of:

- **Input Schema**: Defines the data structure and parameters required to start the workflow
- **Output Schema**: Defines the final result structure after all steps complete
- **Steps**: An ordered array of individual operations that run one after another (alternating between tool calls and code steps)

## Step Types

### 1. Tool Call Steps
Execute tools from integrations using the workflow input:
- **type**: "tool_call"
- **def**: Tool call step definition containing:
  - **name**: Unique identifier within the workflow
  - **description**: Clear explanation of the step's purpose
  - **options**: Configuration with retry/timeout settings and custom properties
  - **tool_name**: The name of the tool to call
  - **integration**: The integration ID of the integration that provides this tool

**Important**: The \`integration\` property must be set to the integration ID (format: \`i:<uuid>\`), not the integration name. Use the \`integration_list\` tool to find the correct integration ID.

### 2. Code Steps
Transform data between tool calls:
- **type**: "code"
- **def**: Code step definition containing:
  - **name**: Unique identifier within the workflow
  - **description**: Clear explanation of the step's purpose
  - **execute**: ES module code with a default async function

### Code Step Context
Each code step's execute function has access to:
\`\`\`javascript
export default async function(ctx) {
  // ctx contains WellKnownOptions helper functions:
  // - await ctx.readWorkflowInput(): Returns the initial workflow input
  // - await ctx.readStepResult(stepName): Returns output from a previous step
  // - await ctx.sleep(name, duration): Sleeps for a specified duration
  // - await ctx.sleepUntil(name, date): Sleeps until a specified date or timestamp
  
  // Transform data between tool calls
  const input = await ctx.readWorkflowInput();
  const previousResult = await ctx.readStepResult('previous-step');
  
  // Your code logic here
  return transformedData;
}
\`\`\`

## Update Guidelines

When updating workflows:
1. **Schema Validation**: The updated workflow definition will be validated against the existing workflow schema system
2. **Step Consistency**: Ensure step names are unique and references are correct
3. **Integration IDs**: Verify integration IDs are still valid using \`integration_list\`
4. **Output Schema**: Ensure the final code step returns data matching the output schema
5. **Best Practices**: Follow the same best practices as workflow creation

The updated workflow definition will be validated against the existing workflow schema system.`;

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
- Step definitions (code and tool_call steps)
- Execution statistics and timestamps`;

export const WORKFLOW_DELETE_PROMPT = `Delete a workflow from the workspace.

This will permanently remove the workflow file from the DECONFIG storage.
Use with caution as this action cannot be undone.`;

export const WORKFLOWS_START_WITH_URI_PROMPT = `Execute a workflow by URI with optional partial execution and state injection.

## Overview

This tool starts a workflow execution using a Resources 2.0 URI. Workflows are sequential automation processes that consist of alternating steps between tool calls (calling integration tools) and code steps (data transformation). Each workflow validates input against its schema and executes steps in order until completion or until stopped at a specified step.

## Parameters

### uri
The Resources 2.0 URI of the workflow to execute (e.g., rsc://workflow/my-workflow).

### input
The input data passed to the workflow. This data:
- Will be validated against the workflow's defined input schema
- Is accessible to all steps via \`ctx.readWorkflowInput()\`
- Should match the structure expected by the workflow's first step

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

This tool starts a workflow execution. Workflows are sequential automation processes that consist of alternating steps between tool calls (calling integration tools) and code steps (data transformation). Each workflow validates input against its schema and executes steps in order until completion or until stopped at a specified step.

## Parameters

### name
The identifier of the workflow to execute. This must match an existing workflow definition in the workspace.

### input
The input data passed to the workflow. This data:
- Will be validated against the workflow's defined input schema
- Is accessible to all steps via \`ctx.readWorkflowInput()\`
- Should match the structure expected by the workflow's first step

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
3. **Step Execution**: Steps run sequentially, with each step having access to:
   - Original workflow input via \`ctx.readWorkflowInput()\`
   - Previous step results via \`ctx.readStepResult(stepName)\`
   - Injected state results (treated as if those steps already completed)
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
