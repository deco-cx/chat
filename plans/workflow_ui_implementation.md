# Workflow UI Implementation Plan - AI-Powered Linear Canvas

## Executive Summary

Based on the meeting transcript and the Excalidraw diagram, this document
outlines the implementation of a revolutionary workflow UI that uses AI to
generate code in real-time. The system features a linear, slide-based navigation
where users describe what they want in natural language, and AI generates
complete workflow steps with all necessary code and tool integrations.

## Core Innovation

### Key Differentiators

1. **Self-Contained Steps**: Each AI-generated step is completely autonomous -
   it fetches its own data, processes it, and returns results. There's NO
   "between steps" concept - each step knows exactly what it needs
2. **Natural Language First**: Users describe intentions, not implementations
3. **Single Step Type**: Unified model that can execute any code
4. **Real-time Code Generation**: AI creates complete, working code instantly
5. **Semantic Workflows**: Focus on business logic, not technical details

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
├─────────────────────────────────────────────────────────┤
│  Linear Canvas │ Step Creator │ Step Viewer │ Navigator │
├─────────────────────────────────────────────────────────┤
│                    SDK (Hooks & State)                   │
├─────────────────────────────────────────────────────────┤
│                   MCP API (Backend)                      │
├─────────────────────────────────────────────────────────┤
│  AI Generator │ Sandbox Runner │ Tool Environment       │
└─────────────────────────────────────────────────────────┘
```

## Phase 1: Backend Foundation (Week 1)

### 1.1 Centralized Type Definitions

**File**: `packages/sdk/src/mcp/workflows/types.ts`

```typescript
import { z } from "zod/v3";
import type { JSONSchema7 } from "json-schema";

// ============= Core Types =============
// All workflow types in one central location for reuse

// JSON Schema type for input/output schemas
export type JSONSchema = JSONSchema7;

// Tool reference with integration
export interface ToolReference {
  integrationId: string; // Clean ID without prefix
  toolName: string;
  inputSchema?: JSONSchema;
  outputSchema?: JSONSchema;
  description?: string;
}

// Step execution result
export interface StepExecutionResult {
  executedAt: string; // ISO date
  value: unknown; // Result data
  error?: string; // Error message if failed
  duration?: number; // Execution time in ms
}

// Form state for workflow inputs
export interface WorkflowFormState {
  stepId: string;
  values: Record<string, unknown>;
  isDirty: boolean;
  isValid: boolean;
  errors: Record<string, string>;
}

// ============= Zod Schemas =============

export const WorkflowStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  prompt: z.string(), // User's original prompt
  code: z.string(), // Generated ES module code
  inputSchema: z.custom<JSONSchema>(), // Typed JSON Schema
  outputSchema: z.custom<JSONSchema>(), // Typed JSON Schema
  usedTools: z.array(z.custom<ToolReference>()), // Typed tool references
  logoUrl: z.string().optional(),
  config: z.object({
    retry: z.number().default(3),
    timeout: z.number().default(30000),
  }).optional(),
});

export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  steps: z.array(WorkflowStepSchema),

  // Workflow execution state
  executionState: z.record(
    z.string(),
    z.custom<StepExecutionResult>(),
  ),

  // Form states for each step that requires input
  formStates: z.record(
    z.string(),
    z.custom<WorkflowFormState>(),
  ).optional(),

  // Global workflow input schema (if needed)
  inputSchema: z.custom<JSONSchema>().optional(),

  // Workflow metadata
  createdAt: z.string(),
  updatedAt: z.string(),
  lastExecutedAt: z.string().optional(),
});

// ============= Type Exports =============

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;

// Runtime types for execution
export interface StepContext {
  readWorkflowInput: () => unknown;
  getStepResult: (stepId: string) => unknown;
  env: Record<string, Record<string, Function>>;
}

export interface ExecutionContext {
  workflow: Workflow;
  currentStepId: string;
  state: Record<string, StepExecutionResult>;
  formValues?: Record<string, unknown>;
}
```

**Implementation Steps**:

1. Create completely new schema (no migration needed)
2. Build new WorkflowRunner from scratch
3. Wipe old workflow data from database
4. Start fresh with simplified model

### 1.2 AI Step Generation Tool

**File**: `packages/sdk/src/mcp/workflows/ai-step-generator.ts`

```typescript
export const generateWorkflowStep = createTool({
  name: "WORKFLOW_GENERATE_STEP",
  description: "Generate a workflow step from natural language",
  inputSchema: z.object({
    prompt: z.string(),
    selectedTools: z.array(z.string()),
    previousSteps: z.array(z.object({
      id: z.string(),
      title: z.string(),
      outputSchema: z.object({}).passthrough(),
    })).optional(),
  }),
  handler: async ({ prompt, selectedTools, previousSteps }, context) => {
    const aiPrompt = buildStepGenerationPrompt(
      prompt,
      selectedTools,
      previousSteps,
    );

    const generatedStep = await context.env.DECO_AI.GENERATE_OBJECT({
      prompt: aiPrompt,
      schema: UnifiedStepSchema,
    });

    // Validate generated code
    await validateStepCode(generatedStep.code, context);

    return generatedStep;
  },
});
```

**AI Prompt Template**:

```javascript
const buildStepGenerationPrompt = (prompt, tools, previousSteps) => `
You must generate a complete, self-contained workflow step.

IMPORTANT: Each step is AUTONOMOUS. It must:
1. Fetch all data it needs (from tools or previous steps)
2. Process/transform that data as needed
3. Return a clear result

USER OBJECTIVE: ${prompt}

AVAILABLE TOOLS (use these to fetch data, send messages, etc.):
${tools.map((t) => `- ctx.env.${t.integration}.${t.name}(args)`).join("\n")}

${
  previousSteps
    ? `
PREVIOUS STEPS (access via ctx.getStepResult("step-id")):
${
      previousSteps.map((s) =>
        `- "${s.id}": ${s.title}
  Output: ${JSON.stringify(s.outputSchema)}`
      ).join("\n")
    }
`
    : ""
}

Generate:
1. title: Clear, descriptive title
2. description: What this step accomplishes
3. inputSchema: JSON Schema for inputs
4. outputSchema: JSON Schema for outputs
5. code: ES module with default async function that:
   - Uses ctx.readWorkflowInput() for initial input
   - Uses ctx.getStepResult("step-id") for previous steps
   - Calls tools via ctx.env.INTEGRATION.tool_name(args)
   - Returns data matching outputSchema

The code must be complete, handle errors, and work immediately.
`;
```

### 1.3 Tool Discovery AI

**TODO**: This solution is not future-proof. We need to rely on an agent to
dynamically search tools using searchTools to fulfill this request without
wasting a lot of tokens.

**File**: `packages/sdk/src/mcp/workflows/tool-discovery.ts`

```typescript
export const discoverRelevantTools = createTool({
  name: "WORKFLOW_DISCOVER_TOOLS",
  description: "AI discovers relevant tools for a task",
  inputSchema: z.object({
    userObjective: z.string(),
    availableTools: z.array(ToolDefinitionSchema),
  }),
  handler: async ({ userObjective, availableTools }, context) => {
    // Use AI with 3-second debounce
    const relevantTools = await context.env.DECO_AI.GENERATE_OBJECT({
      prompt: `
        User wants to: ${userObjective}
        
        Available tools:
        ${availableTools.map((t) => `${t.name}: ${t.description}`).join("\n")}
        
        Return the most relevant tool IDs for this task.
      `,
      schema: z.array(z.string()),
    });

    return relevantTools;
  },
});
```

## Phase 2: Execution Engine (Week 2)

### 2.1 New Step Runner (From Scratch)

**Context**: Previously, we had a complex system with different step types
(mapper, tool_call) and manual wiring between steps. The old system required
users to explicitly define how data flows between steps, which was error-prone
and hard to understand.

**The Revolution**: Our new Step Runner treats EVERY step as autonomous
JavaScript code that runs in a sandbox. Each step is a complete mini-program
that:

- Fetches its own data (from tools or previous steps)
- Processes that data however it needs
- Returns a result that can be used by future steps

**How It Works**:

1. User describes what they want in natural language
2. AI generates complete JavaScript code that implements the logic
3. Code runs in QuickJS sandbox with access to tools and previous results
4. Result is stored and available for next steps

**File**: `packages/sdk/src/workflows/step-runner.ts`

```typescript
import type {
  ExecutionContext,
  StepContext,
  StepExecutionResult,
  Workflow,
  WorkflowStep,
} from "@deco/sdk/mcp/workflows/types";

// Brand new implementation - no legacy code
export class WorkflowStepRunner {
  async executeStep(
    step: WorkflowStep,
    workflow: Workflow,
    context: AppContext,
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();

    try {
      // Get form values if this step has an input schema
      const formValues = step.inputSchema
        ? workflow.formStates?.[step.id]?.values
        : undefined;

      // Create strongly typed execution context
      const stepContext: StepContext = {
        readWorkflowInput() {
          return formValues || workflow.inputSchema
            ? workflow.formStates?.["workflow-input"]?.values
            : {};
        },
        getStepResult(stepId: string) {
          const result = workflow.executionState[stepId];
          if (!result) {
            throw new Error(`Step ${stepId} has not been executed yet`);
          }
          return result.value;
        },
        env: await createToolEnvironment(context),
      };

      // Execute in sandbox
      const evaluation = await evalCodeAndReturnDefaultHandle(
        step.code,
        context.runtimeId,
      );

      try {
        const result = await callFunction(
          evaluation.ctx,
          evaluation.defaultHandle,
          undefined,
          stepContext,
          {},
        );

        // Create typed execution result
        const executionResult: StepExecutionResult = {
          executedAt: new Date().toISOString(),
          value: result,
          duration: Date.now() - startTime,
        };

        // Update workflow state
        workflow.executionState[step.id] = executionResult;

        return executionResult;
      } finally {
        // Clean up the evaluation handle
        await evaluation.dispose();
      }
    } catch (error) {
      // Create error result
      const errorResult: StepExecutionResult = {
        executedAt: new Date().toISOString(),
        value: null,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };

      workflow.executionState[step.id] = errorResult;
      throw error;
    }
  }
}
```

### 2.2 Tool Environment Builder

**Purpose**: Creates the `ctx.env` object that gives sandboxed code access to
all available tools in the project. This is what allows generated code to call
`ctx.env.gmail.sendEmail()` or `ctx.env.sheets.readSheet()`.

**How It Works**:

1. Fetches all integrations (Gmail, Sheets, Notion, custom APIs, etc.)
2. For each integration, fetches its available tools
3. Creates async functions that proxy calls to the actual MCP backend
4. Returns an object where keys are integration IDs and values are tool
   functions

**Critical Detail**: The integration IDs in the UI have prefixes (`i_123`,
`a_456`) but the env uses clean IDs without prefixes. This code must be
handled correctly.

```typescript
async function createToolEnvironment(context: AppContext) {
  const { items: integrations } = await context.client.INTEGRATIONS_LIST({});

  const env: Record<string, Record<string, Function>> = {};

  for (const integration of integrations) {
    // CRITICAL: Remove prefix from integration ID for env key
    const cleanId = integration.id.replace(/^[ia]_/, "");

    // Fetch tools for this integration
    const { tools } = await context.client.TOOLS_LIST({
      connection: integration.connection,
    });

    env[cleanId] = {};

    for (const tool of tools) {
      // Create a proxy function that calls the actual tool
      env[cleanId][tool.name] = async (args: unknown) => {
        // Validate input against schema if available
        if (tool.inputSchema) {
          // TODO: Add validation
        }

        const response = await context.client.INTEGRATIONS_CALL_TOOL({
          connection: integration.connection,
          params: { name: tool.name, arguments: args },
        });

        if (response.isError) {
          throw new Error(response.error);
        }

        return response.structuredContent || response.content;
      };
    }
  }

  // NOTE: All tools come from integrations - no special "DECO_AI" tools
  // If we need AI capabilities, they should be added as a proper integration

  return env;
}
```

## Phase 3: Frontend Components (Week 3)

### 3.0 Auto-Generated Forms with React Hook Form

**File**: `apps/web/src/components/workflow-builder/auto-form.tsx`

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { jsonSchemaToZod } from "@/utils/json-schema-to-zod";
import type { JSONSchema, WorkflowStep } from "@deco/sdk/mcp/workflows/types";

interface AutoFormProps {
  schema: JSONSchema;
  onSubmit: (values: unknown) => void;
  defaultValues?: Record<string, unknown>;
  stepId: string;
}

/**
 * Automatically generates a form from a JSON Schema
 * Used for workflow input forms and step configuration
 */
export function AutoForm(
  { schema, onSubmit, defaultValues, stepId }: AutoFormProps,
) {
  // Convert JSON Schema to Zod schema for validation
  const zodSchema = useMemo(() => jsonSchemaToZod(schema), [schema]);

  // Initialize React Hook Form with Zod resolver
  const form = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues: defaultValues || generateDefaultValues(schema),
    mode: "onBlur", // Validate on blur for better UX
  });

  // Generate form fields from schema
  const fields = useMemo(() => generateFieldsFromSchema(schema), [schema]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {fields.map((field) => (
          <FormField
            key={field.name}
            control={form.control}
            name={field.name}
            render={({ field: formField, fieldState }) => (
              <FormItem>
                <FormLabel className="text-lg font-medium">
                  {field.label}
                  {field.required && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </FormLabel>

                {field.description && (
                  <FormDescription className="text-base text-gray-600">
                    {field.description}
                  </FormDescription>
                )}

                <FormControl>
                  {renderFieldComponent(field, formField, fieldState)}
                </FormControl>

                <FormMessage className="text-sm" />
              </FormItem>
            )}
          />
        ))}

        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="w-full h-14 text-lg font-semibold"
        >
          {form.formState.isSubmitting ? <Spinner className="mr-2" /> : null}
          Continue
        </Button>
      </form>
    </Form>
  );
}

/**
 * Renders the appropriate field component based on schema type
 */
function renderFieldComponent(
  field: FieldDefinition,
  formField: any,
  fieldState: any,
) {
  const errorClass = fieldState.error ? "border-destructive" : "";

  switch (field.type) {
    case "string":
      if (field.enum) {
        return (
          <Select {...formField}>
            <SelectTrigger className={`h-12 text-base ${errorClass}`}>
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {field.enum.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      if (field.format === "textarea") {
        return (
          <Textarea
            {...formField}
            placeholder={field.placeholder}
            className={`min-h-[120px] text-base ${errorClass}`}
          />
        );
      }

      return (
        <Input
          {...formField}
          type={field.format === "email" ? "email" : "text"}
          placeholder={field.placeholder}
          className={`h-12 text-base ${errorClass}`}
        />
      );

    case "number":
      return (
        <Input
          {...formField}
          type="number"
          placeholder={field.placeholder}
          className={`h-12 text-base ${errorClass}`}
          onChange={(e) => formField.onChange(parseFloat(e.target.value))}
        />
      );

    case "boolean":
      return (
        <div className="flex items-center space-x-3">
          <Switch
            checked={formField.value}
            onCheckedChange={formField.onChange}
          />
          <Label className="text-base">{field.label}</Label>
        </div>
      );

    case "array":
      return (
        <ArrayField
          {...formField}
          itemSchema={field.items}
          className={errorClass}
        />
      );

    case "object":
      return (
        <ObjectField
          {...formField}
          properties={field.properties}
          className={errorClass}
        />
      );

    default:
      return (
        <Input
          {...formField}
          placeholder={field.placeholder}
          className={`h-12 text-base ${errorClass}`}
        />
      );
  }
}
```

**File**: `apps/web/src/hooks/use-workflow-forms.ts`

```typescript
import { create } from "zustand";
import type {
  Workflow,
  WorkflowFormState,
} from "@deco/sdk/mcp/workflows/types";

interface WorkflowFormsStore {
  forms: Record<string, WorkflowFormState>;

  // Actions
  setFormState: (stepId: string, state: Partial<WorkflowFormState>) => void;
  getFormValues: (stepId: string) => Record<string, unknown>;
  validateForm: (stepId: string, schema: JSONSchema) => boolean;
  resetForm: (stepId: string) => void;
  resetAllForms: () => void;
}

export const useWorkflowFormsStore = create<WorkflowFormsStore>((set, get) => ({
  forms: {},

  setFormState: (stepId, state) =>
    set((prev) => ({
      forms: {
        ...prev.forms,
        [stepId]: {
          ...prev.forms[stepId],
          ...state,
          stepId,
        },
      },
    })),

  getFormValues: (stepId) => get().forms[stepId]?.values || {},

  validateForm: (stepId, schema) => {
    // Validate using JSON Schema
    const values = get().getFormValues(stepId);
    const result = validateJsonSchema(schema, values);

    get().setFormState(stepId, {
      isValid: result.valid,
      errors: result.errors,
    });

    return result.valid;
  },

  resetForm: (stepId) =>
    set((prev) => ({
      forms: {
        ...prev.forms,
        [stepId]: {
          stepId,
          values: {},
          isDirty: false,
          isValid: true,
          errors: {},
        },
      },
    })),

  resetAllForms: () => set({ forms: {} }),
}));
```

### 3.1 State Management with Zustand

**File**: `apps/web/src/stores/workflow-builder-store.ts`

```typescript
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface StepCreatorState {
  // Current step being created
  prompt: string;
  selectedTools: string[];
  suggestedTools: string[];
  isGenerating: boolean;

  // Actions
  setPrompt: (prompt: string) => void;
  setSelectedTools: (tools: string[]) => void;
  setSuggestedTools: (tools: string[]) => void;
  setIsGenerating: (generating: boolean) => void;
  reset: () => void;
}

export const useStepCreatorStore = create<StepCreatorState>()(
  devtools(
    persist(
      (set) => ({
        prompt: "",
        selectedTools: [],
        suggestedTools: [],
        isGenerating: false,

        setPrompt: (prompt) => set({ prompt }),
        setSelectedTools: (selectedTools) => set({ selectedTools }),
        setSuggestedTools: (suggestedTools) => set({ suggestedTools }),
        setIsGenerating: (isGenerating) => set({ isGenerating }),
        reset: () =>
          set({
            prompt: "",
            selectedTools: [],
            suggestedTools: [],
            isGenerating: false,
          }),
      }),
      {
        name: "step-creator-storage",
        partialize: (state) => ({ prompt: state.prompt }), // Only persist prompt
      },
    ),
  ),
);

interface WorkflowCanvasState {
  currentStepIndex: number;
  mode: "view" | "create" | "edit";
  executionResults: Record<string, unknown>;

  // Navigation
  setCurrentStepIndex: (index: number) => void;
  setMode: (mode: "view" | "create" | "edit") => void;

  // Execution
  setExecutionResult: (stepId: string, result: unknown) => void;
  clearExecutionResults: () => void;
}

export const useWorkflowCanvasStore = create<WorkflowCanvasState>()(
  devtools(
    (set) => ({
      currentStepIndex: 0,
      mode: "view",
      executionResults: {},

      setCurrentStepIndex: (currentStepIndex) => set({ currentStepIndex }),
      setMode: (mode) => set({ mode }),
      setExecutionResult: (stepId, result) =>
        set((state) => ({
          executionResults: { ...state.executionResults, [stepId]: result },
        })),
      clearExecutionResults: () => set({ executionResults: {} }),
    }),
  ),
);
```

### 3.1 Linear Canvas Component

**File**: `apps/web/src/components/workflow-builder/linear-canvas.tsx`

```typescript
export function LinearWorkflowCanvas({ workflowId }: Props) {
  const { workflow, updateWorkflow } = useWorkflow(workflowId);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [mode, setMode] = useState<"view" | "create">("view");

  const currentStep = workflow?.steps[currentStepIndex];
  const isNewStep = currentStepIndex === workflow?.steps.length;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {mode === "create" || isNewStep
            ? (
              <StepCreator
                key="creator"
                workflow={workflow}
                onStepCreated={(step) => {
                  updateWorkflow({
                    ...workflow,
                    steps: [...workflow.steps, step],
                  });
                  setMode("view");
                }}
                onCancel={() => setMode("view")}
              />
            )
            : (
              <StepViewer
                key={`step-${currentStep?.id}`}
                step={currentStep}
                executionResult={workflow.executionState[currentStep?.id]}
                onEdit={() => setMode("create")}
                onRun={() => executeStep(currentStep)}
              />
            )}
        </AnimatePresence>
      </div>

      {/* Navigation Bar */}
      <NavigationBar
        steps={workflow?.steps || []}
        currentIndex={currentStepIndex}
        onNavigate={setCurrentStepIndex}
        onAddStep={() => {
          setCurrentStepIndex(workflow?.steps.length || 0);
          setMode("create");
        }}
      />

      {/* DecoPilot Assistant */}
      <WorkflowAssistant
        workflow={workflow}
        currentStep={currentStep}
      />
    </div>
  );
}
```

### 3.2 Step Creator with AI (Beautiful UX Design)

**Design Specifications**:

- **Typography**: Base font size 18px, headings 24-32px
- **Spacing**: Minimum 24px between sections, 16px internal padding
- **Colors**: High contrast, accessible color palette
- **Animations**: Smooth 200-300ms transitions
- **Responsive**: Mobile-first, works on all screen sizes

**File**: `apps/web/src/components/workflow-builder/step-creator.tsx`

```typescript
export function StepCreator({ workflow, onStepCreated, onCancel }: Props) {
  // Use Zustand for local state management
  const {
    prompt,
    selectedTools,
    suggestedTools,
    isGenerating,
    setPrompt,
    setSelectedTools,
    setSuggestedTools,
    reset,
  } = useStepCreatorStore();

  const [showAutoTools, setShowAutoTools] = useState(true);
  const { mutate: generateStep } = useGenerateStep();
  const { data: availableTools } = useAvailableTools();

  // TODO: This solution is not future-proof. We need to rely on an agent to
  // dynamically search tools using searchTools to fulfill this request without
  // wasting a lot of tokens.
  // Debounced tool discovery (only if auto-tools enabled)
  const discoverTools = useDebouncedCallback(
    async (text: string) => {
      if (!showAutoTools || text.length < 10) return;

      const tools = await discoverRelevantTools(text, availableTools);
      setSuggestedTools(tools);
    },
    3000, // 3 second debounce as specified
  );

  // Handle @ mentions in prompt
  const handlePromptChange = (value: string) => {
    setPrompt(value);

    // Extract @ mentions for tools and previous steps
    const mentions = extractMentions(value);

    // Handle tool mentions
    const toolMentions = mentions
      .filter((m) => isToolMention(m))
      .map((m) => findToolId(m));

    setSelectedTools((prev) => [...new Set([...prev, ...toolMentions])]);

    // Trigger AI tool discovery
    discoverTools(value);
  };

  const handleCreateStep = async () => {
    setIsGenerating(true);

    try {
      const step = await generateStep({
        prompt,
        selectedTools,
        previousSteps: workflow?.steps.map((s) => ({
          id: s.id,
          title: s.title,
          outputSchema: s.outputSchema,
        })),
      });

      onStepCreated(step);
      toast.success("Step created successfully!");
    } catch (error) {
      toast.error("Failed to generate step");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex items-center justify-center h-full p-8"
    >
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Create New Step</CardTitle>
          <CardDescription>
            Describe what you want to do in this step
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Prompt Input with @ Mentions */}
          <div className="space-y-2">
            <Label>What do you want to do?</Label>
            <MentionTextarea
              value={prompt}
              onChange={handlePromptChange}
              placeholder="Generate a blog post about e-commerce using AI based on @best-selling-product"
              className="min-h-[120px] font-mono text-sm"
              mentions={[
                ...availableTools.map((t) => ({
                  id: t.id,
                  display: t.name,
                  type: "tool",
                })),
                ...workflow.steps.map((s) => ({
                  id: s.id,
                  display: s.title,
                  type: "step",
                })),
              ]}
            />
          </div>

          {/* Tool Selection */}
          <div className="space-y-2">
            <Label>Tools</Label>
            <div className="flex flex-wrap gap-2">
              {/* Selected Tools */}
              {selectedTools.map((toolId) => (
                <ToolChip
                  key={toolId}
                  toolId={toolId}
                  selected
                  onRemove={() => {
                    setSelectedTools((prev) =>
                      prev.filter((t) => t !== toolId)
                    );
                  }}
                />
              ))}

              {/* Suggested Tools */}
              {suggestedTools
                .filter((t) => !selectedTools.includes(t))
                .map((toolId) => (
                  <ToolChip
                    key={toolId}
                    toolId={toolId}
                    suggested
                    onAdd={() => {
                      setSelectedTools((prev) => [...prev, toolId]);
                    }}
                  />
                ))}
            </div>

            {/* Manual Tool Selection */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowToolSelector(true)}
            >
              <Icon name="plus" className="mr-2 h-4 w-4" />
              Browse Tools
            </Button>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateStep}
            disabled={!prompt || isGenerating}
          >
            {isGenerating
              ? (
                <>
                  <Spinner className="mr-2" />
                  Generating...
                </>
              )
              : (
                <>
                  <Icon name="sparkles" className="mr-2" />
                  Create Step
                </>
              )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
```

### 3.3 Step Viewer

**File**: `apps/web/src/components/workflow-builder/step-viewer.tsx`

```typescript
export function StepViewer({ step, executionResult, onEdit, onRun }: Props) {
  const [showCode, setShowCode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    setIsRunning(true);
    try {
      await onRun();
      toast.success("Step executed successfully");
    } catch (error) {
      toast.error(`Execution failed: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="h-full flex flex-col p-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {step.logoUrl && (
            <img
              src={step.logoUrl}
              alt=""
              className="w-12 h-12 rounded-lg"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold">{step.title}</h1>
            <p className="text-muted-foreground mt-1">{step.description}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCode(!showCode)}
          >
            <Icon name="code" className="mr-2" />
            {showCode ? "Hide" : "Show"} Code
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Icon name="edit" className="mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
        {/* Left: Configuration */}
        <Card className="overflow-hidden flex flex-col">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto space-y-6">
            {/* Original Prompt */}
            <div>
              <Label className="text-xs uppercase tracking-wide">
                Original Prompt
              </Label>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.prompt}
              </p>
            </div>

            {/* Input Schema */}
            <div>
              <Label className="text-xs uppercase tracking-wide">
                Input Schema
              </Label>
              <JsonSchemaViewer
                schema={step.inputSchema}
                className="mt-2"
              />
            </div>

            {/* Used Tools */}
            {step.usedTools.length > 0 && (
              <div>
                <Label className="text-xs uppercase tracking-wide">
                  Tools Used
                </Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {step.usedTools.map((toolId) => (
                    <Badge key={toolId} variant="secondary">
                      {getToolName(toolId)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Execution/Code */}
        <Card className="overflow-hidden flex flex-col">
          <CardHeader>
            <CardTitle>{showCode ? "Generated Code" : "Execution"}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {showCode
              ? (
                <CodeEditor
                  value={step.code}
                  language="javascript"
                  readOnly
                  theme="dark"
                  className="h-full font-mono text-sm"
                />
              )
              : (
                <div className="space-y-6">
                  {/* Run Button */}
                  <Button
                    onClick={handleRun}
                    disabled={isRunning}
                    className="w-full"
                    size="lg"
                  >
                    {isRunning
                      ? (
                        <>
                          <Spinner className="mr-2" />
                          Running...
                        </>
                      )
                      : (
                        <>
                          <Icon name="play" className="mr-2" />
                          Run Step
                        </>
                      )}
                  </Button>

                  {/* Execution Result */}
                  {executionResult && (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs uppercase tracking-wide">
                          Result
                        </Label>
                        <JsonViewer
                          data={executionResult}
                          className="mt-2 max-h-96 overflow-auto"
                          theme="dark"
                        />
                      </div>

                      {/* Execution Metadata */}
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Duration: {executionResult.duration}ms</div>
                        <div>Status: {executionResult.status}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
```

### 3.4 Navigation Bar

**File**: `apps/web/src/components/workflow-builder/navigation-bar.tsx`

```typescript
export function NavigationBar(
  { steps, currentIndex, onNavigate, onAddStep }: Props,
) {
  return (
    <div className="border-t bg-card px-6 py-4">
      <div className="flex items-center gap-4">
        {/* Previous Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onNavigate(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
        >
          <Icon name="chevron-left" />
        </Button>

        {/* Step Thumbnails */}
        <div className="flex-1 flex gap-3 overflow-x-auto py-2">
          {steps.map((step, index) => (
            <motion.button
              key={step.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate(index)}
              className={cn(
                "flex-shrink-0 w-40 h-24 rounded-lg border-2 p-3",
                "transition-all duration-200",
                "hover:shadow-md",
                index === currentIndex
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50",
              )}
            >
              <div className="h-full flex flex-col justify-between text-left">
                <div>
                  <div className="text-xs font-semibold truncate">
                    {step.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Step {index + 1}
                  </div>
                </div>
                {step.executionState && (
                  <StatusIndicator status={step.executionState.status} />
                )}
              </div>
            </motion.button>
          ))}

          {/* Add Step Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAddStep}
            className="flex-shrink-0 w-40 h-24 rounded-lg border-2 border-dashed
                     border-border hover:border-primary transition-colors
                     flex items-center justify-center group"
          >
            <Icon
              name="plus"
              className="w-6 h-6 text-muted-foreground group-hover:text-primary"
            />
          </motion.button>
        </div>

        {/* Next Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onNavigate(Math.min(steps.length, currentIndex + 1))}
          disabled={currentIndex >= steps.length}
        >
          <Icon name="chevron-right" />
        </Button>

        {/* Actions */}
        <div className="flex gap-2 ml-4 pl-4 border-l">
          <Button variant="outline" size="sm">
            <Icon name="play" className="mr-2 h-4 w-4" />
            Run All
          </Button>
          <Button variant="outline" size="sm">
            <Icon name="share" className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>
      </div>
    </div>
  );
}
```

## Phase 4: Workflow State & Form Integration

### 4.1 Workflow Execution with Forms

**File**: `apps/web/src/components/workflow-builder/workflow-executor.tsx`

```typescript
import type { Workflow, WorkflowStep } from "@deco/sdk/mcp/workflows/types";
import { useWorkflowFormsStore } from "@/hooks/use-workflow-forms";

export function WorkflowExecutor({ workflow }: { workflow: Workflow }) {
  const { forms, setFormState, validateForm } = useWorkflowFormsStore();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);

  const currentStep = workflow.steps[currentStepIndex];
  const needsInput = currentStep?.inputSchema != null;
  const formState = forms[currentStep?.id];

  // Check if step needs user input before execution
  const handleStepExecution = async () => {
    if (needsInput && !formState?.isValid) {
      // Show form for user input
      return;
    }

    setIsExecuting(true);
    try {
      // Execute step with form values
      const result = await executeWorkflowStep({
        step: currentStep,
        workflow,
        formValues: formState?.values,
      });

      // Move to next step
      setCurrentStepIndex((prev) => prev + 1);
    } catch (error) {
      console.error("Step execution failed:", error);
    } finally {
      setIsExecuting(false);
    }
  };

  // Render form if step needs input
  if (needsInput && !formState?.isValid) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <h2 className="text-2xl font-bold mb-6">
          {currentStep.title} - Input Required
        </h2>

        <AutoForm
          schema={currentStep.inputSchema}
          stepId={currentStep.id}
          defaultValues={formState?.values}
          onSubmit={(values) => {
            setFormState(currentStep.id, {
              values,
              isValid: true,
              isDirty: true,
            });
            handleStepExecution();
          }}
        />
      </div>
    );
  }

  // Show execution progress
  return (
    <div className="max-w-4xl mx-auto p-8">
      <WorkflowProgress
        steps={workflow.steps}
        currentIndex={currentStepIndex}
        executionState={workflow.executionState}
      />

      {isExecuting
        ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="w-8 h-8" />
            <span className="ml-4 text-lg">
              Executing {currentStep.title}...
            </span>
          </div>
        )
        : (
          <StepResult
            step={currentStep}
            result={workflow.executionState[currentStep.id]}
            onContinue={handleStepExecution}
          />
        )}
    </div>
  );
}
```

### 4.2 Type-Safe Tool Integration

**File**: `packages/sdk/src/mcp/workflows/tool-integration.ts`

```typescript
import type { JSONSchema, ToolReference } from "./types";

/**
 * Ensures type safety when calling tools from generated code
 */
export function createTypedToolProxy(
  tools: Record<string, Record<string, Function>>,
  toolRefs: ToolReference[],
): Record<string, Record<string, Function>> {
  const proxy: Record<string, Record<string, Function>> = {};

  for (const ref of toolRefs) {
    if (!proxy[ref.integrationId]) {
      proxy[ref.integrationId] = {};
    }

    const originalTool = tools[ref.integrationId]?.[ref.toolName];
    if (!originalTool) {
      console.warn(`Tool ${ref.integrationId}.${ref.toolName} not found`);
      continue;
    }

    // Wrap tool with input/output validation
    proxy[ref.integrationId][ref.toolName] = async (input: unknown) => {
      // Validate input if schema provided
      if (ref.inputSchema) {
        const validation = validateJsonSchema(ref.inputSchema, input);
        if (!validation.valid) {
          throw new Error(
            `Invalid input for ${ref.toolName}: ${
              validation.errors.join(", ")
            }`,
          );
        }
      }

      // Call original tool
      const result = await originalTool(input);

      // Validate output if schema provided
      if (ref.outputSchema) {
        const validation = validateJsonSchema(ref.outputSchema, result);
        if (!validation.valid) {
          console.warn(
            `Tool ${ref.toolName} returned invalid output: ${
              validation.errors.join(", ")
            }`,
          );
        }
      }

      return result;
    };
  }

  return proxy;
}
```

## Phase 5: Advanced Features (Week 4)

### 4.1 DecoPilot Integration

```typescript
export function WorkflowAssistant({ workflow, currentStep }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { sendMessage } = useDecoPilot();

  const handleSuggestion = async (message: string) => {
    const response = await sendMessage({
      message,
      context: {
        workflow,
        currentStep,
        availableData: workflow.executionState,
      },
    });

    if (response.suggestedCode) {
      // Apply suggested changes
      applyCodeSuggestion(response.suggestedCode);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {/* DecoPilot UI */}
    </Sheet>
  );
}
```

### 4.2 Real-time Execution

```typescript
export function useRealtimeExecution(workflowId: string) {
  const [executionState, setExecutionState] = useState({});

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/workflows/${workflowId}/stream`,
    );

    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setExecutionState((prev) => ({
        ...prev,
        [update.stepId]: update,
      }));
    };

    return () => eventSource.close();
  }, [workflowId]);

  return executionState;
}
```

### 4.3 Workflow Sharing

```typescript
export function ShareWorkflowDialog({ workflow }: Props) {
  const [config, setConfig] = useState({
    steps: workflow.steps.map((s) => s.id),
    configurableTools: [],
    defaultValues: {},
  });

  const handleShare = async () => {
    const shareUrl = await createShareLink({
      workflowId: workflow.id,
      config,
    });

    await navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied!");
  };

  return (
    <Dialog>
      {/* Sharing configuration UI */}
    </Dialog>
  );
}
```

## Implementation Timeline

### Week 1: Backend Foundation

- **Day 1**: Wipe old workflow data and create new schema
- **Day 2**: Build AI step generation tool
- **Day 3**: Implement tool discovery AI
- **Day 4-5**: Test and refine AI prompts

### Week 2: Execution Engine

- **Day 1-2**: Build new step runner from scratch
- **Day 3**: Create tool environment
- **Day 4**: Implement sandbox execution
- **Day 5**: Add error handling

### Week 3: Core UI

- **Day 1**: Linear canvas component
- **Day 2**: Step creator with mentions
- **Day 3**: Step viewer with code display
- **Day 4**: Navigation bar
- **Day 5**: Polish animations

### Week 4: Advanced Features

- **Day 1**: DecoPilot integration
- **Day 2**: Real-time execution
- **Day 3**: Workflow sharing
- **Day 4**: Testing
- **Day 5**: Documentation

## Key Implementation Details

### AI Prompt Engineering

```javascript
// Example of generated step code
export default async function (ctx) {
  // Get best selling product from previous step
  const product = await ctx.getStepResult("get-best-seller");

  // Get workflow input
  const config = await ctx.readWorkflowInput();

  // Generate blog post using AI
  const blogPost = await ctx.env.DECO_AI.GENERATE_TEXT({
    prompt: `Write a blog post about ${product.name}.
             Tone: ${config.toneOfVoice || "professional"}`,
    maxTokens: 1000,
  });

  // Return structured output
  return {
    title: `Discover: ${product.name}`,
    content: blogPost.text,
    product: {
      id: product.id,
      name: product.name,
      price: product.price,
    },
    generatedAt: new Date().toISOString(),
  };
}
```

### Tool Environment Structure

```javascript
ctx.env = {
  VTEX: {
    getProduct: async (id) => {/* ... */},
    listProducts: async () => {/* ... */},
  },
  GMAIL: {
    sendEmail: async (params) => {/* ... */},
  },
  DECO_AI: {
    GENERATE_TEXT: async (prompt) => {/* ... */},
    GENERATE_OBJECT: async (params) => {/* ... */},
  },
  // ... other integrations
};
```

## Success Metrics

1. **Time to Create Workflow**: Target 50% reduction
2. **AI Generation Accuracy**: Target 90%+ success rate
3. **User Adoption**: Track new vs old UI usage
4. **Execution Success Rate**: Target <5% failure rate
5. **Sharing Engagement**: Track weekly shares

## Migration Strategy

1. **Clean Start**: Wipe existing workflow data
2. **Feature Flag**: Roll out to select users first
3. **No Legacy Support**: Focus only on new implementation
4. **Fast Iteration**: Move quickly without legacy constraints

## ⚠️ Critical Implementation Warnings

### WARNING 1: Integration ID Prefix Issue

**Problem**: Integration IDs come with prefixes (`i_`, `a_`) from the UI but
`ctx.env` expects clean IDs.

**Solution**:

```typescript
// Always clean integration IDs before using
const cleanId = integrationId.replace(/^[ia]_/, "");

// In prompt generation:
const toolPrompt = `ctx.env.${cleanId}.${toolName}(args)`;

// In asEnv():
env[cleanId] = {/* tools */};
```

### WARNING 2: Tools Not Initially Available

**Problem**: Integration objects from `useIntegrations()` don't include tools
initially.

**Solution**:

```typescript
// Must combine data from two sources
const integration = await useIntegrations();
const { tools } = await useTools(integration.connection);

// Combine before passing to AI
const toolWithIntegration = {
  ...tool,
  integration: integration,
};
```

### WARNING 3: Step IDs vs Names

**Problem**: `getStepResult()` expects step IDs, not titles.

**Solution**:

```typescript
// Generate stable IDs
const step = {
  id: `step-${Date.now()}`, // Or use sequential: step-1, step-2
  title: "Human readable title",
  // ...
};

// Reference by ID, not title
await ctx.getStepResult("step-1234567890");
```

### WARNING 4: Agent vs Integration Confusion

**Problem**: Agents appear as integrations with `a_` prefix but don't have
traditional tools.

**Solution**:

```typescript
// Filter or handle separately
const realIntegrations = integrations.filter((i) => !i.id.startsWith("a_"));

// Or handle agent tools differently
if (integration.id.startsWith("a_")) {
  // Agent-specific logic
}
```

## Critical Implementation Q&A

### Q1: Como funciona a chamada de tools no código gerado?

**Resposta Detalhada:**

O sistema usa a função `asEnv()` do arquivo
`packages/sdk/src/mcp/sandbox/utils.ts` que cria um ambiente de execução com
todas as tools disponíveis:

```typescript
// packages/sdk/src/mcp/sandbox/utils.ts (linha 85-151)
export const asEnv = async (client: MCPClientStub<ProjectTools>) => {
  const { items } = await client.INTEGRATIONS_LIST({});
  const env = {};

  for (const item of items) {
    // CRITICAL: Remove prefix from integration ID for env key
    const cleanId = item.id.replace(/^[ia]_/, "");
    env[cleanId] = Object.fromEntries(
      tools.map((tool) => [
        tool.name,
        async (args: unknown) => {
          // Valida input
          const inputValidation = validate(args, tool.inputSchema);
          if (!inputValidation.valid) {
            throw new Error(`Input validation failed`);
          }

          // Chama a tool via MCP
          const response = await client.INTEGRATIONS_CALL_TOOL({
            connection: item.connection,
            params: { name: tool.name, arguments: args },
          });

          return response.structuredContent || response.content;
        },
      ]),
    );
  }
  return env;
};
```

**Prompt para AI gerar código com tools:**

```javascript
// Localização: packages/sdk/src/mcp/sandbox/api.ts (linha 109-119)
const TOOL_CALL_TEMPLATE = `
Tools can call other tools using the env object from the ctx variable:
async (input, ctx) => {
  // Call format:
  const response = await ctx.env.<INTEGRATION_ID>.<TOOL_NAME>(<arguments>);
  
  // Example:
  const product = await ctx.env.vtex.getProduct({ id: "123" });
  const email = await ctx.env.gmail.sendEmail({ to: "user@example.com" });
  
  return response;
}`;
```

**Garantia de funcionamento:**

1. Validação de schema na entrada e saída
2. Error handling com mensagens descritivas
3. Todas as tools são pré-carregadas no contexto antes da execução

### Q2: Como funciona o getStepResult no QuickJS?

**Resposta Detalhada:**

O `getStepResult` é implementado como parte do contexto passado para o QuickJS
via `callFunction`:

```typescript
// packages/sdk/src/mcp/sandbox/run.ts (linha 30-41)
const stepContext = {
  readWorkflowInput() {
    return input; // Input original do workflow
  },
  readStepResult(stepName: string) {
    if (!state.steps[stepName]) {
      throw new Error(`Step '${stepName}' has not been executed yet`);
    }
    return state.steps[stepName]; // Retorna resultado já executado
  },
  env: await asEnv(client), // Tools disponíveis
};

// Executa no QuickJS passando contexto
const stepCallHandle = await callFunction(
  stepCtx, // QuickJS context
  stepDefaultHandle, // Função do step
  undefined, // thisArg
  stepContext, // Nosso contexto com getStepResult
  {}, // Configuração adicional
);
```

**Como o QuickJS lida com isso:**

```typescript
// packages/cf-sandbox/src/utils/call-function.ts (linha 4-33)
export function callFunction(
  ctx: QuickJSContext,
  fn: QuickJSHandle,
  thisArg?: unknown,
  ...args: unknown[]
) {
  // Converte argumentos JS para QuickJS handles
  const argHandles = args.map((arg) => toQuickJS(ctx, arg));

  // Para funções, cria proxy que executa no host
  // Isso permite que getStepResult acesse o state real

  const result = ctx.callFunction(fn, thisArgHandle, ...argHandles);
  return ctx.resolvePromise(resultPromise.handle);
}
```

**Importante:** O `getStepResult` executa no contexto do HOST, não dentro do
sandbox, garantindo acesso ao state real do workflow.

### Q3: As tools disponíveis do projeto estão garantidas?

**Resposta Detalhada:**

Sim, o sistema atual já lista tools corretamente:

```typescript
// apps/web/src/components/workflow-builder/select-tool-dialog.tsx (linha 45-69)
const { data: integrations = [] } = useIntegrations();

// Filtra integrações com tools
const integrationsWithTools = integrations.filter(
  (integration) =>
    integration.connection &&
    ["HTTP", "SSE", "Websocket", "INNATE", "Deco"].includes(
      integration.connection.type,
    ),
);

// Pega tools da integração selecionada
const { data: toolsData } = useTools(
  selectedIntegration?.connection as MCPConnection,
);
const tools = toolsData?.tools || [];
```

**Estrutura de dados REAL (corrigida):**

```typescript
// Como vem do SelectToolDialog
interface ToolWithIntegration {
  name: string; // Ex: "sendEmail"
  description?: string; // Ex: "Send an email via Gmail"
  inputSchema?: JSONSchema; // Validação de entrada
  integration: Integration; // OBJETO COMPLETO da integration
}

interface Integration {
  id: string; // Ex: "i_123" (COM prefixo!)
  name: string; // Ex: "Gmail"
  icon?: string;
  connection: MCPConnection;
  tools?: MCPTool[]; // Pode não vir preenchido inicialmente
}

// IMPORTANTE: Remover prefixo antes de usar
function getCleanIntegrationId(id: string): string {
  // Remove prefixos "i_", "a_", etc
  return id.replace(/^[ia]_/, "");
}
```

**Como garantir que funciona na nova UI:**

1. Reutilizar os hooks existentes (`useIntegrations`, `useTools`)
2. Manter a estrutura de dados atual
3. Adicionar cache para performance

### Q4: Como garantir que o código gerado pela AI funciona?

**Resposta Adicional:**

```typescript
// Validação pré-execução
async function validateStepCode(code: string, context: AppContext) {
  // 1. Parse do código como ES module
  const moduleRegex = /export\s+default\s+async\s+function/;
  if (!moduleRegex.test(code)) {
    throw new Error("Code must export default async function");
  }

  // 2. Teste de compilação no QuickJS
  const evaluation = await evalCodeAndReturnDefaultHandle(code, "test");
  try {
    // 3. Verify the function exists and is callable
    if (typeof evaluation.defaultHandle !== "function") {
      throw new Error("Default export must be a function");
    }
  } finally {
    // Always clean up
    await evaluation.dispose();
  }

  return true;
}
```

### Q5: Qual a estrutura exata do prompt para gerar steps?

**Resposta Completa:**

```javascript
const COMPLETE_PROMPT_TEMPLATE = `
You are generating a workflow step. Follow these EXACT rules:

1. STRUCTURE:
export default async function(ctx) {
  // Your code here
  return result;
}

2. AVAILABLE CONTEXT:
- ctx.readWorkflowInput() - Returns original workflow input
- ctx.getStepResult("step-id") - Returns result from previous step
- ctx.env.INTEGRATION_ID.tool_name(args) - Call tools
- ctx.sleep(name, duration)
- ctx.sleepUntil(name, date)

3. AVAILABLE TOOLS:
${
  tools.map((t) => {
    // CRITICAL: Remove prefix from integration ID
    const cleanId = t.integration.id.replace(/^[ia]_/, "");
    const inputDesc = t.inputSchema?.description || "No description";
    const outputDesc = t.outputSchema?.description || "Returns the result";
    return `
Tool: ctx.env.${cleanId}.${t.name}
  Purpose: ${t.description || "No description available"}
  Input Schema: ${JSON.stringify(t.inputSchema, null, 2)}
  Input Description: ${inputDesc}
  Output Schema: ${JSON.stringify(t.outputSchema, null, 2)}
  Output Description: ${outputDesc}
  Example: await ctx.env.${cleanId}.${t.name}({ /* your args here */ });
`;
  }).join("\n")
}

4. PREVIOUS STEPS DATA:
${
  previousSteps.map((s) => `
Step "${s.id}":
  Title: ${s.title}
  Output Shape: ${JSON.stringify(s.outputSchema)}
  Access via: const data = await ctx.getStepResult("${s.id}");
`).join("\n")
}

5. USER REQUEST:
${userPrompt}

6. REQUIREMENTS:
- Handle ALL errors with try/catch
- Validate data before using
- Return data matching the output schema
- Use TypeScript-style comments for clarity

Generate the complete step code now:
`;
```

### Q6: Como debugar steps que falham?

**Solução de Debug:**

```typescript
// Adicionar logging detalhado
const DEBUG_WRAPPER = `
export default async function(ctx) {
  const __start = Date.now();
  console.log("[Step Start]", { input: ctx.readWorkflowInput() });
  
  try {
    // [GENERATED CODE HERE]
    const result = /* generated code */;
    
    console.log("[Step Success]", { 
      duration: Date.now() - __start,
      output: result 
    });
    return result;
  } catch (error) {
    console.error("[Step Error]", {
      duration: Date.now() - __start,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}`;
```

## Beautiful UX Specifications

### Visual Design System

```css
/* Design Tokens */
:root {
  /* Typography */
  --font-size-base: 18px;
  --font-size-lg: 20px;
  --font-size-xl: 24px;
  --font-size-2xl: 32px;
  --font-size-3xl: 40px;
  --line-height-relaxed: 1.8;

  /* Spacing */
  --spacing-xs: 8px;
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
  --spacing-3xl: 64px;

  /* Border Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.12);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.16);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;
}
```

### Component Guidelines

1. **Text Areas & Inputs**
   - Minimum height: 200px for main prompts
   - Font size: 18px minimum
   - Line height: 1.8 for readability
   - Padding: 24px internal spacing
   - Focus states with ring effect

2. **Buttons**
   - Minimum height: 56px for primary actions
   - Font weight: 600 (semibold)
   - Hover animations with transform
   - Loading states with spinners

3. **Cards & Containers**
   - Generous padding: 32px minimum
   - Clear visual hierarchy
   - Subtle shadows for depth
   - Smooth border radius (12-16px)

4. **Animations**
   - Page transitions: 300ms slide
   - Hover effects: 200ms ease
   - Loading states: Subtle pulse
   - Success feedback: Check animation

## Implementation Checklist

### Week 1: Backend Foundation

- [ ] Create new workflow schema (no legacy)
- [ ] Build AI step generation tool
- [ ] Implement tool discovery with debounce
- [ ] Add manual tool selection fallback
- [ ] Test AI prompt engineering

### Week 2: Execution Engine

- [ ] Build new step runner from scratch
- [ ] Create tool environment with proper ID code
- [ ] Implement QuickJS sandbox execution
- [ ] Add error handling and retries
- [ ] Test with real integrations

### Week 3: Frontend Components

- [ ] Setup Zustand stores
- [ ] Build linear canvas with animations
- [ ] Create step creator with beautiful UX
- [ ] Add tool selector with auto-discovery toggle
- [ ] Implement navigation controls

### Week 4: Polish & Testing

- [ ] Add comprehensive error handling
- [ ] Implement loading states
- [ ] Create success animations
- [ ] Test with real users
- [ ] Performance optimization

## Conclusion

This implementation creates a revolutionary workflow builder that treats each
step as self-contained, autonomous code. Key innovations:

1. **No "Between Steps" Complexity**: Each step fetches what it needs
2. **AI-First Design**: Natural language to working code instantly
3. **Beautiful UX**: Large text, generous spacing, smooth animations
4. **Smart Tool Discovery**: 3-second debounced AI suggestions with manual
   fallback
5. **Zustand State Management**: Clean, predictable state handling
6. **Clean Slate Approach**: No legacy code, fresh start

The system empowers users to create powerful workflows through simple
descriptions, with AI handling all the technical complexity behind the scenes.
