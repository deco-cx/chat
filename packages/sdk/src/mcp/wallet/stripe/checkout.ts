import Stripe from "stripe";
import { assertHasWorkspace } from "../../assertions.ts";
import type { AppContext } from "../../context.ts";
import { createCurrencyClient } from "../index.ts";

const getStripeClient = (secretKey: string) => {
  return new Stripe(secretKey, {
    apiVersion: "2025-03-31.basil",
    httpClient: Stripe.createFetchHttpClient(),
  });
};

/**
 * Get or create a Stripe customer for the workspace.
 *
 * The relation between the workspace and the Stripe customer is stored in our
 * database, in the `deco_chat_customer` table.
 *
 * The endpoint handling the stripe webhook will use this relation
 * to update the workspace balance.
 */
const getOrCreateWorkspaceStripeCustomer = async (
  stripe: Stripe,
  ctx: AppContext,
): Promise<Stripe.Customer> => {
  assertHasWorkspace(ctx);

  const workspace = ctx.workspace.value;

  const { data: maybeCustomer } = await ctx.db
    .from("deco_chat_customer")
    .select("customer_id")
    .eq("workspace", workspace)
    .maybeSingle();

  if (maybeCustomer) {
    const customer = await stripe.customers.retrieve(maybeCustomer.customer_id);

    if (customer.deleted) {
      throw new Error("Stripe customer is deleted");
    }

    return customer;
  }

  const customer = await stripe.customers.create({
    metadata: {
      product: "deco.chat",
      workspace,
    },
  });

  await ctx.db.from("deco_chat_customer").insert({
    customer_id: customer.id,
    workspace,
  });

  return customer;
};

const convertUSDToBRL = async ({
  amountUSDCents: amountUSD,
  currencyAPIKey,
}: {
  amountUSDCents: number;
  currencyAPIKey: string;
}): Promise<number> => {
  const currencyClient = createCurrencyClient(currencyAPIKey);

  const response = await currencyClient["GET /latest"]({
    currencies: ["BRL"],
  });

  if (!response.ok) {
    console.error(
      "[Stripe Checkout Session] Error fetching currency",
      response,
    );
    throw new Error("Internal server error: Failed to fetch currency");
  }

  const currency = await response.json();

  const amountInBrl = Math.ceil(amountUSD * currency.data.BRL.value);

  return amountInBrl;
};

const MANDATORY_CUSTOM_FIELDS: Stripe.Checkout.SessionCreateParams.CustomField[] =
  [
    {
      label: {
        custom: "Tax ID/CNPJ/CPF",
        type: "custom",
      },
      key: "tax_id",
      type: "text",
      optional: false,
    },
  ];

interface WorkspaceWalletDeposit {
  id: "WorkspaceWalletDeposit";
  /**
   * Amount in cents
   */
  amountUSD: number;
}

type Product = WorkspaceWalletDeposit;

type ProductHandler<P extends Product> = (
  product: P,
  stripe: Stripe,
  ctx: AppContext,
) => Promise<Partial<Stripe.Checkout.SessionCreateParams>>;

const MINIMUM_AMOUNT_IN_USD_CENTS = 200;

const handleWorkspaceWalletDeposit: ProductHandler<
  WorkspaceWalletDeposit
> = async (product, stripe, ctx) => {
  if (!ctx.envVars.CURRENCY_API_KEY) {
    throw new Error("CURRENCY_API_KEY is not set");
  }

  if (
    Number.isNaN(product.amountUSD) ||
    product.amountUSD < MINIMUM_AMOUNT_IN_USD_CENTS
  ) {
    throw new Error("Invalid amount");
  }

  const customer = await getOrCreateWorkspaceStripeCustomer(stripe, ctx);

  /**
   * Since our Stripe account is based on Brazil and i want to make use of
   * stripe adaptive pricing, we need to create a checkout with the amount
   * in cents to BRL. Adaptive pricing will handle showing the local currency
   * to the customer.
   *
   * At the moment, we show an input field for the customer to enter the
   * amount in USD, so we use this API for converting the amount to BRL.
   */
  const amountInCents = product.amountUSD;
  const amountInBrl = await convertUSDToBRL({
    amountUSDCents: amountInCents,
    currencyAPIKey: ctx.envVars.CURRENCY_API_KEY,
  });
  const unitAmount = amountInBrl;

  return {
    mode: "payment",
    customer: customer.id,
    adaptive_pricing: {
      enabled: true,
    },
    line_items: [
      {
        price_data: {
          currency: "brl",
          product_data: {
            name: "Deco.chat Credits",
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
  };
};

const argsFor = ({
  product,
  stripe,
  ctx,
}: {
  product: Product;
  stripe: Stripe;
  ctx: AppContext;
}): Promise<Partial<Stripe.Checkout.SessionCreateParams>> => {
  const productHandlers: Record<Product["id"], ProductHandler<Product>> = {
    WorkspaceWalletDeposit: handleWorkspaceWalletDeposit,
  };

  const handler = productHandlers[product.id];

  if (!handler) {
    throw new Error(`No product found for ${product.id}`);
  }

  return handler(product, stripe, ctx);
};

interface CreateCheckoutSessionArgs {
  successUrl: string;
  cancelUrl: string;
  product: Product;
  metadata?: Record<string, string>;
  ctx: AppContext;
}

export const createCheckoutSession = async ({
  successUrl,
  cancelUrl,
  product,
  metadata,
  ctx,
}: CreateCheckoutSessionArgs) => {
  if (!ctx.envVars.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  const stripe = getStripeClient(ctx.envVars.STRIPE_SECRET_KEY);

  const args = await argsFor({
    stripe,
    product,
    ctx,
  });

  const session = await stripe.checkout.sessions.create({
    ...args,
    success_url: successUrl,
    cancel_url: cancelUrl,
    custom_fields: [...(args.custom_fields ?? []), ...MANDATORY_CUSTOM_FIELDS],
    metadata: {
      ...args.metadata,
      ...metadata,
    },
  });

  return session;
};
