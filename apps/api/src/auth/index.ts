import { getUserBySupabaseCookie } from "@deco/sdk/auth";
import { createSupabaseClient } from "@deco/sdk/storage";
import type {
  EmailOtpType,
  Provider,
  User as SupaUser,
} from "@supabase/supabase-js";
import { Hono } from "hono";
import { honoCtxToAppCtx } from "../api.ts";
import {
  DECO_CMS_API,
  getEnv,
  type HonoAppContext as AppContext,
  type Principal,
} from "../utils/context.ts";
import { getCookies, setHeaders } from "../utils/cookie.ts";
import { authSetCookie, getServerClientOptions } from "../utils/db.ts";
import { assertPrincipalIsUser } from "./assertions.ts";
import { AUTH_URL_CLI } from "../../../../packages/sdk/src/constants.ts";

const AUTH_CALLBACK_OAUTH = "/auth/callback/oauth";

const appAuth = new Hono();
const appLogin = new Hono();
export const ROUTES = {
  ["/auth"]: appAuth,
  ["/login"]: appLogin,
} as const;

const createDbAndHeadersForRequest = (ctx: AppContext) => {
  const { SUPABASE_URL, SUPABASE_SERVER_TOKEN } = getEnv(honoCtxToAppCtx(ctx));
  const request = ctx.req.raw;
  const { headers, setCookie } = authSetCookie({ request });
  const db = createSupabaseClient(
    SUPABASE_URL,
    SUPABASE_SERVER_TOKEN,
    getServerClientOptions({
      cookies: getCookies(ctx.req.raw.headers),
      setCookie,
    }),
  );

  return { headers, db };
};

// TODO: add LRU Cache
export const getUser = async (
  ctx: AppContext,
): Promise<Principal | undefined> => {
  const {
    SUPABASE_URL,
    SUPABASE_SERVER_TOKEN,
    DECO_CHAT_API_JWT_PRIVATE_KEY,
    DECO_CHAT_API_JWT_PUBLIC_KEY,
  } = getEnv(honoCtxToAppCtx(ctx));

  const cookies = getCookies(ctx.req.raw.headers);
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVER_TOKEN, {
    cookies: {
      getAll: () =>
        Object.entries(cookies).map(([name, value]) => ({
          name,
          value,
        })),
      setAll: (_cookies) => {},
    },
  });

  const user = await getUserBySupabaseCookie(
    ctx.req.raw,
    supabase,
    DECO_CHAT_API_JWT_PRIVATE_KEY && DECO_CHAT_API_JWT_PUBLIC_KEY
      ? {
          public: DECO_CHAT_API_JWT_PUBLIC_KEY,
          private: DECO_CHAT_API_JWT_PRIVATE_KEY,
        }
      : undefined,
  );

  if (!user) {
    return undefined;
  }

  return user as unknown as SupaUser;
};

export const createMagicLinkEmail = async (ctx: AppContext) => {
  const formData = (await ctx.req.json()) as { email: string };
  const email = formData.email;
  const request = ctx.req.raw;

  try {
    const { db } = createDbAndHeadersForRequest(ctx);

    const url = new URL(request.url);

    // We do not send the full path to supabase but the email template
    // includes a condition to insert it (/auth/callback/magiclink)
    const redirectTo = url.host.includes("localhost")
      ? "http://localhost:3001/"
      : url.host.includes("deco.chat")
        ? "https://api.deco.chat/"
        : "https://api.decocms.com/";

    await db.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });
    return { email };
  } catch (_) {
    return { error: "" };
  }
};

appLogin.all("/oauth", async (ctx: AppContext) => {
  let user;
  try {
    assertPrincipalIsUser(ctx.var);
    user = ctx.var.user;
  } catch {
    /**/
  }

  // user already logged in, set by userMiddleware
  if (user && !user.is_anonymous) {
    const origin =
      ctx.req.header("referer") ||
      ctx.req.header("origin") ||
      "https://admin.decocms.com";
    return ctx.redirect(origin);
  }

  const { db, headers } = createDbAndHeadersForRequest(ctx);
  const request = ctx.req.raw;
  const url = new URL(request.url);
  const provider = (url.searchParams.get("provider") ?? "google") as Provider;
  const redirectTo = new URL(
    AUTH_CALLBACK_OAUTH,
    DECO_CMS_API(honoCtxToAppCtx(ctx), url.host.includes("deco.chat")),
  );

  const next = url.searchParams.get("next");
  if (next) {
    redirectTo.searchParams.set("next", next);
  }

  const credentials = {
    provider,
    options: {
      redirectTo: redirectTo.toString(),
    },
  };

  const { data } = await db.auth.signInWithOAuth(credentials);

  if (!data.url) {
    throw new Error("decocms.com auth failed to log in.");
  }

  setHeaders(headers, ctx);
  return ctx.redirect(data.url);
});

appLogin.all("/magiclink", async (ctx: AppContext) => {
  const formData = (await ctx.req.json()) as { email: string; cli: boolean };
  const email = formData.email;
  const cli = formData.cli;
  const request = ctx.req.raw;

  try {
    const { db } = createDbAndHeadersForRequest(ctx);

    const url = new URL(request.url);

    // We do not send the full path to supabase but the email template
    // includes a condition to insert it (/auth/callback/magiclink)
    const redirectTo = cli
      ? AUTH_URL_CLI
      : url.host.includes("localhost")
        ? "http://localhost:3001/"
        : url.host.includes("deco.chat")
          ? "https://api.deco.chat/"
          : "https://api.decocms.com/";

    await db.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });
    return ctx.json({ email });
  } catch (_) {
    return ctx.json({ error: "" }, 400);
  }
});

appAuth.all("/callback/oauth", async (ctx: AppContext) => {
  try {
    const { db, headers } = createDbAndHeadersForRequest(ctx);
    const request = ctx.req.raw;
    const url = new URL(request.url);
    const next =
      url.searchParams.get("next") ||
      (url.host.includes("localhost")
        ? "http://localhost:3000"
        : url.host.includes("deco.chat")
          ? "https://deco.chat"
          : "https://admin.decocms.com");
    const code = url.searchParams.get("code");

    if (!code) {
      throw new Error("No code provided");
    }

    const { error } = await db.auth.exchangeCodeForSession(code);

    if (error) {
      console.log(error);
      throw new Error("Failed to finish login flow");
    }

    setHeaders(headers, ctx);

    return ctx.redirect(next);
  } catch (e) {
    if (e instanceof Error) {
      return ctx.text(e.message, 400);
    }

    return ctx.text("Something went wrong", 400);
  }
});

appAuth.all("/callback/magiclink", async (ctx: AppContext) => {
  try {
    const request = ctx.req.raw;
    const { db, headers } = createDbAndHeadersForRequest(ctx);
    const url = new URL(request.url);
    const next =
      url.searchParams.get("next") ||
      (url.host.includes("localhost")
        ? "http://localhost:3000"
        : url.host.includes("deco.chat")
          ? "https://deco.chat"
          : "https://admin.decocms.com");
    const tokenHash = url.searchParams.get("tokenHash");
    const type = url.searchParams.get("type") as EmailOtpType | null;

    if (!tokenHash || !type) {
      throw new Error("Missing tokenHash or type");
    }

    const { error } = await db.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (error) {
      console.log(error);
      throw new Error("Failed to finish login flow");
    }

    setHeaders(headers, ctx);

    return ctx.redirect(next);
  } catch (e) {
    if (e instanceof Error) {
      return ctx.text(e.message, 400);
    }

    return ctx.text("Something went wrong", 400);
  }
});

appAuth.all("/logout", async (ctx: AppContext) => {
  const url = new URL(ctx.req.url);
  const { db, headers } = createDbAndHeadersForRequest(ctx);
  await db.auth.signOut();

  const redirectUrl = url.searchParams.get("next") ?? "/";

  setHeaders(headers, ctx);

  return ctx.redirect(redirectUrl);
});
