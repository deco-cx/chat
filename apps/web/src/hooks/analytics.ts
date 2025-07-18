import { posthog } from "posthog-js";
import {
  POSTHOG_ORIGIN,
  POSTHOG_PROJECT_API_KEY,
  POSTHOG_SHOULD_TRACK,
} from "../constants.ts";
import { onUserChange } from "./use-user.ts";

export const ANALYTICS = posthog.init(POSTHOG_PROJECT_API_KEY, {
  api_host: POSTHOG_ORIGIN,
  person_profiles: "always",
  capture_pageview: false,
});

let lastUserId: string | undefined;

onUserChange((user) => {
  if (!user || user.is_anonymous) return;

  if (lastUserId === user.id) return;

  lastUserId = user.id;
  ANALYTICS.identify(user.id, user);
});

const maybeDisableTracking =
  <T extends (...args: unknown[]) => void>(callback: T) =>
  (...args: Parameters<T>) =>
    POSTHOG_SHOULD_TRACK ? callback(...args) : undefined;

const serializeErrorProperties = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
    };
  }
  return error;
};

export const trackEvent = maybeDisableTracking(
  (...args: Parameters<typeof ANALYTICS.capture>) => {
    const [event, properties, options] = args;
    try {
      if (properties?.error) {
        properties.error = serializeErrorProperties(properties.error);
      }

      ANALYTICS.capture(event, properties, options);
    } catch (error) {
      trackException(error);
    }
  },
);

export const trackException = maybeDisableTracking(
  ANALYTICS.captureException.bind(ANALYTICS),
);
