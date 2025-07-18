import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./constants.ts";

export function createClient(requestHeaders: Headers = new Headers()) {
  const cookies = parseCookieHeader(requestHeaders.get("cookie") ?? "");
  const filteredCookies = cookies.filter(
    (cookie): cookie is { name: string; value: string } => !!cookie.value,
  );

  const responseHeaders = new Headers();

  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => filteredCookies,
      setAll(cookies) {
        cookies.forEach((cookie) => {
          responseHeaders.append(
            "Set-Cookie",
            serializeCookieHeader(cookie.name, cookie.value, cookie.options),
          );
        });
      },
    },
  });

  return { client, responseHeaders };
}
