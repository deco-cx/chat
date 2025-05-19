import process from "node:process";
import { type AuthUser, getUserBySupabaseCookie } from "../auth/user.ts";

export interface AuthMetadata {
  principal?: AuthUser | null;
}

export abstract class BaseActor<
  TMetadata extends AuthMetadata = AuthMetadata,
> {
  protected env: Record<string, string>;
  protected abstract state: { id: string };
  public metadata?: TMetadata;
  constructor(env?: object) {
    this.env = {
      ...process?.env ?? {},
      ...env ?? {},
    } as Record<string, string>;
  }

  async enrichMetadata(m: TMetadata, req: Request): Promise<TMetadata> {
    const principal = await this.loadSessionPrincipal(req);
    return {
      ...m,
      principal,
    };
  }

  async loadSessionPrincipal(req: Request): Promise<AuthUser | null> {
    if (!req) {
      return null;
    }
    const user = await getUserBySupabaseCookie(
      req,
      (this.env as Record<string, string>)?.SUPABASE_SERVER_TOKEN,
    );
    return user ?? null;
  }
}
