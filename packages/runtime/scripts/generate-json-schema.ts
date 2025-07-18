// heavily inspired by https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/scripts/generate-json-schema.ts
import { join } from "node:path";
import type { Config, Schema } from "ts-json-schema-generator";
import { createGenerator } from "ts-json-schema-generator";

const config: Config = {
  path: join(import.meta.dirname!, "../src/wrangler.ts"),
  type: "WranglerConfig",
  skipTypeCheck: true,
};

const applyFormattingRules = (schema: Schema) => {
  return { ...schema, allowTrailingCommas: true };
};

const schema = applyFormattingRules(
  createGenerator(config).createSchema(config.type),
);

Deno.writeTextFileSync(
  join(import.meta.dirname!, "../config-schema.json"),
  JSON.stringify(schema, null, 2),
);
