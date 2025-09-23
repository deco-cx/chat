import { CHANNEL_BINDING_SCHEMA } from "./channels.ts";
import { RESOURCE_BINDING_SCHEMA } from "./resources.ts";
import { VIEW_BINDING_SCHEMA } from "./views.ts";

// Import new Resources 2.0 bindings function
import { createResourceV2Bindings } from "../resources-v2/bindings.ts";

export { type Binder } from "./binder.ts";
export * from "./channels.ts";
export * from "./utils.ts";
// should not export binder.ts because it is a server-side only file

// Re-export Resources 2.0 bindings function for convenience
export { createResourceV2Bindings };

export const WellKnownBindings = {
  Channel: CHANNEL_BINDING_SCHEMA,
  View: VIEW_BINDING_SCHEMA,
  Resources: RESOURCE_BINDING_SCHEMA,
  // Note: ResourcesV2 is not included here since it's a generic function
  // Use createResourceV2Bindings(dataSchema) directly for Resources 2.0
} as const;

export type WellKnownBindingsName = keyof typeof WellKnownBindings;
