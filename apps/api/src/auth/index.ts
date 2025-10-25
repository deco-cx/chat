import { getUserBySupabaseCookie } from "@deco/sdk/auth";
import { Client, createSupabaseClient } from "@deco/sdk/storage";
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
} from "../utils/context.ts";
import { getCookies, setHeaders } from "../utils/cookie.ts";
import { authSetCookie, getServerClientOptions } from "../utils/db.ts";
import { AUTH_URL_CLI } from "../../../../packages/sdk/src/constants.ts";
import {
  createWalletClient,
  WellKnownTransactions,
} from "@deco/sdk/mcp/wallet";
import { assertPrincipalIsUser, InternalServerError } from "@deco/sdk/mcp";
import { WELL_KNOWN_PLANS } from "@deco/sdk";

const AUTH_CALLBACK_OAUTH = "/auth/callback/oauth";
const ENSURE_USER_ASSERTIONS_ENDPOINT = "/auth/ensure-user-assertions";

const withUserAssertionsEnsuring = (next: string, apiUrl: string) => {
  const newUrl = new URL(ENSURE_USER_ASSERTIONS_ENDPOINT, apiUrl);
  newUrl.searchParams.set("next", next);
  return newUrl.toString();
};

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

export const getUser = async (
  ctx: AppContext,
): Promise<SupaUser | undefined> => {
  const {
    SUPABASE_URL,
    SUPABASE_SERVER_TOKEN,
    DECO_CHAT_API_JWT_PRIVATE_KEY,
    DECO_CHAT_API_JWT_PUBLIC_KEY,
  } = ctx.env;

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
  } catch {
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
      ...(provider === "azure"
        ? { scopes: "openid profile User.Read email" }
        : {}),
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
        ? "http://localhost:3000/"
        : "https://admin.decocms.com/";

    await db.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });
    return ctx.json({ email });
  } catch {
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

    const uri = withUserAssertionsEnsuring(
      next,
      DECO_CMS_API(honoCtxToAppCtx(ctx), url.host.includes("deco.chat")),
    );
    return ctx.redirect(uri);
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

    const uri = withUserAssertionsEnsuring(
      next,
      DECO_CMS_API(honoCtxToAppCtx(ctx), url.host.includes("deco.chat")),
    );
    return ctx.redirect(uri);
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

async function ensureFreeTwoDollarsTransaction({
  wallet,
  walletWorkspace,
}: {
  wallet: ReturnType<typeof createWalletClient>;
  walletWorkspace: string;
}) {
  const freeTwoDollars = {
    type: "WorkspaceGenCreditReward" as const,
    amount: "2_000000",
    workspace: walletWorkspace,
    transactionId: WellKnownTransactions.freeTwoDollars(
      encodeURIComponent(walletWorkspace),
    ),
  };

  const freeTwoDollarsResponse = await wallet["PUT /transactions/:id"](
    { id: freeTwoDollars.transactionId },
    {
      body: freeTwoDollars,
    },
  );

  if (!freeTwoDollarsResponse.ok) {
    console.error(
      "Failed to create free two dollars transaction",
      freeTwoDollarsResponse,
      await freeTwoDollarsResponse.text(),
    );
  }
}

export function slugifyForOrg(input: string): string {
  // Lowercase and replace all non-alphanumeric with underscores
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      // Collapse multiple underscores
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
}

async function ensureHasAnyOrg({
  db,
  user,
}: {
  db: Client;
  user: SupaUser;
}): Promise<{ created: boolean; slug: string | null }> {
  const { data: existingOrg, error: existingOrgError } = await db
    .from("teams")
    .select("id, members!inner(id, user_id)")
    .eq("members.user_id", user.id)
    .is("members.deleted_at", null);

  if (existingOrg && existingOrg.length > 0) {
    return { created: false, slug: null };
  }

  if (existingOrgError) {
    console.error("Failed to read existing orgs", existingOrgError);
    throw new InternalServerError("Failed to get existing orgs");
  }

  const userFirstName =
    user.user_metadata.full_name?.split(" ")?.[0] ??
    user.email?.split("@")?.[0];

  const orgName = userFirstName ? `${userFirstName}'s org` : "Personal org";
  const slugFromUser = userFirstName
    ? slugifyForOrg(userFirstName)
    : "personal";

  let slug = slugFromUser;
  let validSlug = false;

  while (!validSlug) {
    const { data: existingTeam, error: slugError } = await db
      .from("teams")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (slugError) {
      console.error("Failed to read existing team", slugError);
      throw new InternalServerError("Failed to create valid user org slug");
    }

    if (existingTeam) {
      const randomFourChars = crypto.randomUUID().slice(0, 4);
      slug = `${slugFromUser}-${randomFourChars}`;
    } else {
      validSlug = true;
    }
  }

  const { data: team, error } = await db
    .from("teams")
    .insert({
      name: orgName,
      slug,
      plan_id: WELL_KNOWN_PLANS.FREE,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create team", error);
    throw new InternalServerError("Failed to create team");
  }

  const { data: member, error: addMemberError } = await db
    .from("members")
    .insert([
      {
        team_id: team.id,
        user_id: user.id,
        admin: true,
      },
    ])
    .select()
    .single();

  if (addMemberError) {
    console.error("Failed to add member to team", addMemberError);
    throw new InternalServerError("Failed to add member to team");
  }

  const WELL_KNOWN_ADMIN_ROLE_ID = 4;

  const { error: roleError } = await db.from("member_roles").insert([
    {
      member_id: member.id,
      role_id: WELL_KNOWN_ADMIN_ROLE_ID,
    },
  ]);

  if (roleError) {
    console.error("Failed to add role to member", roleError);
    throw new InternalServerError("Failed to add role to member");
  }

  const { error: defaultProjectError } = await db
    .from("deco_chat_projects")
    .insert([
      {
        org_id: team.id,
        slug: "default",
        title: `${team.name} Default project`,
        description: `${team.name}'s Default project`,
      },
    ]);

  if (defaultProjectError) {
    console.error("Failed to create default project", defaultProjectError);
    throw new InternalServerError("Failed to create default project");
  }

  return { created: true, slug: team.slug };
}

async function assertUserHasPersonalOrg(ctx: AppContext) {
  const user = await getUser(ctx);
  const db = ctx.get("db");

  if (!ctx.env.WALLET_API_KEY) {
    throw new InternalServerError("WALLET_API_KEY is not set");
  }

  if (!user?.id) {
    throw new InternalServerError("User ID is not set");
  }

  const result = await ensureHasAnyOrg({
    db,
    user,
  });

  if (!result.created) {
    ctx.header("X-Org-Already-Exists", "true");
    return;
  }

  const walletWorkspace = `/shared/${result.slug}`;
  const wallet = createWalletClient(ctx.env.WALLET_API_KEY);

  await ensureFreeTwoDollarsTransaction({
    wallet,
    walletWorkspace,
  });
}

appAuth.all("/ensure-user-assertions", async (ctx: AppContext) => {
  const url = new URL(ctx.req.url);
  const nextDefault = new URL("/", url.origin).toString();
  const redirectUrl = url.searchParams.get("next") ?? nextDefault;

  const assertions = [assertUserHasPersonalOrg];

  try {
    await Promise.all(assertions.map((assertion) => assertion(ctx)));
  } catch (error) {
    console.error("Failed to run user assertions on login", error);
  }

  return ctx.redirect(redirectUrl);
});
