# AI Integration Tools

The AI Integration provides native tool calls for AI text and object generation with automatic wallet credit debiting.

## Available Tools

### AI_GENERATE_TEXT
Generate text responses using AI models.

**Input Schema:**
- `messages`: Array of conversation messages with `role` and `content`
- `model` (optional): AI model to use (defaults to `claude-3-5-sonnet-latest`)
- `maxTokens` (optional): Maximum tokens to generate
- `temperature` (optional): Temperature for generation (default 0.7)
- `maxSteps` (optional): Maximum steps for tool use

**Output:**
- `text`: Generated text
- `usage`: Token usage information
- `finishReason`: Reason for completion

### AI_GENERATE_OBJECT
Generate structured JSON objects using AI models.

**Input Schema:**
- `messages`: Array of conversation messages
- `schema`: JSON Schema for the expected output
- `model` (optional): AI model to use
- `maxTokens` (optional): Maximum tokens to generate
- `temperature` (optional): Temperature for generation

**Output:**
- `object`: Generated object matching the schema
- `usage`: Token usage information
- `finishReason`: Reason for completion

## Usage Examples

### From an Agent
```typescript
// Extract structured data from a PDF
const result = await callTool("i:ai-integration.AI_GENERATE_OBJECT", {
  messages: [
    { role: "system", content: "Extract invoice details from the following text" },
    { role: "user", content: pdfContent }
  ],
  schema: {
    type: "object",
    properties: {
      invoiceNumber: { type: "string" },
      date: { type: "string" },
      totalAmount: { type: "number" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            price: { type: "number" }
          }
        }
      }
    }
  }
});
```

### From a Custom UI
```typescript
// Using the SDK
const response = await MCPClient.forWorkspace(workspace)
  .AI_GENERATE_TEXT({
    messages: [
      { role: "user", content: "Summarize this document in 3 bullet points" }
    ],
    maxTokens: 500
  });
```

## Credit System

- All AI tool calls consume credits from the workspace wallet
- Credits are debited based on token usage (input + output tokens)
- If insufficient funds, the tool call will fail with an error
- Same pricing model as agent executions

## Model Support

Currently supports all models available through OpenRouter:
- Claude models (3.5 Sonnet, etc.)
- GPT models
- Other models available on OpenRouter

Future updates will allow configuring default models per workspace/user.