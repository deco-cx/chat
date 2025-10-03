const DECO_WORKER_RUNTIME_VERSION = "0.4.0";
export const HOSTING_APP_DEPLOY_PROMPT = `Deploy multiple TypeScript files that use Wrangler for bundling and deployment to Cloudflare Workers. You must provide a package.json file with the necessary dependencies and a wrangler.toml file matching the Workers for Platforms format. Use 'main_module' instead of 'main', and define bindings using the [[bindings]] array, where each binding is a table specifying its type and properties. To add custom Deco bindings, set type = "MCP" in a binding entry (these will be filtered and handled automatically).

Set 'preview: true' to create a preview deployment that won't replace the production version. Preview deployments get their own unique URL but are not promoted to production routes.

Common patterns:
1. Use a package.json file to manage dependencies:
   // package.json
   {
     "name": "@deco/workers-example",
     "private": true,
     "version": "0.0.0",
     "type": "module",
     "scripts": {
       "dev": "deco dev",
       "gen": "deco gen > env.gen.ts",
       "setup": "npm i -g deco-cli",
       "deploy": "wrangler deploy --dry-run --outdir ./dist && deco deploy ./dist"
     },
     "dependencies": {
       "@cloudflare/workers-types": "^4.20250617.0",
       "@deco/mcp": "npm:@jsr/deco__mcp@^0.5.6",
       "@deco/workers-runtime": "npm:@jsr/deco__workers-runtime@^${DECO_WORKER_RUNTIME_VERSION}",
       "@mastra/core": "0.12.1",
       "zod": "^3.25.67"
     },
     "devDependencies": {
       "wrangler": "^4.13.2"
     },
     "engines": {
       "node": ">=20.0.0"
     }
   }

2. Import dependencies directly in your files:
   // main.ts
   import { z } from "zod/v3";
   import { withRuntime } from "@deco/workers-runtime";

3. Use wrangler.toml to configure your app:
   // wrangler.toml
   name = "app-slug"
   compatibility_date = "2025-06-17"
   main_module = "main.ts"
   kv_namespaces = [
     { binding = "TODO", id = "06779da6940b431db6e566b4846d64db" }
   ]
   routes = [
     { pattern = "my.example.com", custom_domain = true }
   ]

   browser = { binding = "MYBROWSER" }

   [triggers]
   # Schedule cron triggers:
   crons = [ "*/3 * * * *", "0 15 1 * *", "59 23 LW * *" ]

   # This is required when using the Workflow class
  [[durable_objects.bindings]]
  name = "DECO_CHAT_WORKFLOW_DO"
  class_name = "Workflow"

  [[durable_objects.bindings]]
  name = "MY_DURABLE_OBJECT"
  class_name = "MyDurableObject"

  # This is required when using the Workflow class
  [[migrations]]
  tag = "v1"
  new_classes = ["Workflow", "MyDurableObject"]

  [ai]
  binding = "AI"

  [[queues.consumers]]
  queue = "queues-web-crawler"
  max_batch_timeout = 60

  [[queues.producers]]
  queue = "queues-web-crawler"
  binding = "CRAWLER_QUEUE"

  [[deco.bindings]]
  type = "MCP"
  name = "MY_BINDING"
  value = "INTEGRATION_ID"

   # You can add any supported binding type as per Workers for Platforms documentation.
4. You should always surround the user fetch with the withRuntime function.

import { withRuntime } from "@deco/workers-runtime";

const { Workflow, ...workerAPIs } = withRuntime({
  fetch: async (request: Request, env: any) => {
    return new Response("Hello from Cloudflare Workers!");
  }
})
export { Workflow };
export default workerAPIs;

You must use the Workers for Platforms TOML format for wrangler.toml. The bindings supports all standard binding types (ai, analytics_engine, assets, browser_rendering, d1, durable_object_namespace, hyperdrive, kv_namespace, mtls_certificate, plain_text, queue, r2_bucket, secret_text, service, tail_consumer, vectorize, version_metadata, etc). For Deco-specific bindings, use type = "MCP".
For routes, only custom domains are supported. The user must point their DNS to the script endpoint. $SCRIPT.deco.page using DNS-Only. The user needs to wait for the DNS to propagate before the app will be available.

Example of files deployment:
[
  {
    "path": "package.json",
    "content": \`{
  "name": "@deco/workers-example",
  "version": "0.0.0",
  "type": "module",
  "dependencies": {
    "@cloudflare/workers-types": "^4.20250617.0",
    "@deco/workers-runtime": "npm:@jsr/deco__workers-runtime@^0.2.18",
    "@mastra/core": "0.12.1",
    "zod": "^3.25.67"
  },
  "devDependencies": {
    "wrangler": "^4.13.2"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}\`
  },
  {
    "path": "main.ts",
    "content": \`
      import { z } from "zod/v3";
      import { withRuntime } from "@deco/workers-runtime";

      const { Workflow, ...workerAPIs } = withRuntime({
        fetch: async (request: Request, env: any) => {
          return new Response("Hello from Cloudflare Workers!");
        }
      })
      export { Workflow };
      export default workerAPIs;
    \`
  },
  {
    "path": "wrangler.toml",
    "content": \`
name = "app-slug"
compatibility_date = "2025-06-17"
main_module = "main.ts"
kv_namespaces = [
  { binding = "TODO", id = "06779da6940b431db6e566b4846d64db" }
]
routes = [
  { pattern = "my.example.com", custom_domain = true }
]

browser = { binding = "MYBROWSER" }

[triggers]
# Schedule cron triggers:
crons = [ "*/3 * * * *", "0 15 1 * *", "59 23 LW * *" ]

# This is required when using the Workflow class
[[durable_objects.bindings]]
name = "DECO_CHAT_WORKFLOW_DO"
class_name = "Workflow"

[[durable_objects.bindings]]
name = "MY_DURABLE_OBJECT"
class_name = "MyDurableObject"

# This is required when using the Workflow class
[[migrations]]
tag = "v1"
new_classes = ["Workflow", "MyDurableObject"]

[ai]
binding = "AI"

[[queues.consumers]]
queue = "queues-web-crawler"
max_batch_timeout = 60

[[queues.producers]]
queue = "queues-web-crawler"
binding = "CRAWLER_QUEUE"

[[deco.bindings]]
type = "MCP"
name = "MY_BINDING"
value = "INTEGRATION_ID"
\`
  }
]

Important Notes:
- You can access the app workspace by accessing env.DECO_CHAT_WORKSPACE
- You can access the app script slug by accessing env.DECO_CHAT_APP_SLUG
- Token and workspace can be used to make authenticated requests to the Deco API under https://api.decocms.com
- Always use Cloudflare Workers syntax with export default and proper fetch handler signature
- When using template literals inside content strings, escape backticks with a backslash (\\) or use string concatenation (+)
- You must include a package.json file with the @deco/workers-runtime dependency
- Dependencies are managed through npm packages in package.json, not npm: or jsr: specifiers
- Wrangler will handle the bundling process using the dependencies defined in package.json`;
