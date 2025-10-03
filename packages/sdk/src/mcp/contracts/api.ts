import { MD5 } from "object-hash";
import z from "zod/v3";
import { WebCache } from "../../cache/index.ts";
import { SWRCache } from "../../cache/swr.ts";
import { AppName } from "../../common/index.ts";
import {
  AppContext,
  createTool,
  createToolFactory,
  DECO_CMS_API,
  State,
} from "../context.ts";
import {
  assertWorkspaceResourceAccess,
  ForbiddenError,
  fromWorkspaceString,
  UserInputError,
  WithTool,
} from "../index.ts";
import { getRegistryApp, publishApp } from "../registry/api.ts";
import {
  commitPreAuthorizedAmount,
  preAuthorizeAmount,
} from "../wallet/api.ts";
import { MicroDollar } from "../wallet/microdollar.ts";

type ContractContext = WithTool<AppContext> & {
  state: ContractState;
};

export const ContractSignature = {
  generate: (app: string, state: ContractState) => `${app}-${MD5(state)}`,
};

export const contractSWRCache = new SWRCache<ContractState>("contract-swr", {
  staleTtlSeconds: WebCache.MAX_SAFE_TTL,
});

const createContractTool = createToolFactory<ContractContext>(
  async (c) => {
    if (!("aud" in c.user) || typeof c.user.aud !== "string") {
      throw new ForbiddenError("User not found");
    }
    if (!("appName" in c.user) || typeof c.user.appName !== "string") {
      throw new ForbiddenError("App name not found in user");
    }
    const appName = c.user.appName;
    const state = await contractSWRCache.cache(async () => {
      const app = await getRegistryApp.handler({ name: appName });
      if (!app) {
        throw new ForbiddenError("App not found");
      }
      return app.metadata?.contract as ContractState;
    }, appName);
    if (!state) {
      throw new ForbiddenError("Contract not found in app metadata");
    }
    return {
      ...(c as unknown as ContractContext),
      state,
      workspace: fromWorkspaceString(
        c.user.aud!,
        c.locator?.branch ?? c.workspace?.branch ?? "main",
        c.user?.id as string | undefined,
      ),
    };
  },
  undefined, // Do not set WellKnownMcpGroups.Contracts since it will set the wrong uri for this mcp,
  {
    name: "Contracts",
    description: "Manage smart contracts",
    icon: "https://assets.decocache.com/mcp/10b5e8b4-a4e2-4868-8a7d-8cf9b46f0d79/contract.png",
  },
);

// Contract clause schema
const ClauseSchema = z.object({
  id: z.string(),
  price: z.union([z.string(), z.number()]), // Price in cents/smallest currency unit
  description: z.string().optional(),
  usedByTools: z.array(z.string()).optional(), // Array of tool names that use this clause
});

// Contract state schema extending the default StateSchema
const ContractStateSchema = z.object({
  body: z.string().optional(),
  // Contract terms set during installation
  clauses: z.array(ClauseSchema).default([]),
});
const ContractClauseExerciseSchema = z.object({
  clauseId: z.string(),
  amount: z.number().min(1), // Number of units to charge (multiplied by clause price)
});
type ContractClauseExercise = z.infer<typeof ContractClauseExerciseSchema>;

export type ContractState = z.infer<typeof ContractStateSchema>;

const totalAmount = (
  clauses: ContractState["clauses"],
  exercises: ContractClauseExercise[],
) => {
  const prices: Record<string, MicroDollar> = {};

  for (const clause of clauses) {
    prices[clause.id] = MicroDollar.from(clause.price);
  }

  let total = MicroDollar.ZERO;
  for (const exercise of exercises) {
    if (exercise.clauseId in prices) {
      total = total.add(prices[exercise.clauseId].multiply(exercise.amount));
    } else {
      throw new UserInputError(`Clause ${exercise.clauseId} not found`);
    }
  }

  return total;
};

export const oauthStart = createTool({
  name: "DECO_CHAT_OAUTH_START",
  description: "Start the OAuth flow for the contract app.",
  inputSchema: z.lazy(() =>
    z.object({
      returnUrl: z.string(),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      stateSchema: z.any(),
      scopes: z.array(z.string()).optional(),
    }),
  ),
  handler: (_, c) => {
    c.resourceAccess.grant();
    return {
      stateSchema: { type: "object", properties: {} },
      scopes: ["PRE_AUTHORIZE_AMOUNT", "COMMIT_PRE_AUTHORIZED_AMOUNT"],
    };
  },
});

export const contractRegister = createTool({
  name: "CONTRACT_REGISTER",
  description: "Register a contract with the registry.",
  inputSchema: z.lazy(() =>
    z.object({
      contract: ContractStateSchema,
      author: z.object({
        scope: z.string(),
        name: z.string(),
      }),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      appName: z.string(),
    }),
  ),
  handler: async (context, c) => {
    await assertWorkspaceResourceAccess(c);

    const appName = AppName.build(context.author.scope, context.author.name);
    const assignor = ContractSignature.generate(
      appName,
      context.contract as ContractState,
    );
    const url = new URL(`/contracts/mcp`, DECO_CMS_API(c, false));

    const { name, scopeName } = AppName.parse(assignor);
    const app = await publishApp.handler({
      name,
      scopeName,
      icon: "https://assets.decocache.com/mcp/10b5e8b4-a4e2-4868-8a7d-8cf9b46f0d79/contract.png",
      description: context.contract.body,
      friendlyName: context.contract.body,
      unlisted: true,
      connection: {
        type: "HTTP",
        url: url.href,
      },
      metadata: {
        contract: context.contract,
      },
    });

    return {
      appName: app.appName,
    };
  },
});

export const contractAuthorize = createContractTool({
  name: "CONTRACT_AUTHORIZE",
  description:
    "Authorize a charge for a contract clause. Creates a single authorization with transactionId.",
  inputSchema: z.lazy(() =>
    z.object({
      clauses: z.array(
        z.object({
          clauseId: z.string(),
          amount: z.number().min(1), // Number of units to charge (multiplied by clause price)
        }),
      ),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      transactionId: z.string(),
      totalAmount: z.string(),
      timestamp: z.number(),
    }),
  ),
  handler: async (context, c) => {
    if (
      !("integrationId" in c.user) ||
      typeof c.user.integrationId !== "string"
    ) {
      throw new ForbiddenError(
        "Could not authorize charge for unknown integration",
      );
    }

    await assertWorkspaceResourceAccess(c);

    const state = c.state;
    const contractId = c.user.integrationId;

    const clauseAmount = totalAmount(
      state.clauses,
      context.clauses,
    ).toMicrodollarString();

    const { id: transactionId } = await State.run(c, () =>
      preAuthorizeAmount.handler({
        amount: clauseAmount,
        metadata: {
          contractId,
          clauses: context.clauses,
        },
      }),
    );

    return {
      transactionId,
      totalAmount: clauseAmount,
      timestamp: Date.now(),
    };
  },
});

export const contractGet = createContractTool({
  name: "CONTRACT_GET",
  description: "Get the current contract state.",
  inputSchema: z.lazy(() => z.object({})),
  outputSchema: z.lazy(() =>
    z.object({
      appName: z.string().optional(),
      contract: ContractStateSchema,
    }),
  ),
  handler: (_, c) => {
    c.resourceAccess.grant();
    return {
      appName:
        "appName" in c.user && typeof c.user.appName === "string"
          ? c.user.appName
          : undefined,
      contract: c.state,
    };
  },
});

export const contractSettle = createContractTool({
  name: "CONTRACT_SETTLE",
  description:
    "Settle the current authorized charge. Processes the payment for the current authorization.",
  inputSchema: z.lazy(() =>
    z.object({
      transactionId: z.string(),
      clauses: z.array(ContractClauseExerciseSchema).optional(),
      amount: z.number().optional(),
      vendorId: z.string(),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      transactionId: z.string(),
    }),
  ),
  handler: async (context, c) => {
    if (
      !("integrationId" in c.user) ||
      typeof c.user.integrationId !== "string"
    ) {
      throw new ForbiddenError(
        "Could not settle charge for unknown integration",
      );
    }

    await assertWorkspaceResourceAccess(c);

    const state = c.state;
    const contractId = c.user.integrationId;
    const callerApp = c.callerApp;

    let amount = MicroDollar.ZERO;
    if ("amount" in context && context.amount !== undefined) {
      amount = MicroDollar.from(context.amount);
    } else if ("clauses" in context && context.clauses !== undefined) {
      amount = totalAmount(state.clauses, context.clauses);
    }

    await State.run(c, () =>
      commitPreAuthorizedAmount.handler({
        contractId,
        identifier: context.transactionId,
        amount: amount.toMicrodollarString(),
        vendorId: context.vendorId,
        metadata: callerApp
          ? {
              callerApp,
            }
          : undefined,
      }),
    );

    return {
      transactionId: context.transactionId,
    };
  },
});
