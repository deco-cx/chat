import {
  type Agent,
  useAgent,
  useCreateTrigger,
  useListTriggers,
  useSDK,
  useSendAgentWhatsAppInvite,
  useUpsertWhatsAppUser,
  useWhatsAppUser,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import { useProfile } from "@deco/sdk/hooks";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState } from "react";
import { useFocusChat } from "../agents/hooks.ts";
import { useChatContext } from "../chat/context.tsx";
import { useProfileModalContext } from "../profile-modal.tsx";
import { WhatsAppInviteDialog } from "./whatsapp-invite-dialog.tsx";

const PHONE_NUMBER = "11920902075";

const getWhatsAppLink = (agent: Agent) => {
  const url = new URL(`https://wa.me/${PHONE_NUMBER}`);

  url.searchParams.set("text", `Hey, is that ${agent.name}?`);

  return url.href;
};

const WHATSAPP_TRIGGER = {
  title: "WhatsApp Integration",
  description: "WhatsApp integration for this agent",
  type: "webhook",
} as const;

export function WhatsAppButton({ isMobile = false }: { isMobile?: boolean }) {
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const { agentId } = useChatContext();
  const { data: agent } = useAgent(agentId);
  const { data: triggers, refetch: refetchTriggers } = useListTriggers();
  const { mutate: createTrigger } = useCreateTrigger();
  const { data: profile } = useProfile();
  const { data: whatsappUser } = useWhatsAppUser(profile?.phone ?? "");
  const focusChat = useFocusChat();
  const { openProfileModal } = useProfileModalContext();

  const isWellKnownAgent = Boolean(
    WELL_KNOWN_AGENTS[agentId as keyof typeof WELL_KNOWN_AGENTS],
  );

  const { workspace } = useSDK();

  const isDecoTeam = (workspace as string) === "shared/deco.cx";

  const webhookTriggers =
    triggers?.triggers?.filter(
      (trigger) =>
        trigger.type === "webhook" &&
        "agentId" in trigger.data &&
        trigger.data.agentId === agentId &&
        trigger.data.title === WHATSAPP_TRIGGER.title,
    ) ?? [];
  const currentWhatsAppRouterTrigger = webhookTriggers.find(
    (trigger) => whatsappUser?.trigger_id === trigger.id,
  );

  const { mutate: upsertWhatsAppUser } = useUpsertWhatsAppUser();

  const anyTrigger = webhookTriggers[0];
  const anyTriggerId = anyTrigger?.id;

  const { mutate: sendAgentWhatsAppInvite, isPending: isInvitePending } =
    useSendAgentWhatsAppInvite(
      agentId,
      currentWhatsAppRouterTrigger?.id ?? anyTriggerId ?? "",
    );

  function runWhatsAppIntegration() {
    if (!anyTriggerId) {
      createTrigger(
        {
          ...WHATSAPP_TRIGGER,
          passphrase: crypto.randomUUID(),
          agentId: agentId,
        },
        {
          onSuccess: async () => {
            // Refetch triggers to get the newly created trigger
            const { data: updatedTriggers } = await refetchTriggers();
            const updatedWebhookTriggers =
              updatedTriggers?.triggers?.filter(
                (trigger) =>
                  trigger.type === "webhook" &&
                  "agentId" in trigger.data &&
                  trigger.data.agentId === agentId,
              ) ?? [];
            const newTrigger = updatedWebhookTriggers[0];

            if (newTrigger) {
              upsertWhatsAppUser(
                {
                  triggerUrl:
                    "url" in newTrigger.data ? (newTrigger.data.url ?? "") : "",
                  triggerId: newTrigger.id,
                  triggers: [...(whatsappUser?.triggers ?? [])],
                },
                {
                  onSuccess: () => {
                    toast.success("This agent is now available on WhatsApp.");
                  },
                  onError: (error) => {
                    toast.error(
                      `Failed to create temporary agent: ${error.message}`,
                    );
                  },
                },
              );
            }
          },
          onError: (error) => {
            toast.error(`Failed to create trigger: ${error.message}`);
          },
        },
      );
    } else {
      const data = currentWhatsAppRouterTrigger?.data ?? anyTrigger?.data;
      upsertWhatsAppUser(
        {
          triggerUrl: "url" in data ? (data.url ?? "") : "",
          triggerId: currentWhatsAppRouterTrigger?.id ?? anyTrigger?.id,
          triggers: [...(whatsappUser?.triggers ?? [])],
        },
        {
          onSuccess: () => {
            toast.success("This agent is now available on WhatsApp.");
            focusChat(agentId, crypto.randomUUID(), {
              history: false,
            });
          },
          onError: (error) => {
            toast.error(`Failed to create temporary agent: ${error.message}`);
          },
        },
      );
    }
  }

  function handleWhatsAppClick() {
    if (!profile?.phone) {
      toast(
        "To enable your agent for WhatsApp use, first register your WhatsApp phone number.",
      );
      openProfileModal(runWhatsAppIntegration);
      return;
    }
    runWhatsAppIntegration();
  }

  function handleInviteClick() {
    setIsInviteDialogOpen(true);
  }

  function handleInviteSubmit(phoneNumber: string) {
    if (!isDecoTeam) {
      toast.error("This feature is only available for the deco.cx team.");
      return;
    }

    if (!anyTriggerId) {
      createTrigger(
        {
          ...WHATSAPP_TRIGGER,
          passphrase: crypto.randomUUID(),
          agentId: agentId,
        },
        {
          onSuccess: async () => {
            // Refetch triggers to get the newly created trigger
            const { data: updatedTriggers } = await refetchTriggers();
            const updatedWebhookTriggers =
              updatedTriggers?.triggers?.filter(
                (trigger) =>
                  trigger.type === "webhook" &&
                  "agentId" in trigger.data &&
                  trigger.data.agentId === agentId,
              ) ?? [];
            const newTrigger = updatedWebhookTriggers[0];

            if (newTrigger) {
              sendAgentWhatsAppInvite(
                { to: phoneNumber },
                {
                  onSuccess: () => {
                    toast.success("WhatsApp invite sent successfully!");
                    setIsInviteDialogOpen(false);
                  },
                  onError: (error) => {
                    toast.error(`Failed to send invite: ${error.message}`);
                  },
                },
              );
            }
          },
          onError: (error) => {
            toast.error(`Failed to create trigger: ${error.message}`);
          },
        },
      );
    } else {
      // If trigger already exists, proceed with sending invite
      sendAgentWhatsAppInvite(
        { to: phoneNumber },
        {
          onSuccess: () => {
            toast.success("WhatsApp invite sent successfully!");
            setIsInviteDialogOpen(false);
          },
          onError: (error) => {
            toast.error(`Failed to send invite: ${error.message}`);
          },
        },
      );
    }
  }

  function handleTalkInWhatsApp() {
    if (agent) {
      globalThis.open(getWhatsAppLink(agent), "_blank");
    }
  }

  const isWhatsAppEnabled =
    whatsappUser &&
    whatsappUser?.trigger_id === currentWhatsAppRouterTrigger?.id;

  if (isWellKnownAgent) {
    return;
  }

  const buttonContent = (
    <Button
      variant="ghost"
      size="icon"
      onClick={
        isWhatsAppEnabled
          ? () => globalThis.open(getWhatsAppLink(agent), "_blank")
          : handleWhatsAppClick
      }
      className={isMobile ? "w-full justify-center gap-4" : ""}
    >
      <img
        src="/img/zap.svg"
        className={isMobile ? "w-[14px] h-[14px] ml-[-6px]" : "w-4 h-4"} // xd
      />
      <span className={cn(isMobile ? "text-sm" : "text-base", "font-normal")}>
        {!isMobile ? "" : isWhatsAppEnabled ? "Start chat" : "Enable WhatsApp"}
      </span>
    </Button>
  );

  // For mobile, return the button without tooltip
  if (isMobile) {
    return buttonContent;
  }

  // For desktop, wrap with tooltip
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <img
                  src="/img/zap.svg"
                  alt="WhatsApp Logo"
                  className="w-4 h-4"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isWhatsAppEnabled ? (
                <DropdownMenuItem onClick={handleTalkInWhatsApp}>
                  Talk in WhatsApp
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleWhatsAppClick}>
                  Use in WhatsApp
                </DropdownMenuItem>
              )}
              {isDecoTeam && (
                <DropdownMenuItem onClick={handleInviteClick}>
                  Invite
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent>WhatsApp Options</TooltipContent>
      </Tooltip>

      <WhatsAppInviteDialog
        isOpen={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        onSubmit={handleInviteSubmit}
        isLoading={isInvitePending}
      />
    </>
  );
}
