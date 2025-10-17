import {
  listTools,
  useChannels,
  useConnectionChannels,
  useCreateChannel,
  useIntegrations,
  useJoinChannel,
  useLeaveChannel,
  useRemoveChannel,
} from "@deco/sdk/hooks";
import type { Channel, Integration } from "@deco/sdk/models";
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
import { FormControl, FormItem, FormLabel } from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useMemo, useState } from "react";
import { useAgenticChat } from "../chat/provider.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";
import { InstalledConnections } from "../integrations/installed-connections.tsx";
import { Dialog } from "@deco/ui/components/dialog.tsx";
import { DialogTrigger } from "@deco/ui/components/dialog.tsx";
import { DialogContent } from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Binding, WellKnownBindings } from "@deco/sdk/mcp/bindings";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@deco/ui/components/popover.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@deco/ui/components/command.tsx";

interface ChannelsProps {
  className?: string;
}

interface ChannelCardProps {
  channel: Channel;
  children: React.ReactNode;
  variant?: "agent" | "available";
}

function ChannelCard({
  channel,
  children,
  variant = "agent",
}: ChannelCardProps) {
  const integration = channel.integration;
  const isAgentVariant = variant === "agent";

  return (
    <div
      className={cn(
        "border border-input rounded-xl py-2 px-3 h-10 flex gap-2 items-center",
        !isAgentVariant && "justify-between",
      )}
    >
      <div className="flex items-center gap-2">
        <IntegrationIcon
          icon={integration?.icon ?? ""}
          name={integration?.name}
          className="w-8 h-8"
        />

        <p className="text-sm text-foreground font-medium">
          {integration?.name ?? "Unknown"}
        </p>
        <span className="text-sm text-foreground font-normal">
          {channel.name ?? channel.discriminator}
        </span>
      </div>
      {children}
    </div>
  );
}

export function Channels({ className }: ChannelsProps) {
  const [discriminator, setDiscriminator] = useState("");
  const [name, setName] = useState<string | undefined>(undefined);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [confirmChannelSwitch, setConfirmChannelSwitch] = useState<{
    channelId: string;
    channelName: string;
  } | null>(null);
  const { agent } = useAgenticChat();
  const { mutate: createChannel, isPending: isCreating } = useCreateChannel();
  const joinChannelMutation = useJoinChannel();
  const leaveChannelMutation = useLeaveChannel();
  const removeChannelMutation = useRemoveChannel();
  const { data: channels, isLoading: isLoadingChannels } = useChannels();

  const [integration, setIntegration] = useState<Integration | null>(null);
  const allChannels = channels?.channels || [];
  const agentChannels = useMemo(
    () => allChannels.filter((channel) => channel.agentIds.includes(agent.id)),
    [allChannels, agent.id],
  );
  const availableChannels = useMemo(
    () => allChannels.filter((channel) => !channel.agentIds.includes(agent.id)),
    [allChannels, agent.id],
  );
  const { data: integrations } = useIntegrations();

  // Helper functions to check if specific channel is being processed
  const isLeavingChannel = (channelId: string) => {
    return (
      leaveChannelMutation.isPending &&
      leaveChannelMutation.variables?.channelId === channelId
    );
  };

  const isJoiningChannel = (channelId: string) => {
    return (
      joinChannelMutation.isPending &&
      joinChannelMutation.variables?.channelId === channelId
    );
  };

  const isChannelRemoving = (channelId: string) => {
    return (
      removeChannelMutation.isPending &&
      removeChannelMutation.variables === channelId
    );
  };

  const handleJoinChannel = (channelId: string) => {
    const channel = availableChannels.find((c: Channel) => c.id === channelId);
    if (!channel) return;

    const isUsedByOtherAgent =
      channel.agentIds.length > 0 && channel.agentIds[0] !== agent.id;
    if (isUsedByOtherAgent) {
      setConfirmChannelSwitch({
        channelId,
        channelName: channel.name ?? channel.discriminator,
      });
      return;
    }

    joinChannelMutation.mutate(
      {
        channelId,
        agentId: agent.id,
      },
      {
        onSuccess: () => {
          toast.success("Channel joined successfully");
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Failed to join channel",
          );
        },
      },
    );
  };

  const handleConfirmChannelSwitch = () => {
    if (!confirmChannelSwitch) return;

    joinChannelMutation.mutate(
      {
        channelId: confirmChannelSwitch.channelId,
        agentId: agent.id,
      },
      {
        onSuccess: () => {
          toast.success("Channel switched successfully");
          setConfirmChannelSwitch(null);
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Failed to switch channel",
          );
          setConfirmChannelSwitch(null);
        },
      },
    );
  };

  const handleLeaveChannel = (channelId: string) => {
    const channel = agentChannels.find((c: Channel) => c.id === channelId);
    if (!channel) return;

    leaveChannelMutation.mutate(
      {
        channelId: channel.id,
        agentId: agent.id,
      },
      {
        onSuccess: () => {
          toast.success("Channel left successfully");
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Failed to leave channel",
          );
        },
      },
    );
  };

  const handleCreateChannel = (bindingId: string) => {
    const selectedBinding = integrations?.find(
      (b: Integration) => b.id === bindingId,
    );
    if (!selectedBinding) {
      toast.error("Please select a integration first");
      return;
    }

    if (!discriminator.trim()) {
      toast.error("Please enter a discriminator");
      return;
    }

    createChannel(
      {
        discriminator: discriminator.trim(),
        integrationId: selectedBinding.id,
        agentId: agent.id,
        name: name?.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Channel created successfully");
          setDiscriminator("");
          setShowCreateForm(false);
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Failed to create channel",
          );
        },
      },
    );
  };

  const handleRemoveChannel = (channelId: string) => {
    removeChannelMutation.mutate(channelId, {
      onSuccess: () => {
        toast.success("Channel removed successfully");
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to remove channel",
        );
      },
    });
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-2">
        <div className="flex w-full justify-between gap-2 items-center">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-foreground leading-">
                Communication Channels
              </h3>
            </div>
            <p className="text-xs font-normal text-muted-foreground">
              These are the channels your agent can find users on and
              communicate with them
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowCreateForm(true)}
              className="gap-2 h-8 w-8"
              type="button"
            >
              <Icon name="add" size={16} />
            </Button>
          </div>
        </div>
      </div>

      {agentChannels.map((channel: Channel) => {
        if (!channel) return null;
        return (
          <ChannelCard key={channel.id} channel={channel} variant="agent">
            <button
              className="ml-auto cursor-pointer"
              type="button"
              onClick={() => handleLeaveChannel(channel.id)}
              disabled={isLeavingChannel(channel.id)}
            >
              {isLeavingChannel(channel.id) ? (
                <Spinner size="sm" />
              ) : (
                <Icon name="close" size={16} />
              )}
            </button>
          </ChannelCard>
        );
      })}

      {isLoadingChannels && agentChannels.length === 0 && (
        <div className="flex items-center gap-2 py-4">
          <Spinner size="sm" />
          <p className="text-sm text-muted-foreground">Loading channels...</p>
        </div>
      )}

      {availableChannels.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Available Channels
          </p>
          {availableChannels.map((channel: Channel) => {
            const isInAgentChannels = agentChannels.some(
              (c: Channel) => c.id === channel.id,
            );
            if (!channel) return null;
            return (
              <ChannelCard
                key={channel.id}
                channel={channel}
                variant="available"
              >
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleJoinChannel(channel.id)}
                    disabled={isJoiningChannel(channel.id)}
                    className="h-6 px-2 text-xs"
                  >
                    {isJoiningChannel(channel.id) ? (
                      <div className="flex items-center gap-1">
                        <Spinner size="xs" />
                        <span>Joining...</span>
                      </div>
                    ) : isInAgentChannels ? (
                      "Joined"
                    ) : (
                      "Join"
                    )}
                  </Button>
                  <button
                    className="cursor-pointer hover:text-destructive"
                    type="button"
                    onClick={() => handleRemoveChannel(channel.id)}
                    disabled={isChannelRemoving(channel.id)}
                  >
                    {isChannelRemoving(channel.id) ? (
                      <Spinner size="xs" />
                    ) : (
                      <Icon name="delete" size={16} />
                    )}
                  </button>
                </div>
              </ChannelCard>
            );
          })}
        </div>
      )}

      {!showCreateForm ? null : (
        <>
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>Integration</FormLabel>
            </div>
            <FormControl>
              <IntegrationSelect
                integration={integration}
                setIntegration={setIntegration}
              />
            </FormControl>
          </FormItem>

          <div className="space-y-2">
            {integration && (
              <ConnectionChannels
                key={integration.id}
                binding={integration}
                discriminator={discriminator}
                setDiscriminator={setDiscriminator}
                setName={setName}
              />
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateForm(false);
                setDiscriminator("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={!discriminator.trim() || isCreating}
              onClick={() => {
                if (!integration) {
                  toast.error("Please select an integration first");
                  return;
                }
                handleCreateChannel(integration.id);
              }}
              className="gap-2"
            >
              {isCreating ? (
                <>
                  <Spinner size="sm" />
                  Creating...
                </>
              ) : (
                <>
                  <Icon name="add" size={16} />
                  Create Channel
                </>
              )}
            </Button>
          </div>
        </>
      )}

      <AlertDialog open={!!confirmChannelSwitch}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch channel to this agent?</AlertDialogTitle>
            <AlertDialogDescription>
              The channel "{confirmChannelSwitch?.channelName}" is currently
              used by another agent. Do you want to switch it to this agent?
              This will remove it from the other agent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmChannelSwitch(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmChannelSwitch}>
              Switch Channel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IntegrationSelect({
  setIntegration,
  integration,
}: {
  setIntegration: (integration: Integration | null) => void;
  integration: Integration | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isChannelsBinding, setIsChannelsBinding] = useState<boolean | null>(
    null,
  );

  // Check if the selected integration is a Channels Binding
  const checkChannelsBinding = async (integration: Integration) => {
    try {
      const toolsData = await listTools(integration.connection);
      const isChannelBinding = Binding(
        WellKnownBindings.Channel,
      ).isImplementedBy(toolsData.tools);
      setIsChannelsBinding(isChannelBinding);
    } catch (error) {
      console.error("Error checking channels binding:", error);
      setIsChannelsBinding(false);
    }
  };

  const handleIntegrationSelect = async (integration: Integration) => {
    setIntegration(integration);
    setOpen(false);
    // Check channels binding immediately when integration is selected
    await checkChannelsBinding(integration);
    if (isChannelsBinding) {
      setIntegration(integration);
    }
  };

  return (
    <div className="w-full">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger>
          <Button>
            <Icon name="add" size={16} />
            Select integration
          </Button>
        </DialogTrigger>

        <DialogContent className="p-0 min-w-[80vw] min-h-[80vh] gap-0">
          <div className="flex h-[calc(100vh-10rem)]">
            <div className="h-full overflow-y-hidden p-4 pb-20 w-full">
              <Input
                placeholder="Search for an integration"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setQuery(e.target.value)
                }
                className="mb-4"
              />
              <InstalledConnections
                query={query}
                emptyState={<div>No integrations found</div>}
                onClick={handleIntegrationSelect}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {integration && (
        <div className="mt-4 p-3 border rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Selected Integration:</span>
            <span className="text-sm">
              {integration.name || integration.id}
            </span>
            {isChannelsBinding !== null && (
              <span
                className={`text-xs px-2 py-1 rounded ${
                  isChannelsBinding
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {isChannelsBinding
                  ? "Channels Binding ✓"
                  : "Not Channels Binding ✗"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectionChannels({
  binding,
  discriminator,
  setDiscriminator,
  setName,
}: {
  binding: Integration;
  discriminator: string;
  setDiscriminator: (discriminator: string) => void;
  setName: (name: string | undefined) => void;
}) {
  const { data: availableChannels, isLoading: isLoadingAvailableChannels } =
    useConnectionChannels(binding);

  const [search, setSearch] = useState("");
  const filteredChannels = useMemo(() => {
    const list = availableChannels?.channels ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((channel) =>
      (channel.label ?? "").toLowerCase().includes(q),
    );
  }, [availableChannels?.channels, search]);
  const [open, setOpen] = useState(false);
  if (isLoadingAvailableChannels) {
    return (
      <div className="w-full flex items-center gap-2">
        <Spinner size="sm" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Label htmlFor="discriminator">Channel</Label>
      <div className="mt-2 w-full">
        {availableChannels?.channels?.length &&
        availableChannels?.channels?.length > 0 ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between"
                type="button"
              >
                {discriminator
                  ? (availableChannels?.channels?.find(
                      (c) => c.value === discriminator,
                    )?.label ?? discriminator)
                  : "Select a channel"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
              <Command>
                <div className="p-2">
                  <CommandInput
                    placeholder="Type to search by value"
                    value={search}
                    onValueChange={(val) => {
                      setSearch(val);
                      setDiscriminator(val);
                      setName(val ? val : undefined);
                    }}
                  />
                </div>
                <CommandList>
                  <CommandEmpty>No results</CommandEmpty>
                  <CommandGroup>
                    {(() => {
                      const typed = search.trim();
                      const exists = (availableChannels?.channels ?? []).some(
                        (c) =>
                          (c.label ?? "").toLowerCase() === typed.toLowerCase(),
                      );
                      return typed && !exists ? (
                        <CommandItem
                          key="__custom__"
                          value={typed}
                          onSelect={(currentValue) => {
                            setDiscriminator(currentValue);
                            setName(currentValue);
                            setOpen(false);
                          }}
                        >
                          Use "{typed}"
                        </CommandItem>
                      ) : null;
                    })()}
                    {filteredChannels.map((channel) => (
                      <CommandItem
                        key={channel.value}
                        value={channel.label ?? channel.value}
                        onSelect={(currentValue) => {
                          const selected = availableChannels?.channels?.find(
                            (c) => (c.label ?? "") === currentValue,
                          );
                          const finalValue = selected?.value ?? currentValue;
                          const finalLabel = selected?.label ?? currentValue;
                          setDiscriminator(finalValue);
                          setName(finalLabel);
                          setOpen(false);
                        }}
                      >
                        {channel.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <Input
            id="discriminator"
            placeholder="Enter unique identifier (e.g., phone number ID for WhatsApp)"
            value={discriminator}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setDiscriminator(e.target.value)
            }
          />
        )}
      </div>
    </div>
  );
}

export default Channels;
