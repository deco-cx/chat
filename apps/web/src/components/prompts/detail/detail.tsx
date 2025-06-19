import {
  type Prompt,
  PromptValidationSchema,
  useAgent,
  usePrompt,
  useUpdateAgentCache,
  useUpdatePrompt,
  WELL_KNOWN_AGENT_IDS,
} from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useBlocker, useParams } from "react-router";
import { trackEvent } from "../../../hooks/analytics.ts";
import { ChatInput } from "../../chat/chat-input.tsx";
import { ChatMessages } from "../../chat/chat-messages.tsx";
import { ChatProvider } from "../../chat/context.tsx";
import type { Tab } from "../../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../../layout.tsx";
import { Context } from "./context.ts";
import { DetailForm } from "./form.tsx";

function MainChat() {
  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0">
        <ChatMessages />
      </ScrollArea>
      <div className="p-2">
        <ChatInput />
      </div>
    </div>
  );
}

const TABS: Record<string, Tab> = {
  main: {
    Component: MainChat,
    title: "Chat",
    initialOpen: "left",
  },
  form: {
    Component: DetailForm,
    title: "Prompt",
    initialOpen: "right",
  },
};

export default function Page() {
  const agentId = WELL_KNOWN_AGENT_IDS.promptAgent;

  const { id } = useParams();
  const promptId = id!;
  const threadId = promptId;

  const { data: _prompt } = usePrompt(promptId);
  const prompt = _prompt || {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    content: "",
    created_at: new Date().toISOString(),
    updated_at: null,
  };
  const { data: agent } = useAgent(agentId);
  const updateAgentCache = useUpdateAgentCache();

  const form = useForm<Prompt>({
    resolver: zodResolver(PromptValidationSchema),
    defaultValues: {
      id: prompt.id,
      name: prompt.name,
      description: prompt.description,
      content: prompt.content,
    },
  });

  const updatePrompt = useUpdatePrompt();
  const isMutating = updatePrompt.isPending;

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;
  const blocker = useBlocker(numberOfChanges > 0);

  function handleCancel() {
    blocker.reset?.();
  }

  const handleDiscard = () => {
    form.reset(prompt);
    blocker.proceed?.();
  };

  const onSubmit = async (data: Prompt) => {
    try {
      // Update the existing integration
      await updatePrompt.mutateAsync({
        id: prompt.id,
        data,
      });

      trackEvent("prompt_update", {
        success: true,
        data,
      });

      form.reset(data);
    } catch (error) {
      console.error(
        `Error updating prompt:`,
        error,
      );

      trackEvent("prompt_create", {
        success: false,
        error,
        data,
      });
    }
  };

  useEffect(() => {
    if (!prompt) {
      return;
    }

    updateAgentCache({
      ...agent,
      instructions:
        `${agent.instructions}\n\nThe current prompt Id is "${prompt.id}"`,
    });
  }, [prompt]);

  return (
    <>
      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you leave this page, your edits will
              be lost. Are you sure you want to discard your changes and
              navigate away?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ChatProvider
        agentId={agentId}
        threadId={threadId}
        uiOptions={{ showEditAgent: false }}
      >
        <Context.Provider
          value={{ form, prompt, onSubmit }}
        >
          <PageLayout
            tabs={TABS}
            actionButtons={
              <div
                className={cn(
                  "flex items-center gap-2",
                  "transition-opacity",
                  numberOfChanges > 0 ? "opacity-100" : "opacity-0",
                )}
              >
                <Button
                  type="button"
                  variant="outline"
                  className="text-foreground"
                  onClick={handleDiscard}
                >
                  Discard
                </Button>
                <Button
                  className="bg-primary-light text-primary-dark hover:bg-primary-light/90 gap-2"
                  disabled={!numberOfChanges}
                  onClick={() => {
                    onSubmit(form.getValues());
                  }}
                >
                  {isMutating
                    ? (
                      <>
                        <Spinner size="xs" />
                        <span>Saving...</span>
                      </>
                    )
                    : (
                      <span>
                        Save {numberOfChanges}{" "}
                        change{numberOfChanges > 1 ? "s" : ""}
                      </span>
                    )}
                </Button>
              </div>
            }
            breadcrumb={
              <DefaultBreadcrumb
                items={[
                  { label: "Prompt Library", link: "/prompts" },
                  ...(prompt?.name ? [{ label: prompt.name }] : []),
                ]}
              />
            }
          />
        </Context.Provider>
      </ChatProvider>
    </>
  );
}
