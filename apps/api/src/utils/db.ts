import {
  type createServerClient,
  serializeCookieHeader,
  type SetAllCookies,
} from "@supabase/ssr";

export type Options = Parameters<typeof createServerClient>;

export const getCookieDomain = (hostname: string) =>
  hostname.split(".").slice(-2).join(".");

export const getServerClientOptions = ({
  cookies,
  setCookie,
}: {
  cookies: Record<string, string>;
  setCookie?: SetAllCookies;
}): Options[2] => {
  return {
    cookies: {
      getAll: () =>
        Object.entries(cookies).map(([name, value]) => ({
          name,
          value,
        })),
      setAll: setCookie ?? ((_cookies) => {}),
    },
  };
};

export const authSetCookie = ({ request }: { request: Request }) => {
  const headers = new Headers();
  const setCookie: SetAllCookies = (cookies) => {
    const url = new URL(request.url);
    const rootDomain = getCookieDomain(url.hostname);
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
  };

  return { setCookie, headers };
};
