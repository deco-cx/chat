/**
 * Tool Resource V2 Prompts
 *
 * These prompts provide detailed descriptions for Resources 2.0 operations
 * on tools, including creation, execution, and management.
 */

export const TOOL_SEARCH_PROMPT = `Search tools in the code environment.

This operation allows you to find tools by name, description, or other metadata.
Tools are executable functions with JSON Schema validation that can be created,
modified, and executed in a secure environment.

Use this to discover available tools before creating new ones or to find existing tools
for modification or execution.`;

export const TOOL_READ_PROMPT = `Read a tool definition and its associated function code.

This operation retrieves the complete definition of a tool, including:
- Tool metadata (name, description)
- Input and output JSON schemas for validation
- The execute code (inline ES module)

The tool definition includes all necessary information to understand how to use
the tool and what data it expects and returns.`;

export const TOOL_CREATE_PROMPT = `Create a new tool with JSON Schema validation.

Create executable tools that can be run in a secure environment with
automatic input/output validation using JSON schemas.

Example tool creation:
{
  "name": "Greeting",
  "description": "Greet the user with a personalized message",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" }
    },
    "required": ["name"]
  },
  "outputSchema": {
    "type": "object", 
    "properties": {
      "greeting": { "type": "string" }
    },
    "required": ["greeting"]
  },
  "execute": "export default async function (input, ctx) { return { greeting: 'Hello, ' + input.name }; }"
}

The execute field must be inline ES module code (saved to /src/functions/{name}.ts)

The execute function signature must be:
async (input: typeof inputSchema, ctx: { env: Record<string, any> }): Promise<typeof outputSchema>

Tools can call other tools using ctx.env.{INTEGRATION_ID}.{TOOL_NAME}(args).`;

export const TOOL_UPDATE_PROMPT = `Update an existing tool definition.

Modify the metadata, schemas, or execution code of an existing tool.
This allows you to refine tool behavior, update validation schemas, or fix bugs
in the execution logic.

When updating the execute code, ensure it maintains the same function signature
and that any changes are compatible with the existing input/output schemas.`;

export const TOOL_DELETE_PROMPT = `Delete a tool from the code environment.

This operation removes both the tool definition and its associated function file
from the environment. Use this to clean up unused or obsolete tools.

Warning: This action cannot be undone. The tool and its function code will be
permanently removed from the environment.`;
