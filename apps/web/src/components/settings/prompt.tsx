import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import PromptInput from "../prompts/rich-text/index.tsx";
import { SelectPromptsDialog } from "../prompts/select-prompts-dialog.tsx";
import { SelectedPrompts } from "../prompts/selected-prompts.tsx";

function PromptTab() {
  const {
    form,
    handleSubmit,
  } = useAgentSettingsForm();

  const additionalPrompts = form.watch("additional_prompts") || [];

  const handleAddPrompts = (promptIds: string[]) => {
    try {
      // Merge with existing prompts, avoiding duplicates
      const existingPrompts = new Set(additionalPrompts);
      const newPrompts = promptIds.filter((id) => !existingPrompts.has(id));

      if (newPrompts.length > 0) {
        form.setValue("additional_prompts", [
          ...additionalPrompts,
          ...newPrompts,
        ]);
      }
    } catch (error) {
      console.error('Error adding prompts:', error);
    }
  };

  const handleRemovePrompt = (promptId: string) => {
    const updated = additionalPrompts.filter((id: string) => id !== promptId);
    form.setValue("additional_prompts", updated);
  };

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full p-4 pt-2 mx-auto">
          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <FormField
              name="instructions"
              render={({ field }) => (
                <FormItem>
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
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Additional Prompts</div>
                <SelectPromptsDialog
                  selectedPromptIds={additionalPrompts}
                  onSelect={handleAddPrompts}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Icon name="add" size={16} />
                      <span>Add Prompts</span>
                    </Button>
                  }
                />
              </div>
              
              <SelectedPrompts
                promptIds={additionalPrompts}
                onRemovePrompt={handleRemovePrompt}
              />
            </div>
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default PromptTab;
