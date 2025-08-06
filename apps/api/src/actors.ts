export { AIAgent, Trigger };
import { AIAgent as _AIAgent, Trigger as _Trigger } from "@deco/ai/actors";
// import { instrumentDO } from "@deco/sdk/observability";
import * as Sentry from "@sentry/cloudflare";

const AIAgent = Sentry.instrumentDurableObjectWithSentry(
    (env: any) => ({
        dsn: "https://15a2257ed06466face415d9d6faa4740@o4509797555503104.ingest.us.sentry.io/4509797557141504",
        tracesSampleRate: 1.0,
        integrations: [
            Sentry.consoleLoggingIntegration({ levels: ["error", "warn", "log"] }),
            Sentry.fetchIntegration(),
          ],
      }),
    _AIAgent as any);
const Trigger = (_Trigger);
