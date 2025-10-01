import { createServer, IncomingMessage, ServerResponse } from "http";
import { URL } from "url";
import { spawn } from "child_process";
import type { Provider } from "@supabase/supabase-js";
import { AUTH_PORT_CLI, DECO_CMS_LOGIN_URL } from "../../lib/constants.js";
import { saveSession } from "../../lib/session.js";
import { createClient } from "../../lib/supabase.js";
import process from "node:process";

export const loginCommand = () => {
  return new Promise<void>((resolve, reject) => {
    let timeout: NodeJS.Timeout;
    const server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url!, `http://localhost:${AUTH_PORT_CLI}`);

        // Convert IncomingMessage headers to Headers object
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value) {
            headers.set(key, Array.isArray(value) ? value.join(", ") : value);
          }
        }

        const { client, responseHeaders } = createClient(headers);

        if (url.pathname === "/login/oauth") {
          const credentials = {
            provider: (url.searchParams.get("provider") ??
              "google") as Provider,
            options: { redirectTo: new URL("/auth/callback/oauth", url).href },
          };

          const { data } = await client.auth.signInWithOAuth(credentials);

          if (data.url) {
            // Convert Headers to plain object
            const responseHeadersObj: Record<string, string> = {};
            responseHeaders.forEach((value, key) => {
              responseHeadersObj[key] = value;
            });

            res.writeHead(302, {
              Location: data.url,
              ...responseHeadersObj,
            });
            res.end();
            return;
          }

          res.writeHead(500);
          res.end("Error redirecting to OAuth provider");
          return;
        }

        if (url.pathname === "/auth/callback/oauth") {
          const code = url.searchParams.get("code");

          if (!code) {
            res.writeHead(400);
            res.end("No code found");
            return;
          }

          const { data, error } = await client.auth.exchangeCodeForSession(
            code,
          );

          if (error || !data?.session) {
            res.writeHead(400);
            res.end(error?.message ?? "Unknown error");
            return;
          }

          // Save session data securely
          try {
            await saveSession(data);
          } catch (e) {
            console.error("Failed to save session data:", e);
          }

          // Clear the timeout since login was successful
          if (timeout) {
            clearTimeout(timeout);
          }

          const html = await fetch(
            "https://admin.decocms.com/local-login-success.html",
          ).then((res) => res.text());
          res.writeHead(200, {
            "Content-Type": "text/html",
          });
          res.end(html);

          // Close server after successful authentication
          server.close(() => resolve());
          return;
        }

        res.writeHead(404);
        res.end("Not found");
      },
    );

    server.listen(AUTH_PORT_CLI, () => {
      // Try to open browser with OS-appropriate command
      const browserCommands: Record<string, string> = {
        linux: "xdg-open",
        darwin: "open",
        win32: "start",
        freebsd: "xdg-open",
        openbsd: "xdg-open",
        sunos: "xdg-open",
        aix: "open",
      };

      const browser = process.env.BROWSER ??
        browserCommands[process.platform] ?? "open";

      console.log("🔐 Starting authentication process...");
      console.log("Opening browser for login...\n");

      // Windows requires using cmd.exe because 'start' is a built-in command
      const command = process.platform === "win32" && browser === "start"
        ? spawn("cmd", ["/c", "start", DECO_CMS_LOGIN_URL], {
          detached: true,
        })
        : spawn(browser, [DECO_CMS_LOGIN_URL], { detached: true });

      command.unref(); // Don't keep process alive

      // Handle potential browser opening failures
      command.on("error", () => {
        console.log("⚠️  Could not automatically open browser");
      });

      // Always show the fallback URL
      timeout = setTimeout(() => {
        console.log(
          "📋 If your browser didn't open automatically, please click the following link:",
        );
        console.log(`\n   ${DECO_CMS_LOGIN_URL}\n`);
        console.log("Waiting for authentication to complete...\n");
      }, 1000); // Small delay to let browser opening attempt complete
    });

    server.on("error", (err) => {
      reject(err);
    });
  });
};
