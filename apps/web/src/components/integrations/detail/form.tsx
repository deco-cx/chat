import { type MCPConnection, useWriteFile } from "@deco/sdk";
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
import { useRef, useState } from "react";
import { useCurrentTeamRoles } from "../../settings/agent.tsx";
import { IntegrationIcon } from "../list/common.tsx";
import { useFormContext } from "./context.ts";

const ICON_FILE_PATH = "assets/integrations";

const useIconFilename = () => {
  const generate = (originalFile: File) => {
    const extension = originalFile.name.split(".").pop()?.toLowerCase() ||
      "png";
    return `icon-${crypto.randomUUID()}.${extension}`;
  };

  return { generate };
};

export function DetailForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    integration: editIntegration,
    onSubmit,
    form,
  } = useFormContext();
  const roles = useCurrentTeamRoles();

  const writeFileMutation = useWriteFile();
  const { generate: generateIconFilename } = useIconFilename();
  const [isUploading, setIsUploading] = useState(false);

  const iconValue = form.watch("icon");
  const connection = form.watch("connection");

  // Handle connection type change
  const handleConnectionTypeChange = (value: MCPConnection["type"]) => {
    const ec = editIntegration.connection;

    form.setValue(
      "connection",
      value === "SSE" || value === "HTTP"
        ? {
          type: value,
          url: ec?.type === "SSE"
            ? ec.url || "https://example.com/sse"
            : "https://example.com/sse",
        }
        : value === "Websocket"
        ? {
          type: "Websocket",
          url: ec?.type === "Websocket"
            ? ec.url || "wss://example.com/ws"
            : "wss://example.com/ws",
        }
        : {
          type: "Deco",
          tenant: ec?.type === "Deco" ? ec.tenant || "tenant-id" : "tenant-id",
        },
    );
  };

  // Function to handle file input changes (image upload)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    try {
      setIsUploading(true);
      const filename = generateIconFilename(file);
      const path = `${ICON_FILE_PATH}/${filename}`;
      const buffer = await file.arrayBuffer();
      await writeFileMutation.mutateAsync({
        path,
        contentType: file.type,
        content: new Uint8Array(buffer),
      });

      form.setValue("icon", path, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    } catch (error) {
      console.error("Failed to upload icon:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // Function to trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <ScrollArea className="h-full w-full p-6 text-foreground">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 px-1 max-w-3xl mx-auto"
        >
          <div className="flex items-center gap-6">
            <FormField
              control={form.control}
              name="icon"
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
                        className="w-16 h-16 group aspect-square rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer relative overflow-hidden"
                        onClick={triggerFileInput}
                      >
                        {iconValue
                          ? (
                            <>
                              {isUploading
                                ? <Skeleton className="rounded-2xl w-16 h-16" />
                                : (
                                  <div className="relative w-full h-full">
                                    <IntegrationIcon
                                      icon={iconValue}
                                      name={form.getValues("name") ||
                                        "Integration"}
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                      <Icon
                                        name="upload"
                                        className="text-white text-xl"
                                      />
                                    </div>
                                  </div>
                                )}
                            </>
                          )
                          : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1 hover:bg-muted rounded-lg p-2 border border-border">
                              <Icon
                                name="upload"
                                className="text-muted-foreground/70 text-xl"
                              />
                              <span className="text-xs text-muted-foreground/70 text-center px-1">
                                Upload Icon
                              </span>
                            </div>
                          )}
                        <Input type="hidden" {...field} />
                      </div>
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Shopify"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Team Access Section */}
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
                        Control who can access and interact with this
                        integration.
                      </FormDescription>
                    </div>
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
                        {roles
                          // public access makes no sense for integrations so far
                          .filter((role) => role.name !== "public")
                          .map((role) => (
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
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Brief description of the integration"
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FormLabel>Connection</FormLabel>
            </div>
            <div className="space-y-4 p-4 border rounded-md">
              <FormField
                control={form.control}
                name="connection.type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Connection Type</FormLabel>
                    <Select
                      onValueChange={(value: MCPConnection["type"]) => {
                        field.onChange(value);
                        handleConnectionTypeChange(value);
                      }}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a connection type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SSE">
                          Server-Sent Events (SSE)
                        </SelectItem>
                        <SelectItem value="Websocket">WebSocket</SelectItem>
                        <SelectItem value="Deco">Deco</SelectItem>
                        <SelectItem value="HTTP">HTTP</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {["SSE", "HTTP"].includes(connection.type) && (
                <>
                  <FormField
                    control={form.control}
                    name="connection.url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{connection.type} URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com/sse"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="connection.token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token</FormLabel>
                        <span className="text-[10px] text-muted-foreground ml-1">
                          optional
                        </span>
                        <FormControl>
                          <Input placeholder="token" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {connection.type === "Websocket" && (
                <FormField
                  control={form.control}
                  name="connection.url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WebSocket URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="wss://example.com/ws"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {connection.type === "Deco" && (
                <>
                  <FormField
                    control={form.control}
                    name="connection.tenant"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenant ID</FormLabel>
                        <FormControl>
                          <Input placeholder="tenant-id" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="connection.token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token</FormLabel>
                        <span className="text-[10px] text-muted-foreground ml-1">
                          optional
                        </span>
                        <FormControl>
                          <Input placeholder="token" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>
          </div>
        </form>
      </Form>
    </ScrollArea>
  );
}
