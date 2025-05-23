import { createHttpClient } from "../../http.ts";
import { MicroDollar } from "./microdollar.ts";

export interface DoubleEntry {
  debit: string;
  credit: string;
  amount: MicroDollar;
}

export interface TransactionOperation {
  type: string;
  timestamp: Date;
}

export interface WorkspaceCashIn extends TransactionOperation {
  type: "WorkspaceCashIn";
  amount: number | string;
  workspace: string;
}

export interface CashIn extends TransactionOperation {
  type: "CashIn";
  amount: number | string;
  userId: string;
}

export interface CashOut extends TransactionOperation {
  type: "CashOut";
  amount: number | string;
  userId: string;
}

export interface PartyBase {
  type: string;
}

export interface User extends PartyBase {
  type: "user";
  id: string;
}

export interface Vendor extends PartyBase {
  type: "vendor";
  id: string;
}

export interface Provider extends PartyBase {
  type: "provider";
  model: string;
}

export type TextModelUsage = {
  /**
The number of tokens used in the prompt.
   */
  promptTokens: number;
  /**
The number of tokens used in the completion.
 */
  completionTokens: number;
  /**
The total number of tokens used (promptTokens + completionTokens).
   */
  totalTokens: number;
};

export interface ImageModelUsage {
  size?: `${number}x${number}`;
}

export interface VideoModelUsage {
  seconds?: number;
}

export interface AudioModelUsage {
  seconds?: number;
}

export interface AppUsageEvent {
  model: string;
  type: "text" | "image" | "video" | "audio" | "object3d";
  appId: string;
  usage: TextModelUsage | ImageModelUsage | VideoModelUsage | AudioModelUsage;
}

export interface AgentUsageEvent {
  model: string;
  usage: TextModelUsage;
  agentId: string;
  agentPath: string;
  threadId: string;
  /**
   * either:
   * - /users/${userId}
   * - /${workspaceSlug}
   */
  workspace: string;
}

export interface Payer {
  type: "wallet";
  id: string;
}

export interface GenCreditsReward extends TransactionOperation {
  type: "GenCreditsReward";
  amount: number | string;
  userId: string;
}

export interface WorkspaceGenCreditReward extends TransactionOperation {
  type: "WorkspaceGenCreditReward";
  amount: number | string;
  workspace: string;
}

interface BaseGeneration extends TransactionOperation {
  generatedBy: User;
  payer?: Payer;
  vendor: Vendor;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface Generation extends BaseGeneration {
  type: "Generation";
  usage: AppUsageEvent;
}

export interface AgentGeneration extends BaseGeneration {
  type: "AgentGeneration";
  usage: AgentUsageEvent;
}

export interface PreAuthorization extends TransactionOperation {
  type: "PreAuthorization";
  amount: number | string;
  userId: string;
  identifier: string;
  metadata?: Record<string, unknown>;
}

export interface CommitPreAuthorized extends TransactionOperation {
  type: "CommitPreAuthorized";
  userId: string;
  identifier: string;
  mcpId: string;
  amount: number | string;
  payer?: Payer;
  vendor: Vendor;
  metadata?: Record<string, unknown>;
}

export type Transaction =
  | Generation
  | AgentGeneration
  | CashIn
  | WorkspaceCashIn
  | CashOut
  | Wiretransfer
  | GenCreditsReward
  | WorkspaceGenCreditReward
  | WorkspaceCreateVoucher
  | WorkspaceRedeemVoucher
  | PreAuthorization
  | CommitPreAuthorized;

export type TransactionType = Transaction["type"];

export interface Wiretransfer extends TransactionOperation {
  type: "Wiretransfer";
  amount: number | string;
  from: string;
  to: string;
  description?: string;
}

export interface WorkspaceCreateVoucher extends TransactionOperation {
  type: "WorkspaceCreateVoucher";
  amount: number | string;
  voucherId: string;
  workspace: string;
}

export interface WorkspaceRedeemVoucher extends TransactionOperation {
  type: "WorkspaceRedeemVoucher";
  amount: number | string;
  voucherId: string;
  workspace: string;
}

export interface GeneratedFact {
  id: string;
  transaction: Transaction;
  entries: DoubleEntry[];
  timestamp: Date;
}

export interface WalletAPI {
  "GET /accounts/:id": {
    response: {
      balance: string;
      discriminator: string;
      category: string;
      type: string;
      metadata?: Record<string, unknown>;
    };
  };
  "GET /accounts/:id/statements": {
    searchParams: {
      cursor?: string;
      limit?: number;
    };
    response: {
      items: {
        amount: string;
        timestamp: string;
        transactionId: string;
        transactionType: TransactionType;
        source: string;
      }[];
      nextCursor?: string;
    };
  };
  "GET /statements": {
    searchParams: {
      accountId: string[];
      cursor?: string;
      limit?: number;
    };
    response: {
      items: {
        accountId: string;
        amount: string;
        timestamp: string;
        transactionId: string;
        transactionType: TransactionType;
        source: string;
      }[];
      nextCursor?: string;
    };
  };

  "GET /transactions/:id": {
    response: {
      transaction: Transaction;
    };
  };
  "POST /transactions": {
    body: Omit<Transaction, "timestamp">;
    response: {
      id: string;
    };
  };
  "PUT /transactions/:id": {
    body: Omit<Transaction, "timestamp">;
    response: {
      id: string;
    };
  };
  "GET /transactions": {
    searchParams: {
      cursor?: string;
      limit?: number;
      filter?: string;
    };
    response: {
      items: GeneratedFact[];
      nextCursor?: string;
    };
  };
  "POST /transactions/:id/commit": {
    body: {
      mcpId: string;
      vendor: {
        type: "vendor";
        id: string;
      };
      /**
       * If not provided, the amount will be the same as the pre-authorization.
       * Can be provided as a lower amount to refund the difference.
       */
      amount?: string;
      metadata?: Record<string, unknown>;
    };
    response: {
      id: string;
    };
  };
  "GET /usage/agents": {
    searchParams: {
      workspace: string;
      range: "day" | "week" | "month";
    };
    response: {
      total: string;
      items: {
        id: string;
        label: string;
        total: string;
      }[];
    };
  };
  "GET /usage/threads": {
    searchParams: {
      workspace: string;
      range: "day" | "week" | "month";
    };
    response: {
      total: string;
      items: {
        id: string;
        total: string;
        agentId: string;
        generatedBy: string;
        tokens: {
          totalTokens: number;
          promptTokens: number;
          completionTokens: number;
        };
      }[];
    };
  };
}

// for local dev
// const WALLET_API_URL = "http://localhost:8001";
const WALLET_API_URL = "https://wallet.webdraw.com";

export function createWalletClient(
  apiKey: string,
  fetcher?: { fetch: typeof fetch },
) {
  // TODO (@mcandeia): this is necessary since locally wallet is not running thus the fetch is not available
  let currentFetcher: typeof fetch | null = null;
  const client = createHttpClient<WalletAPI>({
    fetcher: fetcher?.fetch
      ? (req, opts) => {
        if (currentFetcher) {
          // @ts-ignore: the cloudflare fetch is not the same as the browser fetch
          return currentFetcher(req, opts);
        }
        // @ts-ignore: the cloudflare fetch is not the same as the browser fetch
        return fetcher.fetch(req, opts).then(
          (response) => {
            if (!response.ok && response.status === 503) {
              currentFetcher = fetch;
              // @ts-ignore: the cloudflare fetch is not the same as the browser fetch
              return fetch(req, opts);
            }
            return response;
          },
        );
      } // this is necessary since "this" is being used internally.
      : undefined,
    base: WALLET_API_URL,
    headers: new Headers({
      "x-api-key": apiKey,
    }),
  });

  return client;
}
