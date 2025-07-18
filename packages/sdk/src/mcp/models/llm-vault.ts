import type { SupabaseClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";

export interface LLMVault {
  readApiKey(modelId: string): Promise<{ model: string; apiKey: string }>;
  storeApiKey(modelId: string, apiKey: string): Promise<void>;
  updateApiKey(modelId: string, apiKey: string | null): Promise<void>;
  removeApiKey(modelId: string): Promise<void>;
}

export class SupabaseLLMVault implements LLMVault {
  private encryptionKey: Buffer;
  private ivLength = 16; // AES block size
  private workspace: string;

  constructor(
    private db: SupabaseClient,
    encryptionKey: string,
    workspace: string,
  ) {
    if (encryptionKey.length !== 32) {
      throw new Error("Encryption key must be 32 characters long for AES-256");
    }
    this.encryptionKey = Buffer.from(encryptionKey);
    this.workspace = workspace;
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
    const { data, error } = await this.db
      .from("models")
      .select("model, api_key_hash")
      .eq("id", modelId)
      .eq("workspace", this.workspace)
      .single();

    if (error) throw error;

    return {
      model: data.model,
      apiKey: this.decrypt(data.api_key_hash),
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

  async storeApiKey(modelId: string, apiKey: string): Promise<void> {
    const encryptedKey = this.encrypt(apiKey);

    const { error } = await this.db
      .from("models")
      .update({ api_key_hash: encryptedKey })
      .eq("id", modelId)
      .eq("workspace", this.workspace);

    if (error) throw error;
  }

  async updateApiKey(modelId: string, apiKey: string | null): Promise<void> {
    const encryptedKey = apiKey ? this.encrypt(apiKey) : null;

    const { error } = await this.db
      .from("models")
      .update({ api_key_hash: encryptedKey })
      .eq("id", modelId)
      .eq("workspace", this.workspace);

    if (error) throw error;
  }

  async removeApiKey(modelId: string): Promise<void> {
    const { error } = await this.db
      .from("models")
      .update({ api_key_hash: null })
      .eq("id", modelId)
      .eq("workspace", this.workspace);

    if (error) throw error;
  }
}
