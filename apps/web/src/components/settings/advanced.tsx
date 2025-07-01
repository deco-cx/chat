import { useSDK, useTeam, useTeamRoles } from "@deco/sdk";
import {
  DEFAULT_MAX_STEPS,
  MAX_MAX_STEPS,
  MAX_MAX_TOKENS,
  MIN_MAX_TOKENS,
} from "@deco/sdk/constants";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Switch } from "@deco/ui/components/switch.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { getPublicChatLink } from "../agent/chats.tsx";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { Channels } from "./channels.tsx";

export const useCurrentTeamRoles = () => {
  const { slug } = useCurrentTeam();
  const { data: team } = useTeam(slug);
  const teamId = team?.id;
  const { data: roles = [] } = useTeamRoles(teamId ?? null);
  return roles;
};

function CopyLinkButton(
  { className, link }: { className: string; link: string },
) {
  const [isCopied, setIsCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      aria-label="Copy link"
      className={className}
      onClick={() => {
        navigator.clipboard.writeText(link);
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      }}
    >
      <Icon name={isCopied ? "check" : "link"} size={16} />
      Copy link
    </Button>
  );
}

function AdvancedTab() {
  const {
    form,
    agent,
    handleSubmit,
  } = useAgentSettingsForm();
  const roles = useCurrentTeamRoles();

  const useWorkingMemory = useWatch({
    control: form.control,
    name: "memory.working_memory.enabled",
    defaultValue: form.getValues("memory.working_memory.enabled"),
  });

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full p-4 max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="space-y-6 py-2 pb-16"
          >
            <FormField
              name="visibility"
              render={({ field }) => {
                const { workspace } = useSDK();
                const isPublic = field.value === "PUBLIC";
                const publicLink = getPublicChatLink(agent.id, workspace);

                return (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-2">
                        <FormLabel>Visibility</FormLabel>
                        <FormDescription className="text-xs text-muted-foreground">
                          Control who can interact with this agent.
                        </FormDescription>
                      </div>

                      <CopyLinkButton
                        link={publicLink}
                        className={cn(isPublic ? "visible" : "invisible")}
                      />
                    </div>

                    <FormControl>
                      <Select
                        value={field.value ?? "PRIVATE"}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WORKSPACE">
                            <div className="flex items-center gap-2">
                              <Icon name="groups" />
                              <span>Team</span>
                              <span className="text-xs text-muted-foreground">
                                Members of your team can access and edit the
                                agent
                              </span>
                            </div>
                          </SelectItem>
                          <SelectItem value="PUBLIC">
                            <div className="flex items-center gap-2">
                              <Icon name="public" />
                              <span>Public</span>
                              <span className="text-xs text-muted-foreground">
                                Anyone with the link can view and use the agent.
                              </span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              name="max_steps"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-col gap-2">
                    <FormLabel>
                      Max Steps{" "}
                      <a
                        href="https://mastra.ai/en/docs/agents/overview#using-maxsteps"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon
                          name="open_in_new"
                          className="w-4 h-4"
                        />
                      </a>
                    </FormLabel>
                    <FormDescription className="text-xs text-muted-foreground">
                      Maximum number of sequential LLM calls an agent can make.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={MAX_MAX_STEPS}
                      defaultValue={DEFAULT_MAX_STEPS}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="max_tokens"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-col gap-2">
                    <FormLabel>Max Tokens</FormLabel>
                    <FormDescription className="text-xs text-muted-foreground">
                      The maximum number of tokens the agent can generate.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      min={MIN_MAX_TOKENS}
                      max={MAX_MAX_TOKENS}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* --- Memory Settings Section (migrated from memory.tsx) --- */}
            <FormField
              control={form.control}
              name="memory.last_messages"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-col gap-2">
                    <FormLabel>
                      Context Window{" "}
                      <a
                        href="https://mastra.ai/en/docs/memory/overview#conversation-history"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon
                          name="open_in_new"
                          className="w-4 h-4"
                        />
                      </a>
                    </FormLabel>
                    <FormDescription className="text-xs text-muted-foreground">
                      The number of recent messages to keep in memory context
                      window.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="Number of past messages to remember"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="memory.semantic_recall"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <FormLabel>
                      Semantic Recall{" "}
                      <a
                        href="https://mastra.ai/en/docs/memory/semantic-recall"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon
                          name="open_in_new"
                          className="w-4 h-4"
                        />
                      </a>
                    </FormLabel>
                    <FormDescription className="text-xs text-muted-foreground">
                      Enable the agent to recall relevant information from past
                      conversations.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex flex-col items-center justify-between gap-4">
              <div className="flex flex-row items-center justify-between w-full">
                <FormField
                  control={form.control}
                  name="memory.working_memory.enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between w-full">
                      <div className="flex flex-col gap-2">
                        <FormLabel>
                          Working Memory{" "}
                          <a
                            href="https://mastra.ai/en/docs/memory/working-memory"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Icon
                              name="open_in_new"
                              className="w-4 h-4"
                            />
                          </a>
                        </FormLabel>
                        <FormDescription className="text-xs text-muted-foreground">
                          Allow the agent to maintain a short-term memory for
                          ongoing tasks.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              {useWorkingMemory && (
                <FormField
                  control={form.control}
                  name="memory.working_memory.template"
                  render={({ field }) => {
                    let isJson = false;
                    try {
                      if (field.value && typeof field.value === "string") {
                        JSON.parse(field.value);
                        isJson = true;
                      }
                    } catch {
                      isJson = false;
                    }
                    return (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormLabel>Working Memory Template</FormLabel>
                          {isJson && (
                            <span className="px-2 py-0.5 text-xs bg-muted rounded text-muted-foreground border border-muted-foreground/20">
                              Schema
                            </span>
                          )}
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder="Define a template (markdown or JSON schema) for the working memory..."
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormDescription className="text-xs text-muted-foreground">
                          Use markdown for a text template, or paste a JSON
                          schema to structure the agent's working memory.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              )}
            </div>

            {/* --- End Memory Settings Section --- */}

            {/* Team Access Section */}
            {roles.length > 0 && (
              <FormField
                name="access"
                control={form.control}
                render={({ field }) => {
                  return (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-2">
                          <FormLabel>Access</FormLabel>
                          <FormDescription className="text-xs text-muted-foreground">
                            Control who can access with this agent by role.
                          </FormDescription>
                        </div>
                      </div>

                      <FormControl>
                        <Select
                          value={`${field.value}`}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.name}>
                                <Icon
                                  name={role.name === "owner"
                                    ? "lock_person"
                                    : "groups"}
                                />
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}

            <div className="border-t pt-6">
            </div>
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default AdvancedTab;
