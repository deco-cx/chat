import { useWriteFile } from "@deco/sdk";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useRef, useState } from "react";
import { useAgenticChat, useAgenticChatForm } from "../chat/provider.tsx";
import { ModelSelector } from "../chat/model-selector.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import PromptInput from "../prompts/rich-text/index.tsx";

const AVATAR_FILE_PATH = "assets/avatars";

const useAvatarFilename = () => {
  const generate = (originalFile: File) => {
    const extension =
      originalFile.name.split(".").pop()?.toLowerCase() || "png";
    return `avatar-${crypto.randomUUID()}.${extension}`;
  };

  return { generate };
};

function PromptTab() {
  const { agent, saveAgent } = useAgenticChat();
  const form = useAgenticChatForm();

  const handleSubmit = form.handleSubmit(async () => {
    await saveAgent();
  });

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
    <ScrollArea className="h-full w-full [&>div>div]:h-full">
      <Form {...form}>
        <div className="h-full w-full p-6 mx-auto @container">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 h-full">
            <div className="flex flex-col @[640px]:flex-row gap-3 w-full">
              <div className="flex flex-col @[640px]:flex-row items-start @[640px]:items-center gap-6 flex-1">
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
                            className="w-16 h-16 group aspect-square flex flex-col items-center justify-center gap-1 cursor-pointer relative overflow-hidden"
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
                <div className="flex flex-col w-full">
                  <FormField
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Untitled agent"
                            className="border-none p-0 focus-visible:ring-0 font-medium rounded text-2xl md:text-2xl h-auto placeholder:text-muted-foreground text-foreground placeholder:opacity-25 hover:bg-muted transition-colors"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Describe what this agent does..."
                            className="border-none resize-none min-h-auto p-0 shadow-none focus-visible:ring-0 text-sm rounded h-auto text-foreground placeholder:text-muted-foreground hover:bg-muted transition-colors"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className="shrink-0 w-full @[640px]:w-auto">
                <FormField
                  name="model"
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormControl>
                          <ModelSelector
                            model={field.value}
                            onModelChange={(newValue) =>
                              field.onChange(newValue)
                            }
                            variant="borderless"
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
            </div>
            <FormField
              name="instructions"
              render={({ field }) => (
                <FormItem className="flex flex-col h-full w-full">
                  <FormControl className="h-full">
                    <PromptInput
                      className="mt-2 text-foreground placeholder:text-muted-foreground"
                      placeholder="Add context and behavior to shape responses, or '/' for tools and more..."
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
