import {
  TriggerOutputSchema,
  useCreateTrigger,
  useIntegrations,
  useUpdateTrigger,
  WebhookTriggerSchema,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
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
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import Ajv from "ajv";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { IntegrationIcon } from "../integrations/common.tsx";
import { BindingSelector } from "../toolsets/binding-selector.tsx";
import { SingleToolSelector } from "../toolsets/single-selector.tsx";

function JsonSchemaInput({ value, onChange }: {
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    onChange(val);
    try {
      // deno-lint-ignore no-explicit-any
      const ajv = new (Ajv as any)();
      const parsed = JSON.parse(val);
      try {
        ajv.compile(parsed);
        setError(null);
      } catch (schemaErr) {
        setError("Invalid JSON Schema: " + (schemaErr as Error).message);
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
            Use <code>type</code> for the data type and <code>required</code>
            {" "}
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

const FormSchema = WebhookTriggerSchema.extend({
  schema: z.string().optional(),
});

type WebhookTriggerFormType = z.infer<typeof FormSchema>;

type WebhookTriggerData = z.infer<typeof WebhookTriggerSchema>;

export function WebhookTriggerForm({
  agentId,
  onSuccess,
  initialValues,
}: {
  agentId: string;
  onSuccess?: () => void;
  initialValues?: z.infer<typeof TriggerOutputSchema>;
}) {
  const { mutate: createTrigger, isPending: isCreating } = useCreateTrigger(
    agentId,
  );
  const [open, setOpen] = useState(false);

  const { mutate: updateTrigger, isPending: isUpdating } = useUpdateTrigger(
    agentId,
  );
  const isEditing = !!initialValues;
  const isPending = isCreating || isUpdating;

  const webhookData = initialValues?.data.type === "webhook"
    ? initialValues.data as WebhookTriggerData
    : undefined;

  const form = useForm<WebhookTriggerFormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      bindingId: initialValues?.data.bindingId || "",
      title: initialValues?.data.title || "",
      description: initialValues?.data.description || "",
      passphrase: webhookData?.passphrase || "",
      schema: webhookData?.schema
        ? JSON.stringify(webhookData.schema, null, 2)
        : "",
      outputTool: webhookData?.outputTool || "",
      type: "webhook",
    },
  });

  function handleOutputSchemaChange(val: string) {
    form.setValue("schema", val, { shouldValidate: true });
  }

  const onSubmit = (data: WebhookTriggerFormType) => {
    let schemaObj: object | undefined = undefined;
    if (data.schema && data.schema.trim().length > 0) {
      try {
        schemaObj = JSON.parse(data.schema);
      } catch {
        form.setError("schema", {
          message: "Output Schema must be valid JSON",
        });
        return;
      }
    }
    if (isEditing && initialValues) {
      updateTrigger(
        {
          triggerId: initialValues.id,
          trigger: {
            title: data.title,
            description: data.description || undefined,
            type: "webhook",
            passphrase: data.passphrase || undefined,
            schema: schemaObj as Record<string, unknown> | undefined,
            outputTool: data.outputTool || undefined,
            bindingId: data.bindingId,
          },
        },
        {
          onSuccess: () => {
            form.reset();
            onSuccess?.();
          },
          onError: (error: Error) => {
            form.setError("root", {
              message: error?.message || "Failed to update trigger",
            });
          },
        },
      );
    } else {
      createTrigger(
        {
          title: data.title,
          description: data.description || undefined,
          type: "webhook",
          passphrase: data.passphrase || undefined,
          schema: schemaObj as Record<string, unknown> | undefined,
          outputTool: data.outputTool || undefined,
          bindingId: data.bindingId,
        },
        {
          onSuccess: () => {
            form.reset();
            onSuccess?.();
          },
          onError: (error: Error) => {
            form.setError("root", {
              message: error?.message || "Failed to create trigger",
            });
          },
        },
      );
    }
  };

  const { data: integrations = [] } = useIntegrations();

  const selected = useMemo(() => {
    const bindingId = form.watch("bindingId");
    if (!bindingId) return null;
    const integration = integrations.find((i) => i.id === bindingId);
    return integration ? { integration } : null;
  }, [form.watch("bindingId"), integrations]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Send birthday message"
                  className="rounded-md"
                  required
                />
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
              <div className="flex items-center justify-between">
                <FormLabel>Description</FormLabel>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Send birthday message to the user"
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="passphrase"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Passphrase</FormLabel>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Passphrase"
                  className="rounded-md"
                  type="text"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="schema"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Output Schema</FormLabel>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <FormControl>
                <JsonSchemaInput
                  value={field.value}
                  onChange={handleOutputSchemaChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bindingId"
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-col gap-1 px-1 justify-between">
                <FormLabel>Binding</FormLabel>
                <span className="text-xs text-muted-foreground">
                  When selected, this webhook trigger will use the selected
                  binding
                </span>
              </div>
              <div className="flex flex-col gap-2 justify-center w-min">
                <FormControl>
                  <div>
                    {open
                      ? (
                        <BindingSelector
                          open={open}
                          onOpenChange={setOpen}
                          onIntegrationSelected={field.onChange}
                          initialSelectedIntegration={field.value || null}
                          binder="Channel"
                        />
                      )
                      : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between truncate"
                          onClick={() => setOpen(true)}
                        >
                          <span className="text-muted-foreground">
                            Select a binding...
                          </span>
                          <Icon
                            name="expand_more"
                            size={18}
                            className="ml-2 text-muted-foreground"
                          />
                        </Button>
                      )}
                  </div>
                </FormControl>
                {field.value && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex items-center gap-2 px-2 py-1 h-auto"
                    onClick={() => field.onChange("")}
                  >
                    <Icon
                      name="close"
                      size={12}
                      className="text-muted-foreground"
                    />
                    <span className="flex items-center gap-2">
                      <IntegrationIcon
                        icon={selected?.integration.icon}
                        name={selected?.integration.name || ""}
                        className="h-8 w-8"
                      />
                      <span className="truncate overflow-hidden whitespace-nowrap max-w-[350px]">
                        {selected?.integration.name}
                      </span>
                    </span>
                  </Button>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="outputTool"
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-col gap-1 px-1 justify-between">
                <FormLabel>Output Tool</FormLabel>
                <span className="text-xs text-muted-foreground">
                  When selected, this webhook trigger will always end calling
                  the selected tool
                </span>
              </div>
              <div className="flex flex-col gap-2 justify-center w-min">
                <FormControl>
                  <div>
                    <SingleToolSelector
                      value={field.value || null}
                      onChange={field.onChange}
                    />
                  </div>
                </FormControl>
                {field.value && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex items-center gap-2 px-2 py-1 h-auto"
                    onClick={() => field.onChange("")}
                  >
                    <Icon
                      name="close"
                      size={12}
                      className="text-muted-foreground"
                    />
                    <span className="truncate overflow-hidden whitespace-nowrap max-w-[350px]">
                      {field.value}
                    </span>
                  </Button>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root && (
          <div className="text-xs text-destructive mt-1">
            {form.formState.errors.root.message}
          </div>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : isEditing ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
