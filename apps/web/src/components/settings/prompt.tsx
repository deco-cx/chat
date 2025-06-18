import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import PromptInput from "../prompts/rich-text/index.tsx";

function PromptTab() {
  const {
    form,
    handleSubmit,
  } = useAgentSettingsForm();

  return (
    <ScrollArea className="h-full w-full [&>div>div]:h-full">
      <Form {...form}>
        <div className="h-full w-full p-4 pt-2 mx-auto">
          <form
            onSubmit={handleSubmit}
            className="space-y-6 h-full"
          >
            <FormField
              name="instructions"
              render={({ field }) => (
                <FormItem className="h-full">
                  <FormControl>
                    <PromptInput
                      placeholder="Add context or behavior to shape responses (e.g., 'Be concise and reply in English.')"
                      enableMentions
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default PromptTab;
