// heavily inspired by https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/scripts/generate-json-schema.ts
import { join, dirname } from "node:path";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createGenerator } from "ts-json-schema-generator";
import type { Config, Schema } from "ts-json-schema-generator";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: Config = {
  path: join(__dirname, "../src/wrangler.ts"),
  type: "WranglerConfig",
  skipTypeCheck: true,
};

const applyFormattingRules = (schema: Schema) => {
  return { ...schema, allowTrailingCommas: true };
};

const schema = applyFormattingRules(
  createGenerator(config).createSchema(config.type),
);

writeFileSync(
  join(__dirname, "../config-schema.json"),
  JSON.stringify(schema, null, 2),
);
