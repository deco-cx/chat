import Stripe from "stripe";
import { WebhookEventIgnoredError } from "../../../errors.ts";
import type { AppContext } from "../../context.ts";
import type { Transaction } from "../client.ts";
import { createCurrencyClient, MicroDollar } from "../index.ts";
import { getPlan } from "../plans.ts";
import { Markup, type PlanWithTeamMetadata } from "../../../plan.ts";

export const verifyAndParseStripeEvent = (
  payload: string,
  signature: string,
  c: AppContext,
): Promise<Stripe.Event> => {
  if (!c.envVars.STRIPE_SECRET_KEY || !c.envVars.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not set");
  }

  const stripe = new Stripe(c.envVars.STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil",
    httpClient: Stripe.createFetchHttpClient(),
  });

  return stripe.webhooks.constructEventAsync(
    payload,
    signature,
    c.envVars.STRIPE_WEBHOOK_SECRET,
  );
};

export class EventIgnoredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventIgnoredError";
  }
}

type EventHandler<T extends Stripe.Event> = (
  context: AppContext,
  event: T,
) => Promise<Transaction>;

const CURRENCIES_BESIDES_DOLLAR = ["BRL", "EUR"];

async function getCurrencies(c: AppContext) {
  if (!c.envVars.CURRENCY_API_KEY) {
    throw new Error("CURRENCY_API_KEY is not set");
  }

  const currencyClient = createCurrencyClient(c.envVars.CURRENCY_API_KEY);
  const response = await currencyClient["GET /latest"]({
    currencies: [CURRENCIES_BESIDES_DOLLAR.join(",")],
  });
  const data = await response.json();
  return data.data;
}

async function getAmountInDollars({
  context,
  amountReceivedUSDCentsWithMarkup,
  currency,
  plan,
}: {
  context: AppContext;
  amountReceivedUSDCentsWithMarkup: number;
  currency: string;
  plan: PlanWithTeamMetadata;
}) {
  const currencies = {
    ...(await getCurrencies(context)),
    USD: { value: 1 },
  };

  if (!Object.keys(currencies).includes(currency.toUpperCase())) {
    throw new Error("Currency not supported");
  }

  const conversionRate =
    currencies[currency.toUpperCase() as keyof typeof currencies].value;

  const amountReceivedUSDCents = Markup.remove({
    usdCents: amountReceivedUSDCentsWithMarkup,
    markupPercentage: plan.markup,
  });
  const amount = amountReceivedUSDCents / 100;
  const microDollarsString = String(
    Math.round((amount / conversionRate) * 1_000_000),
  );

  return MicroDollar.fromMicrodollarString(microDollarsString);
}

async function getWorkspaceByCustomerId({
  context,
  customerId: argsCustomerId,
}: {
  context: AppContext;
  customerId: string;
}): Promise<string> {
  const customerId = context.envVars.TESTING_CUSTOMER_ID || argsCustomerId;
  const { data, error } = await context.db
    .from("deco_chat_customer")
    .select("workspace")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (!data || error) {
    throw new Error("Failed to get workspace by customer ID", {
      cause: error,
    });
  }

  return data.workspace;
}

const paymentIntentSucceeded: EventHandler<
  Stripe.PaymentIntentSucceededEvent
> = async (context, event) => {
  const customerId = event.data.object.customer;

  if (!customerId || typeof customerId !== "string") {
    throw new Error("Customer ID not found or is not a string");
  }

  const workspace = await getWorkspaceByCustomerId({
    context,
    customerId,
  });

  const workspacePattern = new URLPattern({ pathname: "/:root/:slug" });
  const workspaceMatch = workspacePattern.exec({ pathname: workspace });

  if (
    !workspaceMatch ||
    !workspaceMatch.pathname.groups.slug ||
    !workspaceMatch.pathname.groups.root
  ) {
    throw new Error(`Invalid workspace format: ${workspace}`);
  }

  const contextWithWorkspace = {
    ...context,
    workspace: {
      value: workspace,
      slug: workspaceMatch.pathname.groups.slug,
      root: workspaceMatch.pathname.groups.root,
    },
  };

  const plan = await getPlan(contextWithWorkspace);
  const amount = await getAmountInDollars({
    context,
    amountReceivedUSDCentsWithMarkup: event.data.object.amount_received,
    currency: event.data.object.currency,
    plan,
  });

  return {
    type: "WorkspaceCashIn",
    amount: amount.toMicrodollarString(),
    workspace,
    timestamp: new Date(),
  };
};

export const createTransactionFromStripeEvent = async (
  c: AppContext,
  event: Stripe.Event,
): Promise<{ transaction: Transaction; idempotentId: string }> => {
  // deno-lint-ignore no-explicit-any
  const handlers: Record<string, EventHandler<any>> = {
    "payment_intent.succeeded": paymentIntentSucceeded,
  };

  const handler = handlers[event.type as keyof typeof handlers];

  if (!handler) {
    throw new WebhookEventIgnoredError(
      `No handler found for event type: ${event.type}`,
    );
  }

  const transaction = await handler(c, event);

  return {
    transaction,
    idempotentId: event.id,
  };
};
