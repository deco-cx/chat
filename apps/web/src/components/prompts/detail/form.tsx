import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import PromptInput from "../rich-text/index.tsx";
import { useFormContext } from "./context.ts";

export function DetailForm() {
  const { onSubmit, form, prompt } = useFormContext();

  const isReadonly = prompt.readonly;

  return (
    <ScrollArea className="h-full w-full p-6 text-foreground">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 px-1 mx-auto"
        >
          <div className="flex items-center gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <input
                      placeholder="Untitled prompt"
                      disabled={isReadonly}
                      className="border-none! px-0 text-2xl! font-bold outline-none!"
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
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <PromptInput
                    placeholder="Write instructions or '/’ for tools and more..."
                    className="min-h-[49lvh]"
                    disabled={isReadonly}
                    enableMentions
                    hideMentionsLabel
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
