export interface State {
  next?: string;
}

export const StateParser = {
  parse: (state: string) => {
    return JSON.parse(decodeURIComponent(atob(state))) as State;
  },
  stringify: (state: State) => {
    return btoa(encodeURIComponent(JSON.stringify(state)));
  },
};

// Helper function to parse cookies from request
const parseCookies = (cookieHeader: string): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name && rest.length > 0) {
      cookies[name] = decodeURIComponent(rest.join("="));
    }
  });

  return cookies;
};

export const getReqToken = (req: Request) => {
  // First try to get token from Authorization header
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    return authHeader.split(" ")[1];
  }

  // If not found, try to get from cookie
  const cookieHeader = req.headers.get("Cookie");
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    return cookies["deco_page_auth"];
  }

  return undefined;
};

export interface AuthCallbackOptions {
  apiUrl?: string;
  appName: string;
}

export const handleAuthCallback = async (
  req: Request,
  options: AuthCallbackOptions,
): Promise<Response> => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }

  // Parse state to get the next URL
  let next = "/";
  if (state) {
    try {
      const parsedState = StateParser.parse(state);
      next = parsedState.next || "/";
    } catch {
      // ignore parse errors
    }
  }

  try {
    // Exchange code for token
    const apiUrl = options.apiUrl ?? "https://api.deco.chat";
    const exchangeResponse = await fetch(`${apiUrl}/apps/code-exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        client_id: options.appName,
      }),
    });

    if (!exchangeResponse.ok) {
      return new Response("Authentication failed", { status: 401 });
    }

    const { access_token } = (await exchangeResponse.json()) as {
      access_token: string;
    };

    if (!access_token) {
      return new Response("No access token received", { status: 401 });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: next,
        "Set-Cookie": `deco_page_auth=${access_token}; HttpOnly; Secure; SameSite=Lax; Path=/`,
      },
    });
  } catch (err) {
    return new Response(`Authentication failed ${err}`, { status: 500 });
  }
};
