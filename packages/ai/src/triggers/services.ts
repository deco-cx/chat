import {
  CreateTriggerInput,
  IntegrationSchema,
  ListTriggersOutputSchema,
} from "@deco/sdk";
import { Hosts } from "@deco/sdk/hosts";
import { z } from "zod";
import { Trigger } from "./trigger.ts";

export type TriggerData = CreateTriggerInput & {
  id: string;
  resourceId?: string;
  createdAt?: string;
  updatedAt?: string;
  author?: {
    id: string;
    name: string;
    email: string;
    avatar: string;
  };
  binding?: z.infer<typeof IntegrationSchema> | null;
};

export interface TriggerListResult {
  ok: boolean;
  message: string;
  triggers: z.infer<typeof ListTriggersOutputSchema>["triggers"];
}

export interface TriggerRun {
  id: string;
  triggerId: string;
  timestamp: string;
  result: Record<string, unknown> | null;
  status: string;
  metadata: Record<string, unknown> | null;
}

export interface TriggerRunListResult {
  ok: boolean;
  message: string;
  runs: TriggerRun[] | undefined;
}

/**
 * Generates a webhook URL for a trigger
 * @param triggerId - The full trigger ID path
 * @param passphrase - The webhook passphrase
 * @returns The webhook URL
 */
export const buildWebhookUrl = (
  triggerId: string,
  passphrase?: string,
  outputTool?: string,
) => {
  const url = new URL(
    `https://${Hosts.API}/actors/${Trigger.name}/invoke/run`,
  );
  url.searchParams.set("deno_isolate_instance_id", triggerId);

  if (passphrase) {
    url.searchParams.set("passphrase", passphrase);
  }
  if (outputTool) {
    url.searchParams.set("outputTool", outputTool);
  }
  return url.toString();
};
