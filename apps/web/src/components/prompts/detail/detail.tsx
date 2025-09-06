import {
  type Prompt,
  PromptValidationSchema,
  useAgentData,
  usePrompt,
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
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useBlocker, useParams } from "react-router";
import { trackEvent } from "../../../hooks/analytics.ts";
import { AgentProvider } from "../../agent/provider.tsx";
import type { Tab } from "../../dock/index.tsx";
import { togglePanel } from "../../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../../layout/project.tsx";
import { Context } from "./context.ts";
import { DetailForm } from "./form.tsx";
import HistoryTab from "./history.tsx";

const FORM_TAB: Record<string, Tab> = {
  form: {
    Component: DetailForm,
    title: "Prompt",
    initialOpen: "right",
  },
};

const TABS: Record<string, Tab> = {
  ...FORM_TAB,
  history: {
    Component: HistoryTab,
    title: "History",
    initialOpen: false,
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
  const { data: _agent } = useAgentData(agentId);

  const [selectedPrompt, setSelectedPrompt] = useState<Prompt>(prompt);
  const [promptVersion, setPromptVersion] = useState<string | null>(null);

  const form = useForm<Prompt>({
    resolver: zodResolver(PromptValidationSchema),
    defaultValues: {
      id: selectedPrompt.id,
      name: selectedPrompt.name,
      description: selectedPrompt.description,
      content: selectedPrompt.content,
    },
  });

  useEffect(() => {
    form.reset(selectedPrompt);
  }, [selectedPrompt]);

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
      console.error(`Error updating prompt:`, error);

      trackEvent("prompt_create", {
        success: false,
        error,
        data,
      });
    }
  };

  const handleRestoreVersion = async () => {
    await updatePrompt.mutateAsync({
      id: prompt.id,
      data: {
        name: selectedPrompt.name,
        content: selectedPrompt.content,
      },
    });
    setPromptVersion(null);
  };

  // Note: Removed useUpdateAgentCache usage - agent instructions are now managed
  // via AgentProvider in the new architecture. The prompt ID context should be
  // passed via chat overrides instead of modifying cached agent data.

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
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AgentProvider
        agentId={agentId}
        threadId={threadId}
        uiOptions={{ showEditAgent: false }}
      >
        <Context.Provider
          value={{
            form,
            prompt: selectedPrompt,
            setSelectedPrompt,
            onSubmit,
            promptVersion,
            setPromptVersion,
          }}
        >
          <PageLayout
            hideViewsButton
            tabs={prompt.readonly ? FORM_TAB : TABS}
            actionButtons={
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        togglePanel({
                          id: "history",
                          component: "history",
                          title: "History",
                          position: { direction: "right" },
                        });
                      }}
                    >
                      <Icon name="history" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Version history</TooltipContent>
                </Tooltip>
                <div
                  className={cn(
                    promptVersion ? "opacity-100" : "opacity-0 w-0",
                  )}
                >
                  <Button variant="default" onClick={handleRestoreVersion}>
                    Restore version
                  </Button>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-2",
                    "transition-opacity",
                    numberOfChanges > 0 ? "opacity-100" : "opacity-0 w-0",
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
                    disabled={!numberOfChanges || prompt.readonly}
                    onClick={() => {
                      onSubmit(form.getValues());
                    }}
                  >
                    {isMutating ? (
                      <>
                        <Spinner size="xs" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>
                        Save {numberOfChanges} change
                        {numberOfChanges > 1 ? "s" : ""}
                      </span>
                    )}
                  </Button>
                </div>
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
      </AgentProvider>
    </>
  );
}
