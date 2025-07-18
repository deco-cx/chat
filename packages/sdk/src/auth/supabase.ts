import { createServerClient, serializeCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../constants.ts";

export { SUPABASE_URL };

// from @std/http
export function getCookies(headers: Headers): Record<string, string> {
  const cookie = headers.get("Cookie");
  if (cookie !== null) {
    const out: Record<string, string> = {};
    const c = cookie.split(";");
    for (const kv of c) {
      const [cookieKey, ...cookieVal] = kv.split("=");
      if (cookieKey === undefined) {
        throw new SyntaxError("Cookie cannot start with '='");
      }
      const key = cookieKey.trim();
      out[key] = cookieVal.join("=");
    }
    return out;
  }
  return {};
}

export const SB_TOKEN_COOKIE_NAME = "sb-auth-auth-token";

interface CreateSupabaseSessionClientResult {
  supabase: SupabaseClient;
  headers: Headers;
}

export const createSupabaseSessionClient = (
  request: Request,
  supabaseToken: string,
  ignoreCookie?: boolean,
): CreateSupabaseSessionClientResult => {
  const headers = new Headers();
  const supabase = createServerClient(SUPABASE_URL, supabaseToken, {
    cookies: {
      getAll: () => {
        // Keep this getCookies from Deno here!
        const cookies = getCookies(request.headers);
        if (ignoreCookie) {
          return [];
        }
        return Object.entries(cookies).map(([name, value]) => ({
          name,
          value,
        }));
      },
      setAll(cookies) {
        const url = new URL(request.url);
        const rootDomain = url.hostname.split(".").slice(-2).join(".");
        for (const { name, value, options } of cookies) {
          headers.append(
            "set-cookie",
            serializeCookieHeader(name, value, {
              ...options,
              sameSite: "none", // allow for subdomains.
              secure: true,
              domain: `.${rootDomain}`,
            }),
          );
        }
      },
    },
  });

  return { supabase, headers };
};

export const getSessionToken = (request: Request): string => {
  const cookies = getCookies(request.headers);
  // Reconstruct the token from multiple parts
  const tokenParts = [];
  for (const [cookieName, cookieValue] of Object.entries(cookies)) {
    if (cookieName.startsWith(SB_TOKEN_COOKIE_NAME)) {
      tokenParts.push(cookieValue.trim());
    }
  }

  return tokenParts.join("").replace("base64-", "");
};

export const createSessionTokenCookie = (
  token: string,
  domain: string,
): string => {
  return serializeCookieHeader(SB_TOKEN_COOKIE_NAME, token, {
    domain,
    sameSite: "none",
    secure: true,
  });
};

export const parseAuthorizationHeader = (
  request: Request,
): string | undefined => {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return undefined;
  }
  const parts = authorization.split(" ");
  if (parts.length !== 2) {
    return undefined;
  }
  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== "bearer") {
    return undefined;
  }
  return token;
};
