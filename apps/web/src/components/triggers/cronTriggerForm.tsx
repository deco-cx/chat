import { Input } from "@deco/ui/components/input.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { useState } from "react";
import {
  CronTriggerSchema,
  TriggerOutputSchema,
  useCreateTrigger,
  useUpdateTrigger,
} from "@deco/sdk";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";

const cronPresets = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at 9am (UTC)", value: "0 9 * * *" },
  { label: "Every Monday at 10am (UTC)", value: "0 10 * * 1" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Custom", value: "custom" },
];

function isValidCron(cron: string) {
  // Basic validation: 5 space-separated fields
  // Regex created by ChatGPT at 2025-05-02
  return /^(\S+\s+){4}\S+$/.test(cron);
}

function CronSelectInput({ value, onChange, required, error }: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | null;
}) {
  const [selected, setSelected] = useState(
    cronPresets[0].value,
  );
  const [custom, setCustom] = useState(selected === "custom" ? value : "");
  const [localError, setLocalError] = useState<string | null>(null);

  function handlePresetChange(val: string) {
    setSelected(val);
    if (val === "custom") {
      if (isValidCron(custom)) {
        setLocalError(null);
        onChange(custom);
      } else {
        setLocalError("Invalid cron expression");
        onChange("");
      }
    } else {
      setLocalError(null);
      onChange(val);
    }
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCustom(val);
    setSelected("custom");
    if (isValidCron(val)) {
      setLocalError(null);
      onChange(val);
    } else {
      setLocalError("Invalid cron expression");
      onChange("");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="cron-frequency">Frequency</Label>
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
      {(localError || error) && (
        <span className="text-xs text-red-500">{localError || error}</span>
      )}
      {selected === "custom" && (
        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-700 mb-2">
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
              <b>All times are in UTC</b>. For example:
              <ul className="list-disc pl-4 mt-1">
                <li>UTC 17:00 = 14:00 (BRT)</li>
                <li>UTC 20:00 = 17:00 (BRT)</li>
              </ul>
            </li>
            <li>
              <a
                href="https://crontab.guru"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                Use this generator to create and test expressions
              </a>.
            </li>
          </ul>

          <div className="font-semibold mb-1">Example:</div>
          <pre className="bg-white border rounded p-2 text-xs overflow-x-auto">
{`0 9 * * *     (every day at 9am UTC)
0 17 * * *    (every day at 5pm UTC)
*/5 * * * *   (every 5 minutes)`}
          </pre>
        </div>
      )}
    </div>
  );
}

type CronTriggerFormType = z.infer<typeof CronTriggerSchema>;

type CronTriggerData = z.infer<typeof CronTriggerSchema>;

export function CronTriggerForm({ agentId, onSuccess, initialValues }: {
  agentId: string;
  onSuccess?: () => void;
  initialValues?: z.infer<typeof TriggerOutputSchema>;
}) {
  const { mutate: createTrigger, isPending: isCreating } = useCreateTrigger(
    agentId,
  );
  const { mutate: updateTrigger, isPending: isUpdating } = useUpdateTrigger(
    agentId,
  );
  const isEditing = !!initialValues;
  const isPending = isCreating || isUpdating;

  const cronData = initialValues?.data.type === "cron"
    ? initialValues.data as CronTriggerData
    : undefined;

  const form = useForm<CronTriggerFormType>({
    resolver: zodResolver(CronTriggerSchema),
    defaultValues: {
      title: initialValues?.data.title || "",
      description: initialValues?.data.description || "",
      cronExp: cronData?.cronExp || cronPresets[0].value,
      prompt: cronData?.prompt || { messages: [{ role: "user", content: "" }] },
      type: "cron",
    },
  });

  const onSubmit = (data: CronTriggerFormType) => {
    if (!data.prompt?.messages?.[0]?.content?.trim()) {
      form.setError("prompt", { message: "Prompt is required" });
      return;
    }
    if (!data.cronExp || !isValidCron(data.cronExp)) {
      form.setError("cronExp", {
        message: "Frequency is required and must be valid",
      });
      return;
    }
    if (initialValues) {
      updateTrigger(
        {
          triggerId: initialValues.id,
          trigger: {
            title: data.title,
            description: data.description || undefined,
            cronExp: data.cronExp,
            prompt: {
              messages: [{
                role: "user",
                content: data.prompt.messages[0].content,
              }],
            },
            type: "cron",
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
          cronExp: data.cronExp,
          prompt: {
            messages: [{
              role: "user",
              content: data.prompt.messages[0].content,
            }],
          },
          type: "cron",
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
          name="cronExp"
          render={() => (
            <FormItem>
              <FormControl>
                <Controller
                  control={form.control}
                  name="cronExp"
                  render={({ field: ctrlField }) => (
                    <CronSelectInput
                      value={ctrlField.value}
                      onChange={ctrlField.onChange}
                      required
                      error={form.formState.errors.cronExp?.message}
                    />
                  )}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prompt</FormLabel>
              <FormControl>
                <Textarea
                  value={field.value?.messages?.[0]?.content || ""}
                  onChange={(e) =>
                    field.onChange({
                      messages: [{ role: "user", content: e.target.value }],
                    })}
                  placeholder="Send birthday message to the user using the SEND_BIRTHDAY_MESSAGE tool"
                  rows={3}
                  required
                />
              </FormControl>
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
            {isPending ? "Saving..." : isEditing ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
