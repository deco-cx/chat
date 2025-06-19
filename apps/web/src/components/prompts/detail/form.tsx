import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import PromptInput from "../rich-text/index.tsx";
import { useFormContext } from "./context.ts";

export function DetailForm() {
  const {
    onSubmit,
    form,
  } = useFormContext();

  return (
    <ScrollArea className="h-full w-full p-6 text-foreground">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 px-1 max-w-3xl mx-auto"
        >
          <div className="flex items-center gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Shopify"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Brief description of the prompt"
                    className="min-h-[100px]"
                    {...field}
                    value={field.value || undefined}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <PromptInput
                    placeholder="The prompt content"
                    className="min-h-[49lvh]"
                    enableMentions
                    excludeIds={[form.getValues("id")]}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </ScrollArea>
  );
}
