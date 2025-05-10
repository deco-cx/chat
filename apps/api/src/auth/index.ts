import { Hono } from "hono";
import {
  EmailOtpType,
  type Provider,
  type User as SupaUser,
} from "@supabase/supabase-js";
import { createSupabaseClient } from "../db/client.ts";
import { getCookies, setHeaders } from "../utils/cookie.ts";
import { AppContext, AUTH_URL, getEnv } from "../utils/context.ts";
import { authSetCookie, getServerClientOptions } from "../utils/db.ts";

const AUTH_CALLBACK_OAUTH = "/auth/callback/oauth";

const appAuth = new Hono();
const appLogin = new Hono();
export const ROUTES = {
  ["/auth"]: appAuth,
  ["/login"]: appLogin,
} as const;

const createDbAndHeadersForRequest = (ctx: AppContext) => {
  const { SUPABASE_URL, SUPABASE_SERVER_TOKEN } = getEnv(ctx);
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
): Promise<SupaUser | undefined> => {
  const { SUPABASE_URL, SUPABASE_SERVER_TOKEN } = getEnv(ctx);

  const cookies = getCookies(ctx.req.raw.headers);
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVER_TOKEN, {
    cookies: {
      getAll: () =>
        Object.entries(cookies).map(([name, value]) => ({
          name,
          value,
        })),
      setAll: (_cookies) => {
      },
    },
  });

  const { data } = await supabase.auth.getUser(undefined);

  const user = data?.user;

  if (!user) {
    return undefined;
  }

  return user as unknown as SupaUser;
};

export const createMagicLinkEmail = async (ctx: AppContext) => {
  const formData = await ctx.req.json() as { email: string };
  const email = formData.email;
  const request = ctx.req.raw;

  try {
    const { db } = createDbAndHeadersForRequest(ctx);

    const url = new URL(request.url);

    // We do not send the full path to supabase but the email template
    // includes a condition to insert it (/auth/callback/magiclink)
    const redirectTo = url.host.includes("localhost")
      ? "http://localhost:3001/"
      : "https://api.deco.chat/";

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
  const user = ctx.get("user");

  // user already logged in, set by userMiddleware
  if (user) {
    return ctx.redirect("/");
  }

  const { db, headers } = createDbAndHeadersForRequest(ctx);
  const request = ctx.req.raw;
  const url = new URL(request.url);
  const provider = (url.searchParams.get("provider") ?? "google") as Provider;
  const redirectTo = new URL(
    AUTH_CALLBACK_OAUTH,
    AUTH_URL(ctx),
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

  if (data.url) {
    setHeaders(headers, ctx);

    return ctx.redirect(data.url);
  }

  throw new Error("deco.chat auth failed to log in.");
});

appLogin.all("/magiclink", async (ctx: AppContext) => {
  const formData = await ctx.req.json() as { email: string };
  const email = formData.email;
  const request = ctx.req.raw;

  try {
    const { db } = createDbAndHeadersForRequest(ctx);

    const url = new URL(request.url);

    // We do not send the full path to supabase but the email template
    // includes a condition to insert it (/auth/callback/magiclink)
    const redirectTo = url.host.includes("localhost")
      ? "http://localhost:3001/"
      : "https://api.deco.chat/";

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
    const nextDefault = new URL("/", url.origin).toString();
    const redirectUrl = url.searchParams.get("next") || nextDefault;
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

    return ctx.redirect(redirectUrl);
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
    const next = url.searchParams.get("next") ||
      (url.host.includes("localhost")
        ? "http://localhost:3000"
        : "https://deco.chat");
    const tokenHash = url.searchParams.get("tokenHash");
    const type = url.searchParams.get("type") as EmailOtpType | null;

    if (!tokenHash || !type) {
      throw new Error(
        "Missing tokenHash or type",
      );
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
