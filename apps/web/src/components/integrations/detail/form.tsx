import {
  type Integration,
  type MCPConnection,
  useUpdateIntegration,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { useRef } from "react";
import { useNavigate } from "react-router";
import { trackEvent } from "../../../hooks/analytics.ts";
import { useBasePath } from "../../../hooks/useBasePath.ts";
import { useFormContext } from "./context.ts";

export function DetailForm() {
  const { integration: editIntegration, form } = useFormContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const withBasePath = useBasePath();

  const updateIntegration = useUpdateIntegration();

  const isMutating = updateIntegration.isPending;

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
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      form.setValue("icon", base64String, { shouldValidate: true });
    };
    reader.readAsDataURL(file);
  };

  // Function to trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const onSubmit = async (data: Integration) => {
    try {
      // Update the existing integration
      await updateIntegration.mutateAsync(data);

      trackEvent("integration_update", {
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        `Error updating integration:`,
        error,
      );

      trackEvent("integration_create", {
        success: false,
        error,
        data,
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-[20%_1fr] gap-2">
          <div className="space-y-2">
            <FormLabel>Icon</FormLabel>
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <FormControl>
                      <div
                        className="group aspect-square rounded-md border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-1 bg-muted/10 cursor-pointer hover:bg-muted/20 transition-colors relative overflow-hidden"
                        onClick={triggerFileInput}
                      >
                        {iconValue && /^(data:)|(http?s:)/.test(iconValue)
                          ? (
                            <>
                              <img
                                src={iconValue}
                                alt="Icon preview"
                                className="w-full h-full object-contain"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Icon
                                  name="upload"
                                  className="text-white text-xl"
                                />
                              </div>
                            </>
                          )
                          : (
                            <>
                              <Icon
                                name="upload"
                                className="text-muted-foreground/70 text-xl"
                              />
                              <span className="text-xs text-muted-foreground/70 text-center px-1">
                                Upload Icon
                              </span>
                            </>
                          )}
                        <Input
                          type="hidden"
                          {...field}
                        />
                      </div>
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
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
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(withBasePath("/integrations/marketplace"))}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isMutating} className="gap-2">
            {isMutating
              ? (
                <>
                  <Spinner size="xs" />
                  Updating...
                </>
              )
              : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
