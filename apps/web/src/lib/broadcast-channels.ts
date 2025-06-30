/**
 * Helper for making another windows refetch the integrations when needed.
 * Persisting tanstack query data to local storage was kinda buggy, while
 * this one is simple and worked well.
 */
export const OAUTH_CHANNEL = new BroadcastChannel("oauth-updates");

type OAuthFinishedMessage = {
  type: "OAUTH_FINISHED";
  installId: string;
  name: string;
  account: string;
};

type OAuthErrorMessage = {
  type: "OAUTH_ERROR";
  installId: string;
  error: string;
};

export type OAuthMessage =
  | OAuthFinishedMessage
  | OAuthErrorMessage;

export const notifyOAuthFinished = (
  props: Omit<OAuthFinishedMessage, "type">,
) => {
  OAUTH_CHANNEL.postMessage(
    { type: "OAUTH_FINISHED" as const, ...props },
  );
};

export const subscribeToOAuth = (
  onMessage: (message: OAuthMessage) => void,
) => {
  const handleMessage = (event: MessageEvent<OAuthMessage>) =>
    onMessage(event.data);
  OAUTH_CHANNEL.addEventListener("message", handleMessage);
  return () => OAUTH_CHANNEL.removeEventListener("message", handleMessage);
};

export const subscribeToOAuthInstall = (
  installId: string,
  onMessage: (message: OAuthFinishedMessage | OAuthErrorMessage) => void,
) => {
  const TRACKED_MESSAGES = ["OAUTH_FINISHED", "OAUTH_ERROR"] as const;
  const unsubscribe = subscribeToOAuth((message) => {
    if (
      TRACKED_MESSAGES.includes(message.type) && message.installId === installId
    ) {
      onMessage(message);
    }
  });
  return unsubscribe;
};
