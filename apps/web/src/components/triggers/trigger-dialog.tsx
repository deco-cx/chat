import type { TriggerOutput } from "@deco/sdk";
import type { JSONSchema7 } from "json-schema";
import {
  useAgents,
  useCreateTrigger,
  useIntegrations,
  useTools,
  useUpdateTrigger,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import {
  RadioGroup,
  RadioGroupItem,
} from "@deco/ui/components/radio-group.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import JsonSchemaForm from "../json-schema/index.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { EmptyState } from "../common/empty-state.tsx";

// Form schema for the new trigger form
const TriggerFormSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    triggerType: z.enum(["webhook", "cron"]),
    passphrase: z.string().optional(),
    frequency: z.string().optional(),
    targetType: z.enum(["agent", "tool"]),
    agentId: z.string().optional(),
    integrationId: z.string().optional(),
    toolName: z.string().optional(),
    // Agent-specific fields
    outputSchema: z.string().optional(),
    prompt: z.string().optional(),
    // Tool-specific fields
    arguments: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.targetType === "agent") {
        return data.agentId && data.agentId.length > 0;
      }
      return true;
    },
    {
      message: "Agent is required for agent triggers",
      path: ["agentId"],
    },
  )
  .refine(
    (data) => {
      if (data.targetType === "tool") {
        return data.integrationId && data.integrationId.length > 0;
      }
      return true;
    },
    {
      message: "Integration is required for tool triggers",
      path: ["integrationId"],
    },
  )
  .refine(
    (data) => {
      if (data.targetType === "tool") {
        return data.toolName && data.toolName.length > 0;
      }
      return true;
    },
    {
      message: "Tool is required for tool triggers",
      path: ["toolName"],
    },
  )
  .refine(
    (data) => {
      if (data.triggerType === "cron") {
        return data.frequency && data.frequency.length > 0;
      }
      return true;
    },
    {
      message: "Frequency is required for cron triggers",
      path: ["frequency"],
    },
  )
  .refine(
    (data) => {
      if (data.targetType === "tool" && data.triggerType === "cron") {
        return data.arguments && data.arguments.length > 0;
      }
      return true;
    },
    {
      message: "Arguments are required for cron tool triggers",
      path: ["arguments"],
    },
  );

type TriggerFormData = z.infer<typeof TriggerFormSchema>;

// Cron presets for frequency selection
const cronPresets = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at 9am (UTC)", value: "0 9 * * *" },
  { label: "Every Monday at 10am (UTC)", value: "0 10 * * 1" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Custom", value: "custom" },
];

function isValidCron(cron: string) {
  return /^(\S+\s+){4}\S+$/.test(cron);
}

function JsonSchemaInput({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    onChange(val);
    try {
      const parsed = JSON.parse(val);
      // Basic validation - could be enhanced with Ajv
      if (typeof parsed === "object" && parsed !== null) {
        setError(null);
      } else {
        setError("Schema must be a valid JSON object");
      }
    } catch (err) {
      setError("Invalid JSON: " + (err as Error).message);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={value || ""}
        onChange={handleChange}
        rows={5}
        className={error ? "border-destructive" : ""}
        placeholder="Enter JSON Schema..."
      />
      {error && <div className="text-xs text-destructive mt-1">{error}</div>}
      <div className="bg-muted border border-border rounded p-3 text-xs text-foreground">
        <div className="font-semibold mb-1">How to fill the Output Schema:</div>
        <ul className="list-disc pl-4 mb-2">
          <li>
            The value must be a valid <b>JSON Schema</b> (e.g.,{" "}
            <code>type: "object"</code>).
          </li>
          <li>
            If the schema is not provided, the trigger will send a message to
            response.
          </li>
          <li>Define the expected properties in the trigger's response.</li>
          <li>
            Use <code>type</code> for the data type and <code>required</code>{" "}
            for required fields.
          </li>
        </ul>
        <div className="font-semibold mb-1">Example:</div>
        <pre className="bg-white border rounded p-2 text-xs overflow-x-auto">
          {`{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number" }
  },
  "required": ["name"]
}`}
        </pre>
      </div>
    </div>
  );
}

function ArgumentsInput({
  value,
  onChange,
  jsonSchema,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  jsonSchema?: JSONSchema7;
}) {
  const [error, setError] = useState<string | null>(null);

  // Create a separate form for JSON Schema component
  const schemaForm = useForm({
    defaultValues: {},
  });

  // Parse initial value and set form defaults
  useEffect(() => {
    if (jsonSchema && value) {
      try {
        const parsed = JSON.parse(value);
        schemaForm.reset(parsed);
        setError(null);
      } catch (err) {
        setError("Invalid JSON: " + (err as Error).message);
      }
    }
  }, [jsonSchema, value, schemaForm]);

  // Handle schema form changes
  const handleSchemaFormChange = (formData: Record<string, unknown>) => {
    try {
      const jsonString = JSON.stringify(formData, null, 2);
      onChange(jsonString);
      setError(null);
    } catch (err) {
      setError("Failed to serialize form data: " + (err as Error).message);
    }
  };

  // Handle textarea changes
  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    onChange(val);
    try {
      const parsed = JSON.parse(val);
      // Basic validation - could be enhanced with Ajv
      if (typeof parsed === "object" && parsed !== null) {
        setError(null);
      } else {
        setError("Arguments must be a valid JSON object");
      }
    } catch (err) {
      setError("Invalid JSON: " + (err as Error).message);
    }
  }

  // Watch form changes and update parent
  useEffect(() => {
    if (jsonSchema) {
      const subscription = schemaForm.watch((formData) => {
        if (formData && Object.keys(formData).length > 0) {
          handleSchemaFormChange(formData);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [jsonSchema, schemaForm]);

  // Check if JSON schema is provided and has meaningful content
  const hasValidSchema =
    jsonSchema &&
    jsonSchema.type === "object" &&
    jsonSchema.properties &&
    Object.keys(jsonSchema.properties).length > 0;

  // If JSON schema is provided with properties, render the schema form
  if (hasValidSchema) {
    return (
      <div className="space-y-2">
        <JsonSchemaForm
          schema={jsonSchema}
          form={schemaForm}
          onSubmit={(e) => {
            e.preventDefault();
            // Form submission is handled by the parent
          }}
          error={error}
        />
        {error && <div className="text-xs text-destructive mt-1">{error}</div>}
        <div className="bg-muted border border-border rounded p-3 text-xs text-foreground">
          <div className="font-semibold mb-1">Schema-based Arguments:</div>
          <p>
            Fill out the form above based on the tool's parameter schema. The
            values will be automatically converted to the correct JSON format.
          </p>
        </div>
      </div>
    );
  }

  // Fallback to textarea when no schema is provided
  return (
    <div className="space-y-2">
      <Textarea
        value={value || ""}
        onChange={handleTextareaChange}
        rows={5}
        className={error ? "border-destructive" : ""}
        placeholder="Enter tool arguments as JSON..."
      />
      {error && <div className="text-xs text-destructive mt-1">{error}</div>}
      <div className="bg-muted border border-border rounded p-3 text-xs text-foreground">
        <div className="font-semibold mb-1">How to fill the Arguments:</div>
        <ul className="list-disc pl-4 mb-2">
          <li>
            The value must be a valid <b>JSON object</b> containing the
            arguments for the selected tool.
          </li>
          <li>Arguments are required for cron triggers that call tools.</li>
          <li>Define the parameters that the tool expects to receive.</li>
          <li>
            Use the tool's schema to understand what arguments are required.
          </li>
        </ul>
        <div className="font-semibold mb-1">Example:</div>
        <pre className="bg-white border rounded p-2 text-xs overflow-x-auto">
          {`{
  "query": "search term",
  "limit": 10,
  "filter": "active"
}`}
        </pre>
      </div>
    </div>
  );
}

function CronSelectInput({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [selected, setSelected] = useState(cronPresets[0].value);
  const [custom, setCustom] = useState(selected === "custom" ? value : "");

  function handlePresetChange(val: string) {
    setSelected(val);
    if (val === "custom") {
      if (isValidCron(custom)) {
        onChange(custom);
      } else {
        onChange("");
      }
    } else {
      onChange(val);
    }
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCustom(val);
    setSelected("custom");
    if (isValidCron(val)) {
      onChange(val);
    } else {
      onChange("");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <FormLabel htmlFor="cron-frequency">Frequency *</FormLabel>
      <Select value={selected} onValueChange={handlePresetChange}>
        <SelectTrigger id="cron-frequency" className="w-full">
          <SelectValue placeholder="Select frequency" />
        </SelectTrigger>
        <SelectContent>
          {cronPresets.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected === "custom" && (
        <Input
          type="text"
          placeholder="Ex: */10 * * * *"
          value={custom}
          className="rounded-md font-mono"
          onChange={handleCustomChange}
          required={required}
        />
      )}

      {selected === "custom" && (
        <div className="bg-muted border border-border rounded p-3 text-xs text-foreground mb-2">
          <div className="font-semibold mb-1">How to fill the Frequency:</div>
          <ul className="list-disc pl-4 mb-2">
            <li>
              The value must be a valid <b>cron expression</b> (e.g.,{" "}
              <code>0 9 * * *</code>).
            </li>
            <li>
              You can select a preset or write your own custom expression.
            </li>
            <li>
              <b>All times are in UTC</b>.
            </li>
            <li>
              <a
                href="https://crontab.guru"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                Use this generator to create and test expressions
              </a>
              .
            </li>
          </ul>
          <div className="font-semibold mb-1">Example:</div>
          <pre className="bg-muted border rounded p-2 text-xs overflow-x-auto">
            {`0 9 * * *     (every day at 9am UTC)
0 17 * * *    (every day at 5pm UTC)
*/5 * * * *   (every 5 minutes)`}
          </pre>
        </div>
      )}
    </div>
  );
}

export function TriggerModal({
  triggerAction,
  agentId,
  integrationId,
  trigger,
  isOpen,
  onOpenChange,
}: {
  triggerAction?: React.ReactNode;
  agentId?: string;
  integrationId?: string;
  trigger?: TriggerOutput;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { data: agents = [] } = useAgents();
  const { data: integrations = [] } = useIntegrations();
  const navigateWorkspace = useNavigateWorkspace();

  const isEditing = !!trigger;
  const hasAgents = agents.length > 0;
  const hasIntegrations = integrations.length > 0;

  const triggerData = trigger?.data ?? {};

  // Determine initial values based on props and trigger data
  const hasCallTool =
    (trigger?.data.type === "cron" && "callTool" in trigger.data) ||
    (trigger?.data.type === "webhook" && "callTool" in trigger.data);
  const initialTargetType = agentId
    ? "agent"
    : integrationId || hasCallTool
      ? "tool"
      : "agent";
  // @ts-expect-error triggerData is not typed for this
  const initialAgentId = agentId || triggerData.agentId || "";
  const initialIntegrationId =
    integrationId ||
    // @ts-expect-error triggerData is not typed for this
    triggerData.callTool?.integrationId ||
    "";
  const initialTriggerType = trigger?.data.type === "cron" ? "cron" : "webhook";

  // Filter out agent integrations and innate integrations
  const filteredIntegrations = useMemo(
    () =>
      integrations.filter(
        (i) => !(i.id.startsWith("a:") || i.connection.type === "INNATE"),
      ),
    [integrations],
  );

  const form = useForm<TriggerFormData>({
    resolver: zodResolver(TriggerFormSchema),
    defaultValues: {
      name: trigger?.data.title || "",
      description: trigger?.data.description || "",
      triggerType: initialTriggerType,
      passphrase:
        trigger?.data.type === "webhook" ? trigger.data.passphrase || "" : "",
      frequency:
        trigger?.data.type === "cron"
          ? trigger.data.cronExp || cronPresets[0].value
          : "",
      targetType: initialTargetType,
      agentId: initialAgentId,
      integrationId:
        trigger?.data.type === "cron" && "callTool" in trigger.data
          ? trigger.data.callTool.integrationId || initialIntegrationId
          : trigger?.data.type === "webhook" && "callTool" in trigger.data
            ? trigger.data.callTool.integrationId || initialIntegrationId
            : initialIntegrationId,
      toolName:
        trigger?.data.type === "cron" && "callTool" in trigger.data
          ? trigger.data.callTool.toolName || ""
          : trigger?.data.type === "webhook" && "callTool" in trigger.data
            ? trigger.data.callTool.toolName || ""
            : "",
      outputSchema:
        trigger?.data.type === "webhook" && "schema" in trigger.data
          ? JSON.stringify(trigger.data.schema, null, 2)
          : "",
      prompt:
        trigger?.data.type === "cron" && "prompt" in trigger.data
          ? trigger.data.prompt.messages[0]?.content || ""
          : "",
      arguments:
        trigger?.data.type === "cron" && "callTool" in trigger.data
          ? JSON.stringify(trigger.data.callTool.arguments, null, 2)
          : "",
    },
  });

  const watchedTriggerType = form.watch("triggerType");
  const watchedTargetType = form.watch("targetType");
  const watchedIntegrationId = form.watch("integrationId");

  // Get tools for selected integration
  const selectedIntegration = integrations.find(
    (i) => i.id === watchedIntegrationId,
  );
  const { data: toolsData, isLoading: isLoadingTools } = useTools(
    selectedIntegration?.connection || { type: "HTTP", url: "" },
  );
  const tools = toolsData?.tools || [];

  const { mutate: createTrigger, isPending: isCreating } = useCreateTrigger();
  const { mutate: updateTrigger, isPending: isUpdating } = useUpdateTrigger();
  const isPending = isCreating || isUpdating;

  const onSubmit = (data: TriggerFormData) => {
    if (data.targetType === "agent") {
      const currentAgentId = data.agentId || agentId || agents[0]?.id;
      if (data.triggerType === "webhook") {
        // Webhook + Agent: output schema and output tool
        let schemaObj: object | undefined = undefined;
        if (data.outputSchema && data.outputSchema.trim().length > 0) {
          try {
            schemaObj = JSON.parse(data.outputSchema);
          } catch {
            form.setError("outputSchema", {
              message: "Output Schema must be valid JSON",
            });
            return;
          }
        }

        const triggerData = {
          title: data.name,
          description: data.description || undefined,
          type: "webhook" as const,
          passphrase: data.passphrase || undefined,
          agentId: currentAgentId,
          schema: schemaObj as Record<string, unknown> | undefined,
        };

        if (isEditing && trigger) {
          updateTrigger(
            {
              triggerId: trigger.id,
              trigger: triggerData,
            },
            {
              onSuccess: () => onOpenChange?.(false),
              onError: (error: Error) => {
                form.setError("root", {
                  message: error?.message || "Failed to update trigger",
                });
              },
            },
          );
        } else {
          createTrigger(triggerData, {
            onSuccess: () => onOpenChange?.(false),
            onError: (error: Error) => {
              form.setError("root", {
                message: error?.message || "Failed to create trigger",
              });
            },
          });
        }
      } else {
        // Cron + Agent: prompt
        if (!data.prompt?.trim()) {
          form.setError("prompt", {
            message: "Prompt is required for cron triggers",
          });
          return;
        }

        const triggerData = {
          title: data.name,
          description: data.description || undefined,
          type: "cron" as const,
          cronExp: data.frequency!,
          agentId: currentAgentId,
          prompt: {
            messages: [{ role: "user" as const, content: data.prompt }],
          },
        };

        if (isEditing && trigger) {
          updateTrigger(
            {
              triggerId: trigger.id,
              trigger: triggerData,
            },
            {
              onSuccess: () => onOpenChange?.(false),
              onError: (error: Error) => {
                form.setError("root", {
                  message: error?.message || "Failed to update trigger",
                });
              },
            },
          );
        } else {
          createTrigger(triggerData, {
            onSuccess: () => onOpenChange?.(false),
            onError: (error: Error) => {
              form.setError("root", {
                message: error?.message || "Failed to create trigger",
              });
            },
          });
        }
      }
    } else {
      // Tool target type
      if (!data.integrationId) {
        form.setError("integrationId", {
          message: "Integration is required for tool triggers",
        });
        return;
      }

      if (!data.toolName) {
        form.setError("toolName", {
          message: "Tool is required for tool triggers",
        });
        return;
      }

      if (data.triggerType === "cron") {
        // Cron + Tool: arguments
        if (!data.arguments?.trim()) {
          form.setError("arguments", {
            message: "Arguments are required for cron tool triggers",
          });
          return;
        }

        let argumentsObj: Record<string, unknown>;
        try {
          argumentsObj = JSON.parse(data.arguments);
        } catch {
          form.setError("arguments", {
            message: "Arguments must be valid JSON",
          });
          return;
        }

        const triggerData = {
          title: data.name,
          description: data.description || undefined,
          type: "cron" as const,
          cronExp: data.frequency!,
          callTool: {
            integrationId: data.integrationId,
            toolName: data.toolName,
            arguments: argumentsObj,
          },
        };

        if (isEditing && trigger) {
          updateTrigger(
            {
              triggerId: trigger.id,
              trigger: triggerData,
            },
            {
              onSuccess: () => onOpenChange?.(false),
              onError: (error: Error) => {
                form.setError("root", {
                  message: error?.message || "Failed to update trigger",
                });
              },
            },
          );
        } else {
          createTrigger(triggerData, {
            onSuccess: () => onOpenChange?.(false),
            onError: (error: Error) => {
              form.setError("root", {
                message: error?.message || "Failed to create trigger",
              });
            },
          });
        }
      } else {
        // Webhook + Tool: callTool without additional fields
        const triggerData = {
          title: data.name,
          description: data.description || undefined,
          type: "webhook" as const,
          passphrase: data.passphrase || undefined,
          callTool: {
            integrationId: data.integrationId,
            toolName: data.toolName,
          },
        };

        if (isEditing && trigger) {
          updateTrigger(
            {
              triggerId: trigger.id,
              trigger: triggerData,
            },
            {
              onSuccess: () => onOpenChange?.(false),
              onError: (error: Error) => {
                form.setError("root", {
                  message: error?.message || "Failed to update trigger",
                });
              },
            },
          );
        } else {
          createTrigger(triggerData, {
            onSuccess: () => onOpenChange?.(false),
            onError: (error: Error) => {
              form.setError("root", {
                message: error?.message || "Failed to create trigger",
              });
            },
          });
        }
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{triggerAction}</DialogTrigger>
      <Form {...form}>
        <form id="trigger-form" onSubmit={form.handleSubmit(onSubmit)}>
          <DialogContent
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl h-[90vh] grid grid-rows-[auto_1fr_auto]"
          >
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Edit trigger" : "New Trigger"}
              </DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Update the trigger configuration and settings."
                  : "Create a new trigger to automate actions based on webhooks or scheduled events."}
              </DialogDescription>
            </DialogHeader>

            {!hasAgents && !hasIntegrations ? (
              <EmptyState
                icon="robot_2"
                title="No agents or integrations yet"
                description="You need to create an agent or add an integration before adding a trigger."
                buttonProps={{
                  onClick: () => {
                    onOpenChange?.(false);
                    navigateWorkspace("/agents");
                  },
                  variant: "special",
                  className: "mt-2",
                  children: (
                    <>
                      <Icon name="add" />
                      New Agent
                    </>
                  ),
                }}
              />
            ) : (
              <div className="flex flex-col gap-4 flex-grow overflow-y-auto p-1">
                {/* Basic Information */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter trigger name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter trigger description (optional)"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Trigger Type Selection */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="triggerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trigger Type</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex space-x-4"
                            disabled={isEditing}
                          >
                            <div
                              className={`flex items-center space-x-2 ${
                                isEditing
                                  ? "cursor-not-allowed"
                                  : "cursor-pointer"
                              }`}
                            >
                              <RadioGroupItem
                                value="webhook"
                                id="webhook"
                                className={
                                  isEditing
                                    ? "cursor-not-allowed"
                                    : "cursor-pointer"
                                }
                              />
                              <Label
                                htmlFor="webhook"
                                className={`flex items-center gap-2 ${
                                  isEditing
                                    ? "cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                              >
                                <Icon name="webhook" className="h-4 w-4" />
                                Webhook
                              </Label>
                            </div>
                            <div
                              className={`flex items-center space-x-2 ${
                                isEditing
                                  ? "cursor-not-allowed"
                                  : "cursor-pointer"
                              }`}
                            >
                              <RadioGroupItem
                                value="cron"
                                id="cron"
                                className={
                                  isEditing
                                    ? "cursor-not-allowed"
                                    : "cursor-pointer"
                                }
                              />
                              <Label
                                htmlFor="cron"
                                className={`flex items-center gap-2 ${
                                  isEditing
                                    ? "cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                              >
                                <Icon name="schedule" className="h-4 w-4" />
                                Cron
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Webhook-specific fields */}
                  {watchedTriggerType === "webhook" && (
                    <FormField
                      control={form.control}
                      name="passphrase"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Passphrase</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter passphrase (optional)"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Cron-specific fields */}
                  {watchedTriggerType === "cron" && (
                    <FormField
                      control={form.control}
                      name="frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <CronSelectInput
                              value={field.value || ""}
                              onChange={field.onChange}
                              required
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Target Type Selection */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="targetType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Type</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex space-x-4"
                            disabled={isEditing || !!agentId || !!integrationId}
                          >
                            <div
                              className={`flex items-center space-x-2 ${
                                isEditing || !!agentId || !!integrationId
                                  ? "cursor-not-allowed"
                                  : "cursor-pointer"
                              }`}
                            >
                              <RadioGroupItem
                                value="agent"
                                id="agent"
                                className={
                                  isEditing || !!agentId || !!integrationId
                                    ? "cursor-not-allowed"
                                    : "cursor-pointer"
                                }
                              />
                              <Label
                                htmlFor="agent"
                                className={`flex items-center gap-2 ${
                                  isEditing || !!agentId || !!integrationId
                                    ? "cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                              >
                                <Icon name="robot_2" className="h-4 w-4" />
                                Agent
                              </Label>
                            </div>
                            <div
                              className={`flex items-center space-x-2 ${
                                isEditing || !!agentId || !!integrationId
                                  ? "cursor-not-allowed"
                                  : "cursor-pointer"
                              }`}
                            >
                              <RadioGroupItem
                                value="tool"
                                id="tool"
                                className={
                                  isEditing || !!agentId || !!integrationId
                                    ? "cursor-not-allowed"
                                    : "cursor-pointer"
                                }
                              />
                              <Label
                                htmlFor="tool"
                                className={`flex items-center gap-2 ${
                                  isEditing || !!agentId || !!integrationId
                                    ? "cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                              >
                                <Icon name="build" filled className="h-4 w-4" />
                                Tool
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Agent Selection */}
                  {watchedTargetType === "agent" && (
                    <FormField
                      control={form.control}
                      name="agentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agent *</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={isEditing || !!agentId}
                            >
                              <SelectTrigger className="w-full h-12 rounded-full border border-border text-left px-4">
                                <SelectValue placeholder="Select agent">
                                  {(() => {
                                    const selectedAgent = agents.find(
                                      (a) => a.id === field.value,
                                    );

                                    if (!selectedAgent) {
                                      return null;
                                    }

                                    return (
                                      <div className="flex items-center gap-2">
                                        <span className="w-6 h-6">
                                          <AgentAvatar
                                            size="xs"
                                            url={selectedAgent.avatar}
                                            fallback={selectedAgent.name}
                                          />
                                        </span>
                                        <span className="truncate text-sm">
                                          {selectedAgent.name}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="max-h-60 overflow-y-auto rounded-xl w-[var(--radix-select-trigger-width)]">
                                {agents.map((agent) => (
                                  <SelectItem
                                    key={agent.id}
                                    value={agent.id}
                                    className="[&>span]:max-w-full"
                                  >
                                    <div className="flex items-center gap-2 px-3 py-2 min-w-0">
                                      <AgentAvatar
                                        size="xs"
                                        url={agent.avatar}
                                        fallback={agent.name}
                                      />

                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="truncate text-sm font-medium">
                                          {agent.name}
                                        </span>
                                        {agent.description && (
                                          <span className="text-xs text-muted-foreground truncate">
                                            {agent.description}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Integration Selection */}
                  {watchedTargetType === "tool" && (
                    <>
                      <FormField
                        control={form.control}
                        name="integrationId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Integration *</FormLabel>
                            <FormControl>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={isEditing || !!integrationId}
                              >
                                <SelectTrigger className="w-full h-12 rounded-full border border-border text-left px-4">
                                  <SelectValue placeholder="Select integration">
                                    {(() => {
                                      const selectedIntegration =
                                        filteredIntegrations.find(
                                          (i) => i.id === field.value,
                                        );

                                      if (!selectedIntegration) {
                                        return null;
                                      }

                                      return (
                                        <div className="flex items-center gap-2">
                                          <IntegrationAvatar
                                            url={selectedIntegration.icon}
                                            fallback={selectedIntegration.name}
                                            size="xs"
                                          />
                                          <span className="truncate text-sm">
                                            {selectedIntegration.name}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="max-h-60 overflow-y-auto rounded-xl w-[var(--radix-select-trigger-width)]">
                                  {filteredIntegrations.map((integration) => (
                                    <SelectItem
                                      key={integration.id}
                                      value={integration.id}
                                      className="[&>span]:max-w-full"
                                    >
                                      <div className="flex items-center gap-2 px-3 py-2 min-w-0">
                                        <IntegrationAvatar
                                          url={integration.icon}
                                          fallback={integration.name}
                                          size="xs"
                                        />
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <span className="truncate text-sm font-medium">
                                            {integration.name}
                                          </span>
                                          {integration.description && (
                                            <span className="text-xs text-muted-foreground truncate">
                                              {integration.description}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Tool Selection */}
                      {watchedIntegrationId && (
                        <FormField
                          control={form.control}
                          name="toolName"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center gap-4">
                                <FormLabel className="flex items-center gap-2">
                                  Tool *
                                </FormLabel>
                                <div className="flex items-center gap-2">
                                  {isLoadingTools && (
                                    <>
                                      <span className="text-xs text-muted-foreground">
                                        Loading tools...
                                      </span>{" "}
                                      <Spinner size="xs" />
                                    </>
                                  )}
                                </div>
                              </div>
                              <FormControl>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  disabled={isEditing}
                                >
                                  <SelectTrigger className="w-full h-12 rounded-full border border-border text-left px-4">
                                    <SelectValue placeholder="Select tool">
                                      {(() => {
                                        const selectedTool = tools.find(
                                          (t) => t.name === field.value,
                                        );

                                        if (!selectedTool) {
                                          return null;
                                        }

                                        return (
                                          <div className="flex items-center gap-2">
                                            <Icon
                                              name="build"
                                              className="w-5 h-5 text-muted-foreground"
                                            />
                                            <span className="truncate text-sm">
                                              {selectedTool.name}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60 overflow-y-auto rounded-xl w-[var(--radix-select-trigger-width)]">
                                    {tools.map((tool) => (
                                      <SelectItem
                                        key={tool.name}
                                        value={tool.name}
                                        className="[&>span]:max-w-full"
                                      >
                                        <div className="flex flex-col items-start gap-1 px-3 py-2 w-full min-w-0">
                                          <div className="flex items-center gap-2 w-full">
                                            <Icon
                                              name="build"
                                              className="w-4 h-4 text-muted-foreground flex-shrink-0"
                                            />
                                            <span className="font-medium text-sm truncate">
                                              {tool.name}
                                            </span>
                                          </div>
                                          {tool.description && (
                                            <span className="text-xs text-muted-foreground truncate w-full pl-6">
                                              {tool.description?.trim()}
                                            </span>
                                          )}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </>
                  )}
                </div>

                {/* Conditional Fields Based on Trigger Type and Target Type */}
                {watchedTargetType === "agent" &&
                  watchedTriggerType === "webhook" && (
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="outputSchema"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Output Schema</FormLabel>
                            <FormControl>
                              <JsonSchemaInput
                                value={field.value}
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                {watchedTargetType === "agent" &&
                  watchedTriggerType === "cron" && (
                    <FormField
                      control={form.control}
                      name="prompt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prompt *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter the prompt to send to the agent"
                              rows={4}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                {watchedTargetType === "tool" &&
                  watchedTriggerType === "cron" && (
                    <FormField
                      control={form.control}
                      name="arguments"
                      render={({ field }) => {
                        // Get the selected tool's input schema
                        const selectedTool = tools.find(
                          (tool) => tool.name === form.watch("toolName"),
                        );
                        const inputSchema = selectedTool?.inputSchema as
                          | JSONSchema7
                          | undefined;

                        return (
                          <FormItem>
                            <FormLabel>Arguments *</FormLabel>
                            <FormControl>
                              <ArgumentsInput
                                value={field.value}
                                onChange={field.onChange}
                                jsonSchema={inputSchema}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  )}
              </div>
            )}

            <DialogFooter>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange?.(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || (!hasAgents && !hasIntegrations)}
                  form="trigger-form"
                >
                  {isPending
                    ? isEditing
                      ? "Updating..."
                      : "Creating..."
                    : isEditing
                      ? "Update Trigger"
                      : "Create Trigger"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </form>
      </Form>
    </Dialog>
  );
}
