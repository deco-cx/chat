import { MD5 } from "object-hash";
import z from "zod";
import { WellKnownMcpGroups } from "../../crud/groups.ts";
import {
  AppContext,
  createToolFactory,
  createTool,
  DECO_CHAT_API,
  State,
} from "../context.ts";
import {
  ForbiddenError,
  fromWorkspaceString,
  UserInputError,
  WithTool,
} from "../index.ts";
import { publishApp } from "../registry/api.ts";
import {
  commitPreAuthorizedAmount,
  preAuthorizeAmount,
} from "../wallet/api.ts";
import { MicroDollar } from "../wallet/microdollar.ts";

type ContractContext = WithTool<AppContext> & {
  state: ContractState;
};

const parseContract = (contract?: string | null): ContractState => {
  if (!contract) {
    return {
      clauses: [],
    };
  }
  const decoded = atob(contract);
  return JSON.parse(decoded) as ContractState;
};
const createContractTool = createToolFactory<ContractContext>(
  (c) => {
    if (!("aud" in c.user) || typeof c.user.aud !== "string") {
      throw new ForbiddenError("User not found");
    }
    if (!("appName" in c.user) || typeof c.user.appName !== "string") {
      throw new ForbiddenError("App name not found in user");
    }
    const appName = c.user.appName;
    const state = parseContract(c.params["contract"]);
    const assignor = c.params["assignor"];
    if (!assignor || assignor !== appName) {
      throw new ForbiddenError("Assignor not found in contract");
    }
    return {
      ...(c as unknown as ContractContext),
      state,
      workspace: fromWorkspaceString(c.user.aud!),
    };
  },
  WellKnownMcpGroups.Contracts,
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

type ContractState = z.infer<typeof ContractStateSchema>;

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
  inputSchema: z.object({
    returnUrl: z.string(),
  }),
  outputSchema: z.object({
    stateSchema: z.any(),
    scopes: z.array(z.string()).optional(),
  }),
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
  inputSchema: z.object({
    contract: ContractStateSchema,
    author: z.object({
      scope: z.string(),
      name: z.string(),
    }),
  }),
  outputSchema: z.object({
    appName: z.string(),
  }),
  handler: async (context, c) => {
    const hash = MD5(context.contract);
    const assignorName = `${context.author.name}-${hash}`;
    const assignor = `@${context.author.scope}/${assignorName}`;
    const url = new URL(`/contracts/mcp`, DECO_CHAT_API(c));
    url.searchParams.set("contract", btoa(JSON.stringify(context.contract)));
    url.searchParams.set("assignor", assignor);

    const app = await publishApp.handler({
      name: assignorName,
      scopeName: context.author.scope,
      icon: "https://assets.decocache.com/mcp/10b5e8b4-a4e2-4868-8a7d-8cf9b46f0d79/contract.png",
      description: context.contract.body,
      friendlyName: `A Contract for ${assignorName}`,
      unlisted: true,
      connection: {
        type: "HTTP",
        url: url.href,
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
  inputSchema: z.object({
    clauses: z.array(
      z.object({
        clauseId: z.string(),
        amount: z.number().min(1), // Number of units to charge (multiplied by clause price)
      }),
    ),
  }),
  outputSchema: z.object({
    transactionId: z.string(),
    totalAmount: z.string(),
    timestamp: z.number(),
  }),
  handler: async (context, c) => {
    if (
      !("integrationId" in c.user) ||
      typeof c.user.integrationId !== "string"
    ) {
      throw new ForbiddenError("Integration ID not found");
    }

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
  inputSchema: z.object({}),
  outputSchema: z.object({
    contract: ContractStateSchema,
  }),
  handler: (_, c) => {
    c.resourceAccess.grant();
    return {
      contract: c.state,
    };
  },
});

export const contractSettle = createContractTool({
  name: "CONTRACT_SETTLE",
  description:
    "Settle the current authorized charge. Processes the payment for the current authorization.",
  inputSchema: z.object({
    transactionId: z.string(),
    clauses: z.array(ContractClauseExerciseSchema).optional(),
    amount: z.number().optional(),
    vendorId: z.string(),
  }),
  outputSchema: z.object({
    transactionId: z.string(),
  }),
  handler: async (context, c) => {
    if (
      !("integrationId" in c.user) ||
      typeof c.user.integrationId !== "string"
    ) {
      throw new ForbiddenError("Integration ID not found");
    }

    const state = c.state;
    const contractId = c.user.integrationId;

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
      }),
    );

    return {
      transactionId: context.transactionId,
    };
  },
});
