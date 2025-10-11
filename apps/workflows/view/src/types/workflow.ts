/**
 * WORKFLOW TYPES - Type-safe workflow definitions
 *
 * No `any`, no `as` - Pure TypeScript
 */

export interface Tool {
  id: string;
  name: string;
  description: string;
  integration: string;
}

export interface Integration {
  id: string;
  name: string;
  tools: Tool[];
}

export type StepStatus = "pending" | "active" | "completed" | "error";

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  toolCalls: string[]; // Deprecated - kept for backward compat
  icon?: string; // Material Symbols icon name for visual representation
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  input?: Record<string, unknown>;
  inputDescription?: Record<string, string>; // Describes where input values come from
  output?: unknown;
  error?: string;
  logs?: Array<{ type: string; content: string }>;
  duration?: number;
  code?: string;
  
  // New fields from refactored schema
  dependencies?: Array<{ integrationId: string }>;
  options?: {
    retries?: {
      limit?: number;
      delay?: number;
      backoff?: "constant" | "linear" | "exponential";
    };
    timeout?: number;
  };

  // Custom Views - Multiple views per step!
  outputViews?: Record<string, string>; // { view1: "HTML+JS", view2: "HTML+JS" }
  inputViews?: Record<string, string>;

  // Deprecated (backward compat) - Single view with HTML + Script
  inputView?: Record<string, unknown>;
  outputView?: {
    html: string;
    script: string;
  };

  createdAt: string;
  updatedAt: string;
}

export type ExecutionStatus = "idle" | "running" | "success" | "error";

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  steps: Array<{
    stepId: string;
    status: StepStatus;
    output?: unknown;
    error?: string;
    startedAt?: string;
    completedAt?: string;
  }>;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  currentStepIndex: number;
  execution?: WorkflowExecution;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateStepInput {
  objective: string;
  previousSteps: Array<{
    id: string;
    name: string;
    outputSchema: Record<string, unknown>;
  }>;
}

export interface GenerateStepOutput {
  step: {
    id: string;
    name: string;
    description: string;
    code: string;
    icon?: string; // Material Symbols icon name for visual representation
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    input: Record<string, unknown>;
    inputDescription?: Record<string, string>; // NEW!
    primaryIntegration?: string;
    primaryTool?: string;
    inputView?: Record<string, unknown>;
    outputView?: {
      html: string;
      script: string;
    };
  };
  reasoning?: string;
}

// ============================================
// EXECUTION TYPES
// ============================================

export interface ExecuteStepParams {
  step: WorkflowStep;
  previousStepResults?: Record<string, unknown>;
  globalInput?: Record<string, unknown>;
}

export interface ExecuteStepResult {
  success: boolean;
  output?: unknown;
  error?: unknown;
  logs?: Array<{ type: string; content: string }>;
  resolvedInput?: Record<string, unknown>;
  duration: number;
}

export interface ExecuteWorkflowParams {
  steps: WorkflowStep[];
  onStepUpdate?: (
    stepId: string,
    status: "active" | "completed" | "error",
    output?: unknown,
  ) => void;
}

export interface ExecuteWorkflowResult {
  success: boolean;
  completedSteps: number;
  results: Array<{
    stepId: string;
    success: boolean;
    output?: unknown;
    error?: string;
    duration: number;
  }>;
  totalDuration: number;
}
