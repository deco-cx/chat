import type { Provider } from "@supabase/supabase-js";
import { AUTH_PORT_CLI, DECO_CHAT_LOGIN } from "./constants.ts";
import { saveSession } from "./session.ts";
import { createClient } from "./supabase.ts";

export const loginCommand = async () => {
  const done = Promise.withResolvers<void>();

  // start callback server
  const server = Deno.serve(
    {
      port: AUTH_PORT_CLI,
      onListen: () => {
        const browser =
          Deno.env.get("BROWSER") ??
          {
            linux: "xdg-open",
            solaris: "xdg-open",
            illumos: "xdg-open",
            android: "xdg-open",
            freebsd: "xdg-open",
            netbsd: "xdg-open",
            windows: "start",
            darwin: "open",
            aix: "open",
          }[Deno.build.os] ??
          "open";

        const command = new Deno.Command(browser, { args: [DECO_CHAT_LOGIN] });
        command.spawn();
      },
    },
    async (req) => {
      const url = new URL(req.url);

      const { client, responseHeaders } = createClient(req.headers);

      if (url.pathname === "/login/oauth") {
        const credentials = {
          provider: (url.searchParams.get("provider") ?? "google") as Provider,
          options: { redirectTo: new URL("/auth/callback/oauth", url).href },
        };

        const { data } = await client.auth.signInWithOAuth(credentials);

        if (data.url) {
          responseHeaders.set("location", data.url);
          return new Response(null, { status: 302, headers: responseHeaders });
        }

        return new Response("Error redirecting to OAuth provider", {
          status: 500,
        });
      }

      if (url.pathname === "/auth/callback/oauth") {
        const code = url.searchParams.get("code");

        if (!code) {
          return new Response("No code found", { status: 400 });
        }

        const { data, error } = await client.auth.exchangeCodeForSession(code);

        if (error || !data?.session) {
          return new Response(error?.message ?? "Unknown error", {
            status: 400,
          });
        }

        // Save session data securely
        try {
          await saveSession(data);
        } catch (e) {
          console.error("Failed to save session data:", e);
        }

        done.resolve();

        return new Response(
          `<!DOCTYPE html>
        <html>
          <head>
            <title>Authentication Complete</title>
          </head>
          <body>
            <h1>Authentication Complete</h1>
            <p>You can close this window now.</p>
            <script>
              window.close();
            </script>
          </body>
        </html>`,
          { headers: { "content-type": "text/html" } },
        );
      }

      return new Response("Not found", { status: 404 });
    },
  );

  await done.promise;
  await server.shutdown();
};
