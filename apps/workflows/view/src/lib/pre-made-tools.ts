/**
 * Pre-made tools that are ready to execute
 * These are complete tool specifications with executeCode
 */

export interface ToolSpec {
  id: string;
  name: string;
  description: string;
  category: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  executeCode: string;
  exampleInput: Record<string, any>;
}

export const PRE_MADE_TOOLS: ToolSpec[] = [
  // Simple Tools (No API calls)
  {
    id: "STRING_REVERSER",
    name: "String Reverser",
    description: "Reverse any text string",
    category: "Text",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to reverse" },
      },
      required: ["text"],
    },
    outputSchema: {
      type: "object",
      properties: {
        reversed: { type: "string" },
      },
      required: ["reversed"],
    },
    executeCode: `export default async function (input, ctx) {
  return { reversed: input.text.split('').reverse().join('') };
}`,
    exampleInput: { text: "Hello World" },
  },

  {
    id: "CALCULATOR",
    name: "Simple Calculator",
    description: "Add two numbers",
    category: "Math",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" },
      },
      required: ["a", "b"],
    },
    outputSchema: {
      type: "object",
      properties: {
        sum: { type: "number" },
      },
      required: ["sum"],
    },
    executeCode: `export default async function (input, ctx) {
  return { sum: input.a + input.b };
}`,
    exampleInput: { a: 42, b: 58 },
  },

  // Database Tools (via i:workspace-management)
  {
    id: "ADD_TODO",
    name: "Add Todo",
    description: "Add a new todo to the database",
    category: "Database",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Todo title" },
      },
      required: ["title"],
    },
    outputSchema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
      },
      required: ["success", "message"],
    },
    executeCode: `export default async function (input, ctx) {
  try {
    const { title } = input;
    
    const insertSql = "INSERT INTO todos (title, completed) VALUES (?, 0)";
    await ctx.env['i:workspace-management'].DATABASES_RUN_SQL({ 
      sql: insertSql,
      params: [title]
    });
    
    return {
      success: true,
      message: \`Todo "\${title}" added successfully!\`
    };
  } catch (error) {
    return {
      success: false,
      message: \`Error: \${String(error)}\`
    };
  }
}`,
    exampleInput: { title: "Buy groceries" },
  },

  {
    id: "LIST_TODOS",
    name: "List Todos",
    description: "List all todos from database",
    category: "Database",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max todos to return",
          default: 10,
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        todos: { type: "array" },
        count: { type: "number" },
      },
      required: ["todos", "count"],
    },
    executeCode: `export default async function (input, ctx) {
  try {
    const limit = input.limit || 10;
    const sql = \`SELECT id, title, completed FROM todos ORDER BY id DESC LIMIT \${limit}\`;
    const result = await ctx.env['i:workspace-management'].DATABASES_RUN_SQL({ sql });
    
    // Handle nested result structure
    const todos = (result?.result?.[0]?.results || []).map(row => ({
      id: row.id,
      title: row.title,
      completed: Boolean(row.completed)
    }));
    
    return { todos, count: todos.length };
  } catch (error) {
    return { todos: [], count: 0 };
  }
}`,
    exampleInput: { limit: 10 },
  },

  {
    id: "COUNT_TODOS",
    name: "Count Todos",
    description: "Count total todos in database",
    category: "Database",
    inputSchema: {
      type: "object",
      properties: {},
    },
    outputSchema: {
      type: "object",
      properties: {
        count: { type: "number" },
      },
      required: ["count"],
    },
    executeCode: `export default async function (input, ctx) {
  try {
    const sql = "SELECT COUNT(*) as count FROM todos";
    const result = await ctx.env['i:workspace-management'].DATABASES_RUN_SQL({ sql });
    const count = result?.result?.[0]?.results?.[0]?.count ?? 0;
    return { count: Number(count) };
  } catch (error) {
    return { count: 0 };
  }
}`,
    exampleInput: {},
  },

  {
    id: "TODO_ANALYTICS",
    name: "Todo Analytics",
    description: "Get completion statistics from todos",
    category: "Database",
    inputSchema: {
      type: "object",
      properties: {},
    },
    outputSchema: {
      type: "object",
      properties: {
        total: { type: "number" },
        completed: { type: "number" },
        pending: { type: "number" },
        completionRate: { type: "number" },
      },
      required: ["total", "completed", "pending", "completionRate"],
    },
    executeCode: `export default async function (input, ctx) {
  try {
    const sql = \`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending
      FROM todos
    \`;
    
    const result = await ctx.env['i:workspace-management'].DATABASES_RUN_SQL({ sql });
    const row = result?.result?.[0]?.results?.[0] || { total: 0, completed: 0, pending: 0 };
    
    const completionRate = row.total > 0 
      ? Math.round((row.completed / row.total) * 100) 
      : 0;
    
    return {
      total: Number(row.total),
      completed: Number(row.completed),
      pending: Number(row.pending),
      completionRate
    };
  } catch (error) {
    return { total: 0, completed: 0, pending: 0, completionRate: 0 };
  }
}`,
    exampleInput: {},
  },

  // AI Tools (via i:workspace-management)
  {
    id: "AI_QUOTE_GENERATOR",
    name: "AI Quote Generator",
    description: "Generate motivational quote with AI",
    category: "AI",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Topic for the quote",
          default: "motivation",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        quote: { type: "string" },
      },
      required: ["quote"],
    },
    executeCode: `export default async function (input, ctx) {
  try {
    const topic = input.topic || 'motivation';
    const schema = {
      type: 'object',
      properties: { quote: { type: 'string' } },
      required: ['quote']
    };
    
    const ai = await ctx.env['i:workspace-management'].AI_GENERATE_OBJECT({
      model: 'openai:gpt-4.1-mini',
      messages: [{ 
        role: 'user', 
        content: \`Give me a short motivational quote about \${topic} in under 15 words\` 
      }],
      schema,
      temperature: 0.7
    });
    
    return { quote: String(ai.object?.quote || 'Stay motivated!') };
  } catch (error) {
    return { quote: \`Error: \${String(error)}\` };
  }
}`,
    exampleInput: { topic: "coding" },
  },

  {
    id: "TEXT_SUMMARIZER",
    name: "Text Summarizer",
    description: "Summarize text using AI",
    category: "AI",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to summarize" },
        maxWords: {
          type: "number",
          description: "Max words in summary",
          default: 50,
        },
      },
      required: ["text"],
    },
    outputSchema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        wordCount: { type: "number" },
      },
      required: ["summary", "wordCount"],
    },
    executeCode: `export default async function (input, ctx) {
  try {
    const { text, maxWords = 50 } = input;
    
    const schema = {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary']
    };
    
    const ai = await ctx.env['i:workspace-management'].AI_GENERATE_OBJECT({
      model: 'openai:gpt-4.1-mini',
      messages: [{
        role: 'user',
        content: \`Summarize in \${maxWords} words or less:\\n\\n\${text}\`
      }],
      schema,
      temperature: 0.3
    });
    
    const summary = String(ai.object?.summary || '');
    const wordCount = summary.split(' ').length;
    
    return { summary, wordCount };
  } catch (error) {
    return { summary: \`Error: \${String(error)}\`, wordCount: 0 };
  }
}`,
    exampleInput: {
      text: "Artificial intelligence is transforming software development. Machine learning models can now understand context, generate code, and debug problems automatically.",
      maxWords: 20,
    },
  },

  // Combined Tools (DB + AI via i:workspace-management)
  {
    id: "TODO_SUMMARY",
    name: "Todo Summary with AI",
    description: "Get todos from DB and summarize with AI",
    category: "Combined",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max todos to fetch",
          default: 5,
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        count: { type: "number" },
        summary: { type: "string" },
      },
      required: ["count", "summary"],
    },
    executeCode: `export default async function (input, ctx) {
  try {
    const limit = input.limit || 5;
    
    // Fetch todos from database
    const sql = \`SELECT title FROM todos WHERE completed = 0 LIMIT \${limit}\`;
    const dbResult = await ctx.env['i:workspace-management'].DATABASES_RUN_SQL({ sql });
    
    // Handle nested result structure
    const todos = dbResult?.result?.[0]?.results || [];
    
    if (todos.length === 0) {
      return { count: 0, summary: 'No pending todos found' };
    }
    
    // Summarize with AI
    const schema = {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary']
    };
    
    const todoList = todos.map(t => t.title).join(', ');
    
    const ai = await ctx.env['i:workspace-management'].AI_GENERATE_OBJECT({
      model: 'openai:gpt-4.1-mini',
      messages: [{
        role: 'user',
        content: \`Summarize these tasks in one sentence: \${todoList}\`
      }],
      schema,
      temperature: 0.3
    });
    
    return { count: todos.length, summary: String(ai.object?.summary || '') };
  } catch (error) {
    return { count: 0, summary: \`Error: \${String(error)}\` };
  }
}`,
    exampleInput: { limit: 5 },
  },

  // Knowledge Base Tools (via i:workspace-management)
  {
    id: "KNOWLEDGE_BASE_SEARCH",
    name: "Knowledge Base Search",
    description: "Search workspace knowledge base",
    category: "Knowledge",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        topK: { type: "number", description: "Number of results", default: 5 },
      },
      required: ["query"],
    },
    outputSchema: {
      type: "object",
      properties: {
        resultCount: { type: "number" },
        query: { type: "string" },
      },
      required: ["resultCount", "query"],
    },
    executeCode: `export default async function (input, ctx) {
  try {
    const { query, topK = 5 } = input;
    
    const result = await ctx.env['i:workspace-management'].KNOWLEDGE_BASE_SEARCH({
      query,
      topK,
      content: true
    });
    
    return { 
      resultCount: result?.length || 0,
      query
    };
  } catch (error) {
    return { resultCount: 0, query: input.query };
  }
}`,
    exampleInput: { query: "AI tools", topK: 5 },
  },

  // Workspace Tools (via i:workspace-management)
  {
    id: "LIST_HOSTED_APPS",
    name: "List Hosted Apps",
    description: "List all hosted apps in workspace",
    category: "Workspace",
    inputSchema: {
      type: "object",
      properties: {},
    },
    outputSchema: {
      type: "object",
      properties: {
        apps: { type: "array" },
        count: { type: "number" },
      },
      required: ["apps", "count"],
    },
    executeCode: `export default async function (input, ctx) {
  try {
    const result = await ctx.env['i:workspace-management'].HOSTING_APPS_LIST({});
    const apps = result?.items || [];
    
    return { 
      apps: apps.map(app => ({
        slug: app.slug,
        entrypoint: app.entrypoint
      })),
      count: apps.length
    };
  } catch (error) {
    return { apps: [], count: 0 };
  }
}`,
    exampleInput: {},
  },

  {
    id: "GET_WALLET_INFO",
    name: "Get Wallet Balance",
    description: "Get current wallet balance",
    category: "Workspace",
    inputSchema: {
      type: "object",
      properties: {},
    },
    outputSchema: {
      type: "object",
      properties: {
        balance: { type: "string" },
        balanceExact: { type: "string" },
      },
      required: ["balance", "balanceExact"],
    },
    executeCode: `export default async function (input, ctx) {
  try {
    const result = await ctx.env['i:workspace-management'].GET_WALLET_ACCOUNT({});
    
    return { 
      balance: result?.balance || '0',
      balanceExact: result?.balanceExact || '0'
    };
  } catch (error) {
    return { balance: '0', balanceExact: '0' };
  }
}`,
    exampleInput: {},
  },

  {
    id: "LIST_AI_MODELS",
    name: "List AI Models",
    description: "List available AI models in workspace",
    category: "Workspace",
    inputSchema: {
      type: "object",
      properties: {
        excludeDisabled: {
          type: "boolean",
          description: "Exclude disabled models",
          default: true,
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        models: { type: "array" },
        count: { type: "number" },
      },
      required: ["models", "count"],
    },
    executeCode: `export default async function (input, ctx) {
  try {
    const result = await ctx.env['i:workspace-management'].MODELS_LIST({
      excludeDisabled: input.excludeDisabled !== false
    });
    
    const models = result?.items || [];
    
    return { 
      models: models.map(m => ({
        id: m.id,
        name: m.name,
        model: m.model
      })),
      count: models.length
    };
  } catch (error) {
    return { models: [], count: 0 };
  }
}`,
    exampleInput: { excludeDisabled: true },
  },
];

export const TOOL_CATEGORIES = [
  "All",
  "Text",
  "Math",
  "Database",
  "AI",
  "Knowledge",
  "Workspace",
  "Combined",
];
