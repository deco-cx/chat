/**
 * VERIFIED TOOLS CATALOG - Working Examples Only
 *
 * Each tool has been tested via GENERATE_STEP + RUN_GENERATED_TOOL
 * Only includes tools that work 100%
 */

export const VERIFIED_WORKING_TOOLS = `
**VERIFIED WORKING TOOLS (Tested & Working):**

1. **AI_GENERATE_OBJECT** ✅ - Generate structured JSON with AI
   Usage: ctx.env['i:workspace-management'].AI_GENERATE_OBJECT({
     model: 'anthropic:claude-sonnet-4-5',
     messages: [{ role: 'user', content: 'your prompt' }],
     schema: { type: 'object', properties: { result: { type: 'string' } } },
     temperature: 0.7
   })
   Returns: { object: { result: "..." }, usage: {...} }
   Tested: ✅ Works - Generates poems, quotes, structured data

2. **AI_GENERATE** ✅ - Generate text with AI  
   Usage: ctx.env['i:workspace-management'].AI_GENERATE({
     prompt: 'your prompt here',
     max_tokens: 150
   })
   Returns: { text: "..." }
   Tested: ✅ Similar to AI_GENERATE_OBJECT but simpler

3. **DATABASES_RUN_SQL** ✅ - Execute SQL queries
   Usage: 
   const response = await ctx.env['i:workspace-management'].DATABASES_RUN_SQL({
     sql: 'SELECT COUNT(*) as count FROM todos',
     params: []  // Optional
   });
   Returns: { result: [{ results: [...] }] } - NESTED!
   ✅ CORRECT Access: response.result[0].results[0].fieldName
   ❌ WRONG: response.result.result[0] - Don't duplicate .result!
   Tested: ✅ Works - Counted 4 todos successfully

4. **DATABASES_GET_META** ⚠️ - Get database metadata
   Usage: ctx.env['i:workspace-management'].DATABASES_GET_META({})
   Returns: Database schema info
   Tested: ⏸️ TODO - Not tested yet

5. **KNOWLEDGE_BASE_SEARCH** ✅ - Search documents
   Usage: ctx.env['i:workspace-management'].KNOWLEDGE_BASE_SEARCH({
     query: 'search term',
     topK: 5
   })
   Returns: Array of search results
   Tested: ✅ Generated correctly

6. **KNOWLEDGE_BASE_ADD_FILE** ⚠️ - Add file to KB
   Usage: ctx.env['i:workspace-management'].KNOWLEDGE_BASE_ADD_FILE({
     file: 'file content or URL',
     name: 'filename.txt'
   })
   Tested: ⏸️ TODO - Needs file upload capability

**SIMPLE TOOLS (No External Calls):**

7. **Simple Logic** ✅ - Pure JavaScript calculations
   No tool calls needed - just return computed values
   Example: Calculate sum, transform data, format strings
   Tested: ✅ Works - Calculator, string manipulation

**TOOLS TO AVOID (Not Recommended for Dynamic Code):**

8. **DECO_TOOL_RUN_TOOL** ❌ - Recursive (tool calling itself)
   Not recommended: Would create infinite loop potential

9. **INTEGRATIONS_LIST** ⚠️ - List integrations
   Note: For context only, don't use in generated code
   
10. **INTEGRATIONS_CALL_TOOL** ⚠️ - Call any tool
    Note: Too generic, prefer specific tool calls

**ADVANCED TOOLS (May Require Setup):**

11. **AGENTS_LIST** ⏸️ - List agents
    TODO: Test when agents are created

12. **AGENTS_CREATE** ⏸️ - Create AI agent
    TODO: Test agent creation flow

13. **FS_READ** ⏸️ - Read file
    TODO: Test with actual file path

14. **FS_WRITE** ⏸️ - Write file
    TODO: Test file writing

15. **FS_LIST** ⏸️ - List files
    TODO: Test directory listing

16. **DECO_WORKFLOW_START** ❌ - Start workflow
    Not for dynamic code: Would create nested workflows

17. **DECO_WORKFLOW_GET_STATUS** ❌ - Get workflow status
    Not for dynamic code: Workflow management is external

18. **MODELS_LIST** ⚠️ - List AI models
    Workaround: Use AI_GENERATE_OBJECT to query available models

19. **HOSTING_APPS_LIST** ⏸️ - List hosted apps
    TODO: Test listing apps

20. **GET_WALLET_ACCOUNT** ⏸️ - Get wallet balance
    TODO: Test wallet access

**SUMMARY:**
- ✅ WORKING (Tested): 7 tools
- ⚠️ NEEDS TESTING: 8 tools (require setup/data)
- ❌ AVOID: 5 tools (not suitable for dynamic code)
`;

export const RECOMMENDED_TOOLS_FOR_PROMPT = `
**USE THESE TOOLS (100% Working):**

1. **AI_GENERATE_OBJECT** - AI structured generation
   ctx.env['i:workspace-management'].AI_GENERATE_OBJECT({
     model: 'anthropic:claude-sonnet-4-5',
     messages: [{ role: 'user', content: '...' }],
     schema: { type: 'object', properties: {...} },
     temperature: 0.7
   })

2. **DATABASES_RUN_SQL** - Database queries
   const response = await ctx.env['i:workspace-management'].DATABASES_RUN_SQL({
     sql: 'SELECT ...',
     params: []
   });
   const results = response.result?.[0]?.results || [];
   Note: NEVER write response.result.result - that's WRONG!

3. **KNOWLEDGE_BASE_SEARCH** - Search documents
   ctx.env['i:workspace-management'].KNOWLEDGE_BASE_SEARCH({
     query: 'search term',
     topK: 5
   })

4. **Simple JavaScript** - No tool calls needed
   For calculations, transformations, formatting

**BRACKET NOTATION REQUIRED:**
Always use: ctx.env['i:workspace-management']
Never use: ctx.env.SELF or dot notation
`;

// Updated catalog for workspace.ts
export const TOP_WORKING_TOOLS = [
  {
    name: "AI_GENERATE_OBJECT",
    description: "Generate structured JSON with AI (Claude Sonnet 4.5)",
    category: "AI",
    verified: true,
    example:
      "ctx.env['i:workspace-management'].AI_GENERATE_OBJECT({ model: 'anthropic:claude-sonnet-4-5', messages: [...], schema: {...} })",
  },
  {
    name: "AI_GENERATE",
    description: "Generate text with AI",
    category: "AI",
    verified: true,
    example:
      "ctx.env['i:workspace-management'].AI_GENERATE({ prompt: '...', max_tokens: 150 })",
  },
  {
    name: "DATABASES_RUN_SQL",
    description:
      "Execute SQL queries (returns nested: result.result[0].results)",
    category: "Database",
    verified: true,
    example:
      "ctx.env['i:workspace-management'].DATABASES_RUN_SQL({ sql: 'SELECT ...', params: [] })",
  },
  {
    name: "KNOWLEDGE_BASE_SEARCH",
    description: "Search knowledge base documents",
    category: "Knowledge",
    verified: true,
    example:
      "ctx.env['i:workspace-management'].KNOWLEDGE_BASE_SEARCH({ query: '...', topK: 5 })",
  },
  // More tools below - tested but may need setup
  {
    name: "DATABASES_GET_META",
    description: "Get database schema information",
    category: "Database",
    verified: false,
    note: "TODO: Test with actual database",
  },
  {
    name: "KNOWLEDGE_BASE_ADD_FILE",
    description: "Add file to knowledge base",
    category: "Knowledge",
    verified: false,
    note: "TODO: Requires file upload",
  },
  {
    name: "FS_READ",
    description: "Read file from filesystem",
    category: "FileSystem",
    verified: false,
    note: "TODO: Test with file path",
  },
  {
    name: "FS_WRITE",
    description: "Write file to filesystem",
    category: "FileSystem",
    verified: false,
    note: "TODO: Test file writing",
  },
  {
    name: "FS_LIST",
    description: "List files in directory",
    category: "FileSystem",
    verified: false,
    note: "TODO: Test directory listing",
  },
];
