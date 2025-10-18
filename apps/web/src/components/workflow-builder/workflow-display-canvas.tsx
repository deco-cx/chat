import {
  callTool,
  useRecentResources,
  useSDK,
  useStartWorkflow,
  useWorkflowByUriV2,
  type WorkflowRunData,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import Form from "@rjsf/shadcn";
import validator from "@rjsf/validator-ajv8";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "../common/empty-state.tsx";
import { useResourceRoute } from "../resources-v2/route-context.tsx";
import { WorkflowStepCard } from "../workflows/workflow-step-card.tsx";
import {
  useWorkflowActions,
  useWorkflowDescription,
  useWorkflowFirstStepInput,
  useWorkflowName,
  useWorkflowStepDefinition,
  useWorkflowStepInput,
  useWorkflowStepNames,
  useWorkflowStepOutputs,
  useWorkflowUri,
} from "../../stores/workflows/hooks.ts";
import { WorkflowStoreProvider } from "../../stores/workflows/provider.tsx";
import { DetailSection } from "../common/detail-section.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
interface WorkflowDisplayCanvasProps {
  resourceUri: string;
  onRefresh?: () => Promise<void>;
}

// Reference resolution utilities
function isAtRef(value: unknown): value is `@${string}` {
  return typeof value === "string" && value.startsWith("@");
}

function parseAtRef(ref: `@${string}`): {
  type: "step" | "input";
  id?: string;
  path?: string;
} {
  const refStr = ref.substring(1); // Remove @ prefix

  // Input reference: @input.path.to.value
  if (refStr.startsWith("input")) {
    const path = refStr.substring(6); // Remove 'input.'
    return { type: "input", path };
  }

  // Step reference: @stepId.path.to.value
  const [id, ...pathParts] = refStr.split(".");

  // If path starts with 'output.', remove it since stepResults already contains the output
  let path = pathParts.join(".");
  if (path.startsWith("output.")) {
    path = path.substring(7); // Remove 'output.'
  }

  return { type: "step", id, path };
}

/**
 * Relaxes a JSON Schema to accept @references alongside the expected types.
 * This allows form validation to pass when using @step.path or @input.path references.
 */
function relaxSchemaForAtRefs(
  schema: Record<string, unknown>,
  formData: Record<string, unknown>,
): Record<string, unknown> {
  if (!schema.properties || typeof schema.properties !== "object") {
    return schema;
  }

  const relaxedSchema = { ...schema };
  const relaxedProperties: Record<string, unknown> = {};

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    const value = formData[key];

    // If the value is an @ref, relax the schema to accept it
    if (isAtRef(value)) {
      const schema = propSchema as Record<string, unknown>;

      // If the original type is already string, just allow the @ref pattern
      if (schema.type === "string") {
        relaxedProperties[key] = {
          ...schema,
          // Remove any pattern that might conflict with @refs
          pattern: "^@",
        };
      } else {
        // For non-string types (object, number, etc), use oneOf
        relaxedProperties[key] = {
          oneOf: [
            { type: "string", pattern: "^@" }, // Allow @refs
            propSchema, // Or the original type
          ],
        };
      }
    } else {
      relaxedProperties[key] = propSchema;
    }
  }

  relaxedSchema.properties = relaxedProperties;
  return relaxedSchema;
}

function getValue(
  obj: Record<string, unknown> | unknown[] | unknown,
  path: string,
): unknown {
  if (!path) return obj;

  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[key];
    } else if (Array.isArray(current)) {
      const index = parseInt(key, 10);
      current = isNaN(index) ? undefined : current[index];
    } else {
      return undefined;
    }
  }

  return current;
}

function resolveAtRef(
  ref: `@${string}`,
  stepOutputs: Record<string, unknown>,
  firstStepInput?: unknown,
): { value: unknown; error?: string } {
  try {
    const parsed = parseAtRef(ref);

    switch (parsed.type) {
      case "input": {
        // Resolve @input.* to the first step's input
        const value = getValue(
          (firstStepInput as Record<string, unknown>) || {},
          parsed.path || "",
        );
        if (value === undefined) {
          return { value: null, error: `Input path not found: ${parsed.path}` };
        }
        return { value };
      }

      case "step": {
        const identifier = parsed.id || "";
        const stepResult = stepOutputs[identifier];

        if (stepResult === undefined) {
          return {
            value: null,
            error: `Step not found or not executed: ${identifier}`,
          };
        }
        const value = getValue(stepResult, parsed.path || "");
        if (value === undefined) {
          return {
            value: null,
            error: `Path not found in step result: ${parsed.path}`,
          };
        }
        return { value };
      }

      default:
        return { value: null, error: `Unknown reference type: ${ref}` };
    }
  } catch (error) {
    return { value: null, error: `Failed to resolve ${ref}: ${String(error)}` };
  }
}

function resolveAtRefsInInput(
  input: unknown,
  stepOutputs: Record<string, unknown>,
  firstStepInput?: unknown,
): { resolved: unknown; errors?: Array<{ ref: string; error: string }> } {
  const errors: Array<{ ref: string; error: string }> = [];

  function resolveValue(value: unknown): unknown {
    // If it's an @ref, resolve it
    if (isAtRef(value)) {
      const result = resolveAtRef(value, stepOutputs, firstStepInput);
      if (result.error) {
        errors.push({ ref: value, error: result.error });
      }
      return result.value;
    }

    // If it's an array, resolve each element
    if (Array.isArray(value)) {
      return value.map((v) => resolveValue(v));
    }

    // If it's an object, resolve each property
    if (value !== null && typeof value === "object") {
      const resolvedObj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        resolvedObj[key] = resolveValue(val);
      }
      return resolvedObj;
    }

    // Primitive value, return as-is
    return value;
  }

  const resolved = resolveValue(input);
  return { resolved, errors: errors.length > 0 ? errors : undefined };
}

export function WorkflowDisplay({ resourceUri }: WorkflowDisplayCanvasProps) {
  const { data: resource, isLoading: isLoadingWorkflow } =
    useWorkflowByUriV2(resourceUri);
  const workflow = resource?.data;

  // Only show loading on initial load, not on refetch
  if (isLoadingWorkflow && !workflow) {
    return (
      <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!workflow) {
    return (
      <EmptyState
        icon="error"
        title="Workflow not found"
        description="Could not load workflow"
      />
    );
  }

  return (
    <WorkflowStoreProvider key={workflow.name} workflow={workflow}>
      <Canvas />
    </WorkflowStoreProvider>
  );
}

export function useWorkflowRunQuery(enabled: boolean = false) {
  const { connection, resourceUri } = useResourceRoute();
  const runUri = resourceUri;

  const runQuery = useQuery({
    queryKey: ["workflow-run-read", runUri],
    enabled: Boolean(connection && runUri && enabled),
    queryFn: async () => {
      if (!connection || !runUri) {
        throw new Error("Connection and runUri are required");
      }

      const result = await callTool(connection, {
        name: "DECO_RESOURCE_WORKFLOW_RUN_READ",
        arguments: { uri: runUri },
      });

      const data = result.structuredContent as
        | {
            uri: string;
            data: WorkflowRunData;
            created_at?: string;
            updated_at?: string;
          }
        | undefined;

      if (!data) {
        throw new Error("No data returned from workflow run query");
      }

      return data;
    },
    staleTime: 10_000,
    refetchInterval: (q) => {
      const status = q.state.data?.data?.status;
      if (status === "completed" || status === "failed") return false;
      return 2000;
    },
  });

  return runQuery;
}

function StartWorkflowButton() {
  const { mutateAsync, isPending } = useStartWorkflow();
  const workflowUri = useWorkflowUri();
  const runQuery = useWorkflowRunQuery();
  const navigateWorkspace = useNavigateWorkspace();
  const firstStepInput = useWorkflowFirstStepInput();
  const handleStartWorkflow = async (
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    // Prevent any default behavior that might cause page reload
    e.preventDefault();
    e.stopPropagation();

    try {
      await mutateAsync(
        {
          uri: workflowUri,
          input: firstStepInput as Record<string, unknown>,
        },
        {
          onSuccess: (data) => {
            if (!data.uri) return;
            navigateWorkspace(
              `/rsc/i:workflows-management/workflow_run/${encodeURIComponent(data.uri)}`,
            );
          },
        },
      );
    } catch (error) {
      console.error("Error starting workflow:", error);
    }
  };

  // Get current status from the run data
  const status = runQuery.data?.data?.status;

  // Determine states based on status
  const isRunning = status === "running";
  const isCompleted = status === "completed" || status === "failed";

  // Only show loading when:
  // 1. We're actively starting a workflow (isPending)
  // 2. The workflow is running (isRunning)
  // 3. We're fetching a run that exists (hasRun && isLoading/isFetching)
  const isLoading =
    isPending || isRunning || runQuery.isLoading || runQuery.isFetching;

  // Tooltip changes based on whether workflow has run before
  const tooltip = isCompleted ? "Restart Workflow" : "Start Workflow";

  // Icon: spinner when running, refresh when completed, play when not started
  const icon = isLoading ? (
    <Spinner size="xs" />
  ) : isCompleted ? (
    <Icon name="refresh" size={18} />
  ) : (
    <Icon name="play_arrow" size={18} />
  );

  return (
    <Button
      type="button"
      disabled={isLoading}
      variant="special"
      onClick={handleStartWorkflow}
    >
      {icon}
      {tooltip}
    </Button>
  );
}

/**
 * Interactive workflow canvas that shows a form for workflow input
 * and displays the run results below
 */
export function Canvas() {
  const resourceUri = useWorkflowUri();
  const workflowName = useWorkflowName();
  const workflowDescription = useWorkflowDescription();
  // Track recent workflows (Resources v2 workflow detail)
  const { locator } = useSDK();
  const projectKey = typeof locator === "string" ? locator : undefined;
  const { addRecent } = useRecentResources(projectKey);
  const hasTrackedRecentRef = useRef(false);

  useEffect(() => {
    if (
      workflowName &&
      resourceUri &&
      projectKey &&
      !hasTrackedRecentRef.current
    ) {
      hasTrackedRecentRef.current = true;
      setTimeout(() => {
        addRecent({
          id: resourceUri,
          name: workflowName,
          type: "workflow",
          icon: "flowchart",
          path: `/${projectKey}/rsc/i:workflows-management/workflow/${encodeURIComponent(
            resourceUri,
          )}`,
        });
      }, 0);
    }
  }, [workflowName, resourceUri, projectKey, addRecent]);

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex flex-col">
        {/* Header */}
        <DetailSection>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h1 className="text-2xl font-medium">{workflowName}</h1>
                  {workflowDescription && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {workflowDescription}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StartWorkflowButton />
            </div>
          </div>
        </DetailSection>

        {/* Steps Section - show definition steps before run, runtime steps after */}
        <DetailSection title="Steps">
          <WorkflowStepsList />
        </DetailSection>
      </div>
    </ScrollArea>
  );
}

function WorkflowStepsList() {
  const stepNames = useWorkflowStepNames();
  if (!stepNames || stepNames.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic py-4">
        No steps available yet
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-[700px] space-y-8">
        {stepNames.map((stepName, idx) => {
          return (
            <div key={idx}>
              <Suspense fallback={<Spinner />}>
                <WorkflowStepCard stepName={stepName} type="definition" />
              </Suspense>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StepInput({ stepName }: { stepName: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { connection } = useResourceRoute();
  const {
    setStepOutput,
    setStepInput,
    setStepExecutionStart,
    setStepExecutionEnd,
  } = useWorkflowActions();
  const workflowUri = useWorkflowUri();
  const { locator } = useSDK();
  const stepOutputs = useWorkflowStepOutputs();
  const stepInput = useWorkflowStepInput(stepName);
  const stepDefinition = useWorkflowStepDefinition(stepName);
  const firstStepInput = useWorkflowFirstStepInput();

  async function handleFormSubmit(data: Record<string, unknown>) {
    if (!connection || !workflowUri) return;

    try {
      setIsSubmitting(true);
      setStepExecutionStart(stepName);

      // Resolve any @ references in the input data
      // @input.* refs resolve against the workflow's first-step input
      const { resolved, errors } = resolveAtRefsInInput(
        data,
        stepOutputs,
        firstStepInput,
      );

      // Show errors if any references couldn't be resolved
      if (errors && errors.length > 0) {
        const errorMessages = errors
          .map((e) => `${e.ref}: ${e.error}`)
          .join("\n");
        throw new Error(`Failed to resolve references:\n${errorMessages}`);
      }

      const result = await callTool(
        connection,
        {
          name: "DECO_WORKFLOW_RUN_STEP",
          arguments: {
            tool: stepDefinition,
            input: resolved,
          },
        },
        locator,
      );

      // Handle nested structuredContent (MCP response wrapping)
      const mcpResponse = result.structuredContent as {
        structuredContent?: {
          result?: {
            result?: unknown;
            [key: string]: unknown;
          };
          error?: string;
        };
        result?: unknown;
        error?: string;
      };

      // Try to unwrap nested structuredContent first
      const response = mcpResponse.structuredContent || mcpResponse;

      if (response.error) {
        throw new Error(response.error);
      }

      // Extract the actual tool output from nested result structure
      let stepOutput: unknown;
      if (typeof response.result === "object" && response.result !== null) {
        const resultObj = response.result as { result?: unknown };
        // Check if there's a nested result.result structure
        if (typeof resultObj.result === "object" && resultObj.result !== null) {
          const nestedResult = resultObj.result as { result?: unknown };
          // Store the deepest result we can find
          stepOutput =
            nestedResult.result !== undefined
              ? nestedResult.result
              : resultObj.result;
        } else {
          // Store result.result if it exists, otherwise store result
          stepOutput =
            resultObj.result !== undefined ? resultObj.result : response.result;
        }
      } else {
        stepOutput = response.result;
      }

      if (stepOutput !== undefined) {
        if (!stepDefinition?.name) return;
        // Always use def.name for consistency
        setStepOutput(stepDefinition.name, stepOutput);
      }

      // Record successful execution
      setStepExecutionEnd(stepName, true);
    } catch (error) {
      console.error("Failed to run step", error);

      // Record failed execution
      const errorObj =
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { name: "Error", message: String(error) };
      setStepExecutionEnd(stepName, false, errorObj);

      globalThis.window.alert(
        `Failed to run step: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const stepInputSchema = useMemo(() => {
    return stepDefinition?.inputSchema;
  }, [stepDefinition]);

  // Relax schema to accept @refs alongside expected types
  const relaxedSchema = useMemo(() => {
    if (
      !stepInputSchema ||
      typeof stepInputSchema !== "object" ||
      !stepInput ||
      typeof stepInput !== "object"
    ) {
      return stepInputSchema;
    }
    return relaxSchemaForAtRefs(
      stepInputSchema as Record<string, unknown>,
      stepInput as Record<string, unknown>,
    );
  }, [stepInputSchema, stepInput]);

  function handleFormChange(data: { formData?: unknown }) {
    // Persist input changes to the store
    if (data.formData !== undefined) {
      setStepInput(stepName, data.formData);
    }
  }

  return (
    <div className="bg-muted/30 rounded-xl p-6">
      {relaxedSchema &&
      typeof relaxedSchema === "object" &&
      "properties" in relaxedSchema &&
      relaxedSchema.properties &&
      Object.keys(relaxedSchema.properties).length > 0 ? (
        <Form
          schema={relaxedSchema}
          validator={validator}
          formData={stepInput}
          onChange={handleFormChange}
          onSubmit={(data) => handleFormSubmit(data.formData || {})}
          showErrorList={false}
          noHtml5Validate
          liveValidate={false}
        >
          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              size="lg"
              className="min-w-[200px] flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="xs" />
                  Running...
                </>
              ) : (
                <>
                  <Icon name="play_arrow" size={18} />
                  Run Step
                </>
              )}
            </Button>
          </div>
        </Form>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
          <p className="text-sm text-muted-foreground">
            This Step does not require any input parameters.
          </p>
          <Button
            disabled={isSubmitting}
            size="lg"
            onClick={() => handleFormSubmit({})}
            className="min-w-[200px] flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Spinner size="xs" />
                Running...
              </>
            ) : (
              <>
                <Icon name="play_arrow" size={18} />
                Run Step
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
