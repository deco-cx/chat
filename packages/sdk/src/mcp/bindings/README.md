# Bindings

Bindings are a core concept for defining and enforcing standardized interfaces
that MCPs (Model Context Protocols) can implement. They provide a type-safe,
declarative way to specify what methods and schemas an integration (MCP) must
expose to be compatible with certain parts of the system, similar to how
TypeScript interfaces work.

## Purpose

- **Standardization:** Bindings define contracts (schemas and method names) that
  MCPs must implement to be considered compatible with a given integration
  point.
- **Type Safety:** Bindings leverage Zod schemas and TypeScript types to ensure
  correct data structures and method signatures.
- **Extensibility:** You can define new bindings for any use case, not just the
  built-in triggers.

## How Bindings Work

1. **Define a Binding:**\
   A binding is a list of required tool definitions (name, input/output schema).
2. **Implement the Binding:**\
   An MCP "implements" a binding by exposing all required tools with the correct
   names and schemas.
3. **Check Implementation:**\
   The system can check if an MCP or a set of tools implements a binding using
   helper functions.
4. **Typed Client:**\
   You can create a type-safe client for interacting with an MCP that implements
   a binding.

## Example: Trigger Bindings

- **Input Binding (`ON_AGENT_INPUT`):**\
  Used for MCPs that handle incoming events, such as webhooks.

These are defined in [`trigger.ts`](./trigger.ts) and exported for use.

## API

### binder.ts

- `bindingClient(binder)`\
  Creates a binding client for a given binding definition.
  - `.implements(connectionOrTools)` — Checks if a connection or tool list
    implements the binding.
  - `.forConnection(mcpConnection)` — Returns a type-safe client for calling the
    bound tools.

- `TriggerInputBinding`\
  Predefined binding for agent input triggers.

### utils.ts

- `Binding(binder)`\
  Utility for checking if a set of tools implements a binding (by name).

## Usage Example

```ts
import { TriggerInputBinding } from "./bindings/trigger.ts";

// Check if a connection implements the input trigger binding
const isImplemented = await TriggerInputBinding.implements(connection);

// Create a client for a connection that implements the binding
const triggerClient = TriggerInputBinding.forConnection(connection);
await triggerClient.ON_AGENT_INPUT({ payload: ..., callbacks: ... });
```

## Creating a New Binding

To create a new binding:

1. **Create a new file** in the `/bindings` folder (e.g., `my-binding.ts`).
2. **Define your binding** using the `Binder` type and Zod schemas for
   input/output:

```ts
import { z } from "zod/v3";
import type { Binder } from "../index.ts";

const myInputSchema = z.object({ ... });
const myOutputSchema = z.object({ ... });

export const MY_BINDING_SCHEMA = [{
  name: "MY_BINDING_METHOD" as const,
  inputSchema: myInputSchema,
  outputSchema: myOutputSchema,
}] as const satisfies Binder;
```

3. **Export your binding** in `index.ts`:

```ts
export * from "./my-binding.ts";
```

4. **Use your binding** in the UI or backend as needed.

## Using Bindings in the UI

Bindings are integrated into the UI to allow users to select integrations that
implement a specific binding. For example:

- The
  [`BindingSelector`](../../../apps/web/src/components/toolsets/binding-selector.tsx)
  component lets users pick an integration that implements a given binding. It
  uses the `Binding` utility to check if an integration's tools match the
  binding.
- The
  [`WebhookTriggerForm`](../../../apps/web/src/components/triggers/webhookTriggerForm.tsx)
  uses `BindingSelector` to let users select an integration for the webhook
  trigger, passing the `TRIGGER_INPUT_BINDING_SCHEMA` as the required binding.

This pattern allows you to:

- Ask the user to select an integration that implements a specific binding
  through the UI
- Ensure only compatible integrations are selectable

## Extending Bindings

You can define your own bindings by specifying the required tool names and
schemas, then use the same pattern to check and interact with MCPs that
implement them.

---

For more details, see the code in this folder and the UI components that consume
bindings.
