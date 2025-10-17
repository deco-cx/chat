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
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
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
import { cn } from "@deco/ui/lib/utils.ts";
import { useState } from "react";
import { getPublicChatLink } from "../agent/chats.tsx";
import { useAgenticChat, useAgenticChatForm } from "../chat/provider.tsx";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { Channels } from "./channels.tsx";

export const useCurrentTeamRoles = () => {
  const { slug } = useCurrentTeam();
  const { data: team } = useTeam(slug);
  const teamId = team?.id;
  const { data: roles = [] } = useTeamRoles(teamId ?? null);
  return roles;
};

function CopyLinkButton({
  className,
  link,
}: {
  className: string;
  link: string;
}) {
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
  const { agent, saveAgent } = useAgenticChat();
  const form = useAgenticChatForm();

  const handleSubmit = form.handleSubmit(async () => {
    await saveAgent();
  });
  const roles = useCurrentTeamRoles();

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full p-4 max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6 py-2 pb-16">
            <FormField
              name="visibility"
              render={({ field }) => {
                const { locator } = useSDK();
                const isPublic = field.value === "PUBLIC";
                const publicLink = getPublicChatLink(agent.id, locator);

                return (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-2">
                        <FormLabel>Visibility</FormLabel>
                        <FormDescription>
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
                              <Icon className="text-foreground" name="groups" />
                              <span className="text-foreground">Team</span>
                              <span className="text-xs text-muted-foreground">
                                Members of your team can access and edit the
                                agent
                              </span>
                            </div>
                          </SelectItem>
                          <SelectItem value="PUBLIC">
                            <div className="flex items-center gap-2">
                              <Icon className="text-foreground" name="public" />
                              <span className="text-foreground">Public</span>
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
                        <Icon name="open_in_new" className="w-4 h-4" />
                      </a>
                    </FormLabel>
                    <FormDescription>
                      Maximum number of sequential LLM calls an agent can make.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={MAX_MAX_STEPS}
                      step={1}
                      placeholder={String(DEFAULT_MAX_STEPS)}
                      value={field.value === undefined ? "" : field.value}
                      onChange={(event) => {
                        const rawValue = event.currentTarget.value;
                        if (rawValue === "") {
                          field.onChange(undefined);
                          return;
                        }
                        const nextValue = Number.parseInt(rawValue, 10);
                        field.onChange(
                          Number.isNaN(nextValue) ? undefined : nextValue,
                        );
                      }}
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
                    <FormDescription>
                      The maximum number of tokens the agent can generate.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      min={MIN_MAX_TOKENS}
                      max={MAX_MAX_TOKENS}
                      value={field.value ?? ""}
                      onChange={(event) => {
                        const nextValue = event.currentTarget.valueAsNumber;
                        field.onChange(
                          Number.isNaN(nextValue) ? undefined : nextValue,
                        );
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="temperature"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-col gap-2">
                    <FormLabel>Temperature</FormLabel>
                    <FormDescription>
                      The temperature of the LLM.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={field.value ?? ""}
                      onChange={(event) => {
                        const nextValue = event.currentTarget.valueAsNumber;
                        field.onChange(
                          Number.isNaN(nextValue) ? undefined : nextValue,
                        );
                      }}
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
                        <Icon name="open_in_new" className="w-4 h-4" />
                      </a>
                    </FormLabel>
                    <FormDescription>
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
                          <FormDescription>
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
                                  name={
                                    role.name === "owner"
                                      ? "lock_person"
                                      : "groups"
                                  }
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
              <Channels />
            </div>
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

AdvancedTab.Skeleton = () => (
  <ScrollArea className="h-full w-full">
    <div className="h-full w-full p-4 max-w-3xl mx-auto">
      <div className="space-y-6 py-2 pb-16">
        {/* Visibility Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-24" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Input Fields Section */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-4" />
              </div>
              <Skeleton className="h-4 w-80" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        ))}

        {/* Context Window Section */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Team Access Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Channels Section */}
        <div className="border-t pt-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-80" />
            </div>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-11" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </ScrollArea>
);

export default AdvancedTab;
