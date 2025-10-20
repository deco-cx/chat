import { and, eq } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { AppContext } from "../context";
import {
  filterByWorkspaceOrLocator,
  filterByWorkspaceOrProjectId,
} from "../ownership";
import { relations } from "../relations";
import { models, projects, organizations } from "../schema";

export interface LLMVault {
  readApiKey(modelId: string): Promise<{ model: string; apiKey: string }>;
  updateApiKey(modelId: string, apiKey: string | null): Promise<void>;
}

export class SupabaseLLMVault implements LLMVault {
  private encryptionKey: Buffer;
  private ivLength = 16; // AES block size
  private drizzle: PostgresJsDatabase<
    Record<string, unknown>,
    typeof relations
  >;
  private ctx: AppContext;

  constructor(c: AppContext) {
    const encryptionKey = c.envVars.LLMS_ENCRYPTION_KEY;
    if (encryptionKey.length !== 32) {
      throw new Error("Encryption key must be 32 characters long for AES-256");
    }
    this.encryptionKey = Buffer.from(encryptionKey);
    this.drizzle = c.drizzle;
    this.ctx = c;
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv("aes-256-cbc", this.encryptionKey, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  async readApiKey(
    modelId: string,
  ): Promise<{ model: string; apiKey: string }> {
    const [data] = await this.drizzle
      .select({
        model: models.model,
        apiKeyHash: models.api_key_hash,
      })
      .from(models)
      .leftJoin(projects, eq(models.project_id, projects.id))
      .leftJoin(organizations, eq(projects.org_id, organizations.id))
      .where(
        and(
          eq(models.id, modelId),
          filterByWorkspaceOrLocator({
            table: models,
            ctx: this.ctx,
          }),
        ),
      )
      .limit(1);

    if (!data) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (!data.apiKeyHash) {
      throw new Error(`Model ${modelId} does not have an API key`);
    }

    return {
      model: data.model,
      apiKey: this.decrypt(data.apiKeyHash),
    };
  }

  decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      this.encryptionKey,
      iv,
    );
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  async updateApiKey(modelId: string, apiKey: string | null): Promise<void> {
    const encryptedKey = apiKey ? this.encrypt(apiKey) : null;
    const filter = await filterByWorkspaceOrProjectId({
      table: models,
      ctx: this.ctx,
    });

    await this.drizzle
      .update(models)
      .set({ api_key_hash: encryptedKey })
      .where(and(eq(models.id, modelId), filter));
  }
}
