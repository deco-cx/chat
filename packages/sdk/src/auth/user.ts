import type { AuthUser } from "@supabase/supabase-js";
import { jwtDecode } from "jwt-decode";
import { LRUCache } from "lru-cache";
import process from "node:process";
import {
  createSupabaseSessionClient,
  getSessionToken,
  parseAuthorizationHeader,
} from "./supabase.ts";

export type { AuthUser };
const ONE_MINUTE_MS = 60e3;
const cache = new LRUCache<string, AuthUser>({
  max: 1000,
  ttl: ONE_MINUTE_MS,
});

const MILLISECONDS = 1e3;

export async function getUserBySupabaseCookie(
  request: Request,
  supabaseServerToken: string,
): Promise<AuthUser | undefined> {
  const accessToken = parseAuthorizationHeader(request);
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
  const { supabase } = createSupabaseSessionClient(
    request,
    supabaseServerToken,
  );
  const { data: _user } = await supabase.auth.getUser(
    accessToken,
  );
  const user = _user?.user;
  if (!user) {
    return undefined;
  }
  let cachettl = undefined;
  if (sessionToken) {
    const { data: session } = await supabase.auth.getSession();
    cachettl = session?.session?.expires_at;
  }
  if (accessToken) {
    try {
      const decoded = jwtDecode(accessToken, { header: true }) as {
        expires_at: number;
      };
      cachettl = (decoded.expires_at * MILLISECONDS) - Date.now();
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

// copied from user.server.ts
const ALLOWED_EMAIL_DOMAINS = [
  "deco.cx",
  "carcara.tech",
  "webdraw.com",
];

if (process.env.ADMIN_EMAIL_DOMAINS) {
  const domains = process.env.ADMIN_EMAIL_DOMAINS.split(",");
  ALLOWED_EMAIL_DOMAINS.push(...domains);
}

export function isUserAdmin(user: Pick<AuthUser, "id" | "email">): boolean {
  const email = user.email;

  if (!email) {
    return false;
  }

  const domain = email.split("@")[1];
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

// from https://email-verify.my-addr.com/list-of-most-popular-email-domains.php
// plus GPT Prompt "can you add more well known that is missing from this list?"
const WELL_KNOWN_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "aol.com",
  "hotmail.co.uk",
  "hotmail.fr",
  "msn.com",
  "yahoo.fr",
  "wanadoo.fr",
  "orange.fr",
  "comcast.net",
  "yahoo.co.uk",
  "yahoo.com.br",
  "yahoo.co.in",
  "live.com",
  "rediffmail.com",
  "free.fr",
  "gmx.de",
  "web.de",
  "yandex.ru",
  "ymail.com",
  "libero.it",
  "outlook.com",
  "uol.com.br",
  "bol.com.br",
  "mail.ru",
  "cox.net",
  "hotmail.it",
  "sbcglobal.net",
  "sfr.fr",
  "live.fr",
  "verizon.net",
  "live.co.uk",
  "googlemail.com",
  "yahoo.es",
  "ig.com.br",
  "live.nl",
  "bigpond.com",
  "terra.com.br",
  "yahoo.it",
  "neuf.fr",
  "yahoo.de",
  "alice.it",
  "rocketmail.com",
  "att.net",
  "laposte.net",
  "facebook.com",
  "bellsouth.net",
  "yahoo.in",
  "hotmail.es",
  "charter.net",
  "yahoo.ca",
  "yahoo.com.au",
  "rambler.ru",
  "hotmail.de",
  "tiscali.it",
  "shaw.ca",
  "yahoo.co.jp",
  "sky.com",
  "earthlink.net",
  "optonline.net",
  "freenet.de",
  "t-online.de",
  "aliceadsl.fr",
  "virgilio.it",
  "home.nl",
  "qq.com",
  "telenet.be",
  "me.com",
  "icloud.com", // Apple iCloud
  "proton.me", // ProtonMail
  "fastmail.com", // Fastmail
  "zoho.com", // Zoho Mail
  "hushmail.com", // Hushmail
  "yahoo.com.ph", // Yahoo Philippines
  "mailinator.com", // Temporary email
  "gmx.com", // GMX International
  "yahoo.com.hk", // Yahoo Hong Kong
  "yahoo.co.th", // Yahoo Thailand
  "yahoo.com.vn", // Yahoo Vietnam
  "yahoo.com.cn", // Yahoo China (legacy)
  "mailbox.org", // Secure German provider
  "posteo.de", // Secure German provider
  "bigmir.net", // Ukraine
  "ukr.net", // Ukraine
  "126.com", // Chinese provider
  "163.com", // Chinese provider
  "sina.com", // Chinese provider
  "tutanota.com", // Secure email
  "runbox.com", // Secure email
  "zoznam.sk", // Slovakia
  "seznam.cz", // Czech Republic
  "naver.com", // South Korea
  "daum.net", // South Korea
  "lycos.com", // Legacy provider
  "bellsouth.net",
  "mac.com",
  "live.ca",
  "aim.com",
  "bigpond.net.au",
  "netzero.net", // Legacy provider
  "usa.net", // Legacy provider
  "excite.com", // Legacy provider
  "outlook.co.uk", // Outlook UK
  "outlook.de", // Outlook Germany
  "mailbox.org", // Privacy-focused
];

const normalizePathPrefix = (pathPrefix: string) =>
  pathPrefix.startsWith("/") ? pathPrefix.slice(1) : pathPrefix;

const isUserHome = (pathPrefix: string, userId: string) =>
  normalizePathPrefix(pathPrefix).startsWith(`users/${userId}`);

const isSharedDir = (pathPrefix: string, email?: string) => {
  if (!email) {
    return false;
  }
  const [_, domain] = email.split("@");
  return !WELL_KNOWN_EMAIL_DOMAINS.includes(domain) &&
    normalizePathPrefix(pathPrefix).startsWith(`shared/${domain}`);
};

export const hasAccessToPath = (
  user: Pick<AuthUser, "id" | "email">,
  path: string,
): boolean => {
  return isUserAdmin(user) || isUserHome(path, user.id) ||
    isSharedDir(path, user.email);
};
