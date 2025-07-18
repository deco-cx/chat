/**
 * Helper for making another windows refetch the integrations when needed.
 * Persisting tanstack query data to local storage was kinda buggy, while
 * this one is simple and worked well.
 */
export const INTEGRATION_CHANNEL = new BroadcastChannel("integration-updates");

export type IntegrationMessage = {
  type: "INTEGRATION_UPDATED";
};

export const notifyIntegrationUpdate = () => {
  INTEGRATION_CHANNEL.postMessage({
    type: "INTEGRATION_UPDATED",
  } as IntegrationMessage);
};
