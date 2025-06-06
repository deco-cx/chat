import {
  useSDK,
  useTeamRoles,
  useWriteFile,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
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
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { ModelSelector } from "../chat/model-selector.tsx";
import { AgentAvatar } from "../common/avatar/index.tsx";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { Channels } from "./channels.tsx";

const AVATAR_FILE_PATH = "assets/avatars";

// Token limits for Anthropic models
const ANTHROPIC_MIN_MAX_TOKENS = 4096;
const ANTHROPIC_MAX_MAX_TOKENS = 64000;

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

const useAvatarFilename = () => {
  const generate = (originalFile: File) => {
    const extension = originalFile.name.split(".").pop()?.toLowerCase() ||
      "png";
    return `avatar-${crypto.randomUUID()}.${extension}`;
  };

  return { generate };
};

export const useCurrentTeamRoles = () => {
  const { slug } = useCurrentTeam();
  const { data: roles = [] } = useTeamRoles(slug || null);
  return roles;
};

function SettingsTab() {
  const {
    form,
    agent,
    handleSubmit,
  } = useAgentSettingsForm();
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
          <form
            onSubmit={handleSubmit}
            className="space-y-6 py-2 pb-16"
          >
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
                                {isUploading
                                  ? (
                                    <Skeleton
                                      className={cn(
                                        "w-full h-full rounded-xl",
                                      )}
                                    />
                                  )
                                  : (
                                    <>
                                      <AgentAvatar
                                        name={agent.name}
                                        avatar={field.value || agent.avatar}
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
                        <Input
                          placeholder="Enter agent name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              name="max_tokens"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Tokens</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={ANTHROPIC_MIN_MAX_TOKENS}
                      max={ANTHROPIC_MAX_MAX_TOKENS}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
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

            {/* Team Access Section */}
            <FormField
              name="access"
              render={({ field }) => {
                const { workspace } = useSDK();
                const isPublic = field.value.includes("public") &&
                  !(agent.id in WELL_KNOWN_AGENTS);
                const publicLink = getPublicChatLink(agent.id, workspace);

                return (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-2">
                        <FormLabel>Access</FormLabel>
                        <FormDescription className="text-xs text-muted-foreground">
                          Control who can access with this agent by role.
                        </FormDescription>
                      </div>
                      <CopyLinkButton
                        link={publicLink}
                        className={cn(isPublic ? "visible" : "invisible")}
                      />
                    </div>

                    <FormControl>
                      <Select
                        value={`${field.value}`}
                        onValueChange={(value) => field.onChange([value])}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.name}>
                              <Icon
                                name={role.name === "private"
                                  ? "lock_person"
                                  : role.name === "public"
                                  ? "public"
                                  : "groups"}
                              />
                              {role.name}
                              <span className="text-xs text-muted-foreground">
                                {role.name === "private"
                                  ? "Only me"
                                  : role.name === "public"
                                  ? "Anyone with the link"
                                  : `Team ${role.name}s`}
                              </span>
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

            <div className="border-t pt-6">
              <Channels />
            </div>
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default SettingsTab;
