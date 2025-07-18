import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWhatsAppInvite,
  getWhatsAppUser,
  upsertWhatsAppUser,
} from "../crud/whatsapp.ts";
import { MCPClient } from "../fetcher.ts";
import { countries } from "../utils/index.ts";
import { useAgent } from "./agent.ts";
import { KEYS } from "./index.ts";
import { useProfile } from "./profile.ts";
import { useSDK } from "./store.tsx";

export function useSendAgentWhatsAppInvite(agentId: string, triggerId: string) {
  const { data: profile } = useProfile();
  const { data: agent } = useAgent(agentId);
  const { workspace } = useSDK();
  return useMutation({
    mutationFn: (props: { to: string }) => {
      const countryCode = getMetaCountryCodeFromPhone(props.to);
      const template = TEMPLATES.find((t) => t.language_code === countryCode);
      if (!template) {
        throw new Error("Template not found");
      }

      return MCPClient.forWorkspace(workspace).WHATSAPP_SEND_TEMPLATE_MESSAGE({
        to: props.to,
        template_name: template.name,
        language_code: template.language_code,
        sender_phone: props.to,
        sender_name:
          profile?.metadata?.full_name ??
          profile?.metadata?.username ??
          "Unknown name",
        agent_name: agent.name,
      });
    },
    onSuccess: async (data) => {
      await createWhatsAppInvite(
        workspace,
        profile.id,
        triggerId,
        data.wppMessageId,
        data.to,
      );
    },
  });
}

export function useUpsertWhatsAppUser() {
  const { workspace } = useSDK();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: ({
      triggerUrl,
      triggerId,
      triggers,
    }: {
      triggerUrl: string;
      triggerId: string;
      triggers: string[];
    }) => {
      if (!profile?.phone) {
        throw new Error("Profile phone is required");
      }

      return upsertWhatsAppUser(
        workspace,
        profile.phone,
        triggerUrl,
        triggerId,
        triggers,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: KEYS.TRIGGERS(workspace),
      });
      queryClient.invalidateQueries({
        queryKey: KEYS.WHATSAPP_USER(workspace, profile.phone as string),
      });
    },
  });
}

export function useWhatsAppUser(phone: string) {
  const { workspace } = useSDK();
  return useQuery({
    queryKey: KEYS.WHATSAPP_USER(workspace, phone),
    queryFn: () => getWhatsAppUser(workspace, phone),
  });
}

function getMetaCountryCodeFromPhone(phone: string): string {
  // Remove any non-digit characters and ensure it starts with +
  const cleanPhone = phone.startsWith("+") ? phone : `+${phone}`;

  // Sort countries by dial_code length (longest first) to match more specific codes first
  const sortedCountries = [...countries].sort(
    (a, b) => b.dial_code.length - a.dial_code.length,
  );

  // Find the first country whose dial_code matches the start of the phone number
  const matchedCountry = sortedCountries.find((country) =>
    cleanPhone.startsWith(country.dial_code),
  );

  // Return the meta_code if it exists, otherwise default to en_US
  return matchedCountry?.meta_code || "en_US";
}

const TEMPLATES = [
  {
    name: "agent_invite",
    language_code: "en_US",
  },
  {
    name: "agent_invite_pt_br",
    language_code: "pt_BR",
  },
];
