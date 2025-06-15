import {
  useBindings,
  useChannels,
  useConnectionChannels,
  useCreateChannel,
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
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { FormControl, FormItem, FormLabel } from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";

interface ChannelsProps {
  className?: string;
}

interface ChannelCardProps {
  channel: Channel;
  children: React.ReactNode;
  variant?: "agent" | "available";
}

function ChannelCard(
  { channel, children, variant = "agent" }: ChannelCardProps,
) {
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
          name={integration?.name ?? "Unknown"}
          icon={integration?.icon ?? ""}
          className={cn(
            "before:hidden w-10 h-10",
          )}
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
  const {
    data: bindings,
    isLoading: isLoadingBindings,
    totalIntegrations,
    processedIntegrations,
  } = useBindings(
    "Channel",
  );
  const [discriminator, setDiscriminator] = useState("");
  const [name, setName] = useState<string | undefined>(undefined);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [confirmChannelSwitch, setConfirmChannelSwitch] = useState<
    {
      channelId: string;
      channelName: string;
    } | null
  >(null);
  const { agent } = useAgentSettingsForm();
  const { mutate: createChannel, isPending: isCreating } = useCreateChannel();
  const joinChannelMutation = useJoinChannel();
  const leaveChannelMutation = useLeaveChannel();
  const removeChannelMutation = useRemoveChannel();
  const { data: channels, isLoading: isLoadingChannels } = useChannels();
  const workspaceLink = useWorkspaceLink();

  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(
    null,
  );
  const allChannels = channels?.channels || [];
  const agentChannels = useMemo(
    () => allChannels.filter((channel) => channel.agentIds.includes(agent.id)),
    [allChannels, agent.id],
  );
  const availableChannels = useMemo(
    () => allChannels.filter((channel) => !channel.agentIds.includes(agent.id)),
    [allChannels, agent.id],
  );
  const selectedBinding = useMemo(
    () => bindings?.find((b) => b.id === selectedBindingId),
    [bindings, selectedBindingId],
  );

  // Helper functions to check if specific channel is being processed
  const isLeavingChannel = (channelId: string) => {
    return leaveChannelMutation.isPending &&
      leaveChannelMutation.variables?.channelId === channelId;
  };

  const isJoiningChannel = (channelId: string) => {
    return joinChannelMutation.isPending &&
      joinChannelMutation.variables?.channelId === channelId;
  };

  const isChannelRemoving = (channelId: string) => {
    return removeChannelMutation.isPending &&
      removeChannelMutation.variables === channelId;
  };

  const handleJoinChannel = (channelId: string) => {
    const channel = availableChannels.find((c) => c.id === channelId);
    if (!channel) return;

    const isUsedByOtherAgent = channel.agentIds.length > 0 &&
      channel.agentIds[0] !== agent.id;
    if (isUsedByOtherAgent) {
      setConfirmChannelSwitch({
        channelId,
        channelName: channel.name ?? channel.discriminator,
      });
      return;
    }

    joinChannelMutation.mutate({
      channelId,
      agentId: agent.id,
    }, {
      onSuccess: () => {
        toast.success("Channel joined successfully");
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to join channel",
        );
      },
    });
  };

  const handleConfirmChannelSwitch = () => {
    if (!confirmChannelSwitch) return;

    joinChannelMutation.mutate({
      channelId: confirmChannelSwitch.channelId,
      agentId: agent.id,
    }, {
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
    });
  };

  const handleLeaveChannel = (channelId: string) => {
    const channel = agentChannels.find((c) => c.id === channelId);
    if (!channel) return;

    leaveChannelMutation.mutate({
      channelId: channel.id,
      agentId: agent.id,
    }, {
      onSuccess: () => {
        toast.success("Channel left successfully");
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to leave channel",
        );
      },
    });
  };

  const handleCreateChannel = (bindingId: string) => {
    const selectedBinding = bindings?.find((b) => b.id === bindingId);
    if (!selectedBinding) {
      toast.error("Please select a integration first");
      return;
    }

    if (!discriminator.trim()) {
      toast.error("Please enter a discriminator");
      return;
    }

    createChannel({
      discriminator: discriminator.trim(),
      integrationId: selectedBinding.id,
      agentId: agent.id,
      name: name?.trim(),
    }, {
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
    });
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

      {agentChannels.map((channel) => {
        if (!channel) return null;
        return (
          <ChannelCard key={channel.id} channel={channel} variant="agent">
            <button
              className="ml-auto cursor-pointer"
              type="button"
              onClick={() => handleLeaveChannel(channel.id)}
              disabled={isLeavingChannel(channel.id)}
            >
              {isLeavingChannel(channel.id)
                ? <Spinner size="sm" />
                : <Icon name="close" size={16} />}
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
          {availableChannels.map((channel) => {
            const isInAgentChannels = agentChannels.some((c) =>
              c.id === channel.id
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
                    {isJoiningChannel(channel.id)
                      ? (
                        <div className="flex items-center gap-1">
                          <Spinner size="xs" />
                          <span>Joining...</span>
                        </div>
                      )
                      : (
                        isInAgentChannels ? "Joined" : "Join"
                      )}
                  </Button>
                  <button
                    className="cursor-pointer hover:text-destructive"
                    type="button"
                    onClick={() => handleRemoveChannel(channel.id)}
                    disabled={isChannelRemoving(channel.id)}
                  >
                    {isChannelRemoving(channel.id)
                      ? <Spinner size="xs" />
                      : <Icon name="delete" size={16} />}
                  </button>
                </div>
              </ChannelCard>
            );
          })}
        </div>
      )}

      {!showCreateForm ? null : (
        <>
          {!isLoadingBindings && (!bindings || bindings.length === 0) && (
            <Alert>
              <AlertDescription>
                No channel integrations available. You need to install
                integrations first.
                <Link
                  to={workspaceLink("/connections")}
                  className="ml-2 text-primary hover:underline"
                >
                  Go to Integrations →
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {/* Show waiting message when loading but no integrations available yet */}
          {isLoadingBindings && (!bindings || bindings.length === 0) &&
            totalIntegrations > 0 && (
            <Alert>
              <AlertDescription>
                Waiting for channel integrations to load...
                ({processedIntegrations}/{totalIntegrations} processed)
              </AlertDescription>
            </Alert>
          )}

          {/* Show form as soon as we have at least one integration available */}
          {bindings && bindings.length > 0 && (
            <>
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Integration</FormLabel>
                  {isLoadingBindings &&
                    processedIntegrations < totalIntegrations && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Spinner size="xs" />
                      Loading more...
                    </span>
                  )}
                </div>
                <FormControl>
                  <Select
                    value={selectedBindingId ?? ""}
                    onValueChange={(bindingId) => {
                      setSelectedBindingId(bindingId);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={bindings.length === 0
                          ? "No integrations available"
                          : isLoadingBindings
                          ? `Select an integration (${bindings.length} available, ${
                            totalIntegrations - processedIntegrations
                          } loading...)`
                          : "Select an integration"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {bindings?.map((binding) => (
                        <SelectItem key={binding.id} value={binding.id}>
                          <div className="flex items-center gap-2">
                            {binding.icon
                              ? (
                                <IntegrationIcon
                                  className="before:hidden w-10 h-10"
                                  name={binding.name}
                                  icon={binding.icon}
                                />
                              )
                              : <Icon name="chat" size={16} />}
                            <span>{binding.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>

              <div className="space-y-2">
                {selectedBinding &&
                  (
                    <ConnectionChannels
                      key={selectedBindingId}
                      binding={selectedBinding}
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
                    if (!selectedBindingId) {
                      toast.error("Please select an integration first");
                      return;
                    }
                    handleCreateChannel(selectedBindingId);
                  }}
                  className="gap-2"
                >
                  {isCreating
                    ? (
                      <>
                        <Spinner size="sm" />
                        Creating...
                      </>
                    )
                    : (
                      <>
                        <Icon name="add" size={16} />
                        Create Channel
                      </>
                    )}
                </Button>
              </div>
            </>
          )}
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

function ConnectionChannels(
  { binding, discriminator, setDiscriminator, setName }: {
    binding: Integration;
    discriminator: string;
    setDiscriminator: (discriminator: string) => void;
    setName: (name: string | undefined) => void;
  },
) {
  const { data: availableChannels, isLoading: isLoadingAvailableChannels, error, refetch } =
    useConnectionChannels(binding);
  
  if (isLoadingAvailableChannels) {
    return (
      <div className="w-full flex items-center gap-2">
        <Spinner size="sm" />
        <p className="text-sm text-muted-foreground">Loading channels...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Label htmlFor="discriminator">
        Channel
      </Label>
      <div className="mt-2 w-full space-y-2">
        {error && (
          <div className="flex items-center gap-2 p-2 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded">
            <span>⚠️ Failed to load channels.</span>
            <button
              onClick={() => refetch()}
              className="text-orange-700 underline hover:text-orange-800"
            >
              Try again
            </button>
          </div>
        )}
        
        {availableChannels?.channels?.length && (
          <Select
            onValueChange={(value) => {
              const nameForChannel = availableChannels?.channels?.find((
                channel,
              ) => channel.value === value)?.label;
              setDiscriminator(value);
              setName(nameForChannel);
            }}
            disabled={isLoadingAvailableChannels}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a channel" />
            </SelectTrigger>
            <SelectContent className="w-full">
              {availableChannels?.channels?.map((channel) => {
                return (
                  <SelectItem key={channel.value} value={channel.value}>
                    {channel.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
        
        {(!availableChannels?.channels?.length && !isLoadingAvailableChannels) && (
          <>
            {!error && (
              <p className="text-xs text-muted-foreground mb-2">
                No channels available from {binding.name}. Enter manually:
              </p>
            )}
            <Input
              id="discriminator"
              placeholder="Enter unique identifier (e.g., phone number for WhatsApp)"
              value={discriminator}
              onChange={(e) => setDiscriminator(e.target.value)}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default Channels;
