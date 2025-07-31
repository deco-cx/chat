import { CHANNEL_BINDING_SCHEMA } from "./channels.ts";
import { VIEW_BINDING_SCHEMA } from "./views.ts";
import { AGENT_BINDING_SCHEMA } from "./agents.ts";

export { type Binder } from "./binder.ts";
export * from "./channels.ts";
export * from "./utils.ts";
// should not export binder.ts because it is a server-side only file

export const WellKnownBindings = {
  Channel: CHANNEL_BINDING_SCHEMA,
  View: VIEW_BINDING_SCHEMA,
  Agent: AGENT_BINDING_SCHEMA,
} as const;

export type WellKnownBindingsName = keyof typeof WellKnownBindings;
