import type { AuthUser, SupabaseClient } from "@supabase/supabase-js";
import { decodeJwt } from "jose";
import { LRUCache } from "lru-cache";
import type { Principal } from "../mcp/context.ts";
import {
  JwtIssuer,
  JwtPayloadWithClaims,
  type JwtIssuerKeyPair,
} from "./jwt.ts";
import {
  createSupabaseSessionClient,
  getSessionToken,
  parseAuthorizationToken,
} from "./supabase.ts";

export type { AuthUser };
const ONE_MINUTE_MS = 60e3;
const cache = new LRUCache<string, Principal>({
  max: 1000,
  ttl: ONE_MINUTE_MS,
});

const MILLISECONDS = 1e3;

export const userFromJWT = async (
  jwt: string,
  keyPair?: JwtIssuerKeyPair,
): Promise<Principal | undefined> => {
  const jwtIssuer = await JwtIssuer.forKeyPair(keyPair);
  const payload = await jwtIssuer.verify(jwt);
  return payload;
};

export async function getUserBySupabaseCookie(
  request: Request,
  supabaseServerToken: string | SupabaseClient,
  keyPair?: JwtIssuerKeyPair,
): Promise<Principal | undefined> {
  const jwtIssuer = await JwtIssuer.forKeyPair(keyPair);
  const accessToken = parseAuthorizationToken(request);
  const sessionToken = getSessionToken(request);

  if (!sessionToken && !accessToken) {
    return undefined;
  }
  if (sessionToken && cache.has(sessionToken)) {
    return cache.get(sessionToken);
  }
  if (accessToken && cache.has(accessToken)) {
    return cache.get(accessToken);
  }
  const { supabase } =
    typeof supabaseServerToken === "string"
      ? createSupabaseSessionClient(request, supabaseServerToken)
      : { supabase: supabaseServerToken };
  const [{ data: _user }, [jwt, key]] = await Promise.all([
    supabase.auth.getUser(accessToken),
    jwtIssuer.verify(sessionToken).then((jwt) => {
      if (!jwt && accessToken) {
        return jwtIssuer
          .verify(accessToken)
          .then((jwt) => [jwt, accessToken] as [JwtPayloadWithClaims, string]);
      }
      return [jwt, sessionToken] as [JwtPayloadWithClaims, string];
    }),
  ]);

  const user = _user?.user;
  if (!user) {
    if (jwt && key) {
      cache.set(key, jwt);
    }
    return jwt;
  }
  let cachettl = undefined;
  if (sessionToken) {
    const { data: session } = await supabase.auth.getSession();
    cachettl = session?.session?.expires_at;
  }
  if (accessToken) {
    try {
      const decoded = decodeJwt(accessToken) as {
        expires_at: number;
      };
      cachettl = decoded.expires_at * MILLISECONDS - Date.now();
    } catch (err) {
      console.error(err);
      // ignore if any error
    }
  }
  const cacheToken = sessionToken || accessToken;
  if (cachettl && cacheToken) {
    cache.set(cacheToken, user, { ttl: cachettl });
  }

  return user;
}
