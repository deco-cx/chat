// Types for workflow data structures

// Original workflow run data from API
export interface WorkflowRun {
  workflowName: string;
  runId: string;
  createdAt: number;
  updatedAt: number;
  resourceId: string | null;
  status: string;
}

// Unique workflow with aggregated statistics
export interface UniqueWorkflow {
  name: string;
  totalRuns: number;
  lastRun: {
    date: number;
    status: string;
    runId: string;
  };
  successCount: number;
  errorCount: number;
  firstCreated: number;
  lastUpdated: number;
}

// Workflow statistics for the detail page
export interface WorkflowStats {
  totalRuns: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  runningCount: number;
  successRate: number;
  lastRun?: {
    date: number;
    status: string;
    runId: string;
  };
  firstRun?: {
    date: number;
    runId: string;
  };
}

// Status types for better type safety
export type WorkflowStatus =
  | "success"
  | "failed"
  | "running"
  | "pending"
  | "cancelled"
  | "completed"
  | "errored"
  | "in_progress";

// API response structure
export interface WorkflowsListResponse {
  workflows: WorkflowRun[];
  pagination: {
    page?: number;
    per_page?: number;
  };
}

// Step execution data from context
export interface StepExecutionData {
  startedAt?: number;
  endedAt?: number;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  status?: string;
}

// Context map type - maps step IDs to their execution data
export type ContextMap = Record<string, StepExecutionData>;

// Base step graph node interface
export interface BaseStepGraphNode {
  id: string;
  type: string;
}

// Step graph node types
export interface StepGraphStepNode extends BaseStepGraphNode {
  type: "step";
  step: {
    id: string;
    [key: string]: unknown;
  };
}

export interface StepGraphSleepNode extends BaseStepGraphNode {
  type: "sleep";
  id: string;
  [key: string]: unknown;
}

export interface StepGraphSleepUntilNode extends BaseStepGraphNode {
  type: "sleepUntil";
  id: string;
  [key: string]: unknown;
}

export interface StepGraphWaitForEventNode extends BaseStepGraphNode {
  type: "waitForEvent";
  step: {
    id: string;
    [key: string]: unknown;
  };
}

export interface StepGraphParallelNode extends BaseStepGraphNode {
  type: "parallel";
  steps: StepGraphNode[];
}

export interface StepGraphIfNode extends BaseStepGraphNode {
  type: "if";
  id: string;
  if?: StepGraphNode[];
  else?: StepGraphNode[];
  [key: string]: unknown;
}

export interface StepGraphTryNode extends BaseStepGraphNode {
  type: "try";
  id: string;
  try?: StepGraphNode[];
  catch?: StepGraphNode[];
  [key: string]: unknown;
}

export interface StepGraphUnknownNode extends BaseStepGraphNode {
  type: string;
  id: string;
  [key: string]: unknown;
}

// Union type for all step graph node types
export type StepGraphNode =
  | StepGraphStepNode
  | StepGraphSleepNode
  | StepGraphSleepUntilNode
  | StepGraphWaitForEventNode
  | StepGraphParallelNode
  | StepGraphIfNode
  | StepGraphTryNode
  | StepGraphUnknownNode;

// Processed step types for the visualization
export interface ProcessedStep {
  id: string;
  type: string;
  node: StepGraphNode;
  isParallel: false;
}

export interface ProcessedParallelStep {
  type: "parallel";
  isParallel: true;
  steps: ProcessedStep[];
}

// Union type for all processed step types
export type ProcessedStepType = ProcessedStep | ProcessedParallelStep;

// Workflow snapshot structure
export interface WorkflowSnapshot {
  status: WorkflowStatus;
  context: ContextMap;
  serializedStepGraph: StepGraphNode[];
  result?: unknown;
  input?: unknown;
}

// Workflow status API response
export interface WorkflowStatusResponse {
  snapshot: WorkflowSnapshot | string;
}

// Node data for React Flow visualization
export interface WorkflowNodeData {
  label: string;
  status: string;
  stepData?: StepExecutionData;
  duration?: string;
  isParallel?: boolean;
  showHandles: boolean;
  onClick: () => void;
}

// Start/End node data
export interface StartEndNodeData {
  label: string;
  showHandles: boolean;
}

// Step detail modal data
export interface StepDetailData {
  id: string;
  data: {
    label: string;
    status: string;
    stepData?: StepExecutionData;
    duration?: string;
  };
}
