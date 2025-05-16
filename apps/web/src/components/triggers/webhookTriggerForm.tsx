import { Input } from "@deco/ui/components/input.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import Ajv from "ajv";
import { useState } from "react";
import { useCreateTrigger, WebhookTriggerSchema } from "@deco/sdk";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { SingleToolSelector } from "../toolsets/single-selector.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

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
        className={error ? "border-red-500" : ""}
      />
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
      <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-700">
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

export function WebhookTriggerForm({
  agentId,
  onSuccess,
}: {
  agentId: string;
  onSuccess?: () => void;
}) {
  const { mutate: createTrigger, isPending } = useCreateTrigger(agentId);

  const form = useForm<WebhookTriggerFormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      title: "",
      description: "",
      passphrase: "",
      schema: "",
      outputTool: "",
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
    createTrigger(
      {
        title: data.title,
        description: data.description || undefined,
        type: "webhook",
        passphrase: data.passphrase || undefined,
        schema: schemaObj as Record<string, unknown> | undefined,
        outputTool: data.outputTool || undefined,
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
  };

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
                <span className="text-xs text-slate-400">Optional</span>
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
                <span className="text-xs text-slate-400">Optional</span>
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
                <span className="text-xs text-slate-400">Optional</span>
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
          name="outputTool"
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-col gap-1 px-1 justify-between">
                <FormLabel>Output Tool</FormLabel>
                <span className="text-xs text-slate-400">
                  When selected, this webhook trigger will always end calling
                  the selected tool
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <FormControl>
                  <SingleToolSelector
                    value={field.value || null}
                    onChange={field.onChange}
                  />
                </FormControl>
                {field.value && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="p-1"
                    onClick={() => field.onChange("")}
                  >
                    <Icon name="close" size={12} className="text-slate-400" />
                  </Button>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root && (
          <div className="text-xs text-red-500 mt-1">
            {form.formState.errors.root.message}
          </div>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
