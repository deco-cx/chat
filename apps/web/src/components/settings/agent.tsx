import { useSDK, useTeam, useTeamRoles, useWriteFile } from "@deco/sdk";
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
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useRef, useState } from "react";
import { getPublicChatLink } from "../agent/chats.tsx";
import { useAgenticChat, useAgenticChatForm } from "../chat/provider.tsx";
import { ModelSelector } from "../chat/model-selector.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";

// import { Channels } from "./channels.tsx";

const AVATAR_FILE_PATH = "assets/avatars";

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

const useAvatarFilename = () => {
  const generate = (originalFile: File) => {
    const extension =
      originalFile.name.split(".").pop()?.toLowerCase() || "png";
    return `avatar-${crypto.randomUUID()}.${extension}`;
  };

  return { generate };
};

export const useCurrentTeamRoles = () => {
  const { slug } = useCurrentTeam();
  const { data: team } = useTeam(slug);
  const teamId = team?.id;
  const { data: roles = [] } = useTeamRoles(teamId ?? null);
  return roles;
};

function SettingsTab() {
  const { agent } = useAgenticChat();
  const form = useAgenticChatForm();
  const handleSubmit = form?.handleSubmit(async () => {
    // Form submission handled by provider's saveAgent
  });
  const roles = useCurrentTeamRoles();

  const writeFileMutation = useWriteFile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { generate: generateAvatarFilename } = useAvatarFilename();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    try {
      setIsUploading(true);
      const filename = generateAvatarFilename(file);
      const path = `${AVATAR_FILE_PATH}/${filename}`;
      const buffer = await file.arrayBuffer();
      await writeFileMutation.mutateAsync({
        path,
        contentType: file.type,
        content: new Uint8Array(buffer),
      });

      form.setValue("avatar", path, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    } catch (error) {
      console.error("Failed to upload avatar:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full p-4 max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6 py-2 pb-16">
            <FormField
              name="name"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-6">
                    <FormField
                      control={form.control}
                      name="avatar"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-center items-center">
                            <input
                              type="file"
                              ref={fileInputRef}
                              accept="image/*"
                              className="hidden"
                              onChange={handleFileChange}
                            />
                            <FormControl>
                              <div
                                className="w-16 h-16 group aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer relative overflow-hidden"
                                onClick={triggerFileInput}
                              >
                                {isUploading ? (
                                  <Skeleton
                                    className={cn("w-full h-full rounded-xl")}
                                  />
                                ) : (
                                  <>
                                    <AgentAvatar
                                      url={field.value || agent.avatar}
                                      fallback={agent.name}
                                      size="xl"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                      <Icon
                                        name="upload"
                                        className="text-white text-xl"
                                      />
                                    </div>
                                    <Input type="hidden" {...field} />
                                  </>
                                )}
                              </div>
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex-1 flex flex-col gap-1">
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter agent name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Model</FormLabel>
                  <FormControl>
                    <ModelSelector
                      model={field.value}
                      onModelChange={(newValue) => field.onChange(newValue)}
                      variant="bordered"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="max_steps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Steps</FormLabel>
                  <FormDescription className="text-xs text-muted-foreground">
                    Maximum number of sequential LLM calls an agent can make.
                  </FormDescription>
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
                  <FormLabel>Max Tokens</FormLabel>
                  <FormDescription className="text-xs text-muted-foreground">
                    The maximum number of tokens the agent can generate.
                  </FormDescription>
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

            {/* Visibility Section */}
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

            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormDescription className="text-xs text-muted-foreground">
                    Used for search and organization, it does not affect agent
                    behavior.
                  </FormDescription>
                  <FormControl>
                    <Textarea
                      placeholder="e.g. Helps write product descriptions for the online store"
                      className="min-h-18 border-border"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-6">{/* <Channels /> */}</div>
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default SettingsTab;
