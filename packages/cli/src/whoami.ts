import { readSession } from "./session.ts";
import { createClient } from "./supabase.ts";

export const whoamiCommand = async () => {
  try {
    const session = await readSession();
    if (!session || !session.access_token || !session.refresh_token) {
      console.log("\u274C  Not logged in. Run `deco login` to authenticate.\n");
      return;
    }

    const { client: supabase } = createClient();
    // Set the session so we can get the user
    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (setSessionError) {
      console.log("\u274C  Session expired or invalid. Please log in again.\n");
      return;
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      console.log(
        "\u274C  Could not retrieve user info. Please log in again.\n",
      );
      return;
    }
    const user = data.user;
    // Pretty print user info
    console.log("\uD83D\uDC64  User Info:");
    console.log(`   \uD83D\uDCBB  ID:        ${user.id}`);
    console.log(`   \uD83D\uDCE7  Email:     ${user.email ?? "-"}`);
    if (user.user_metadata?.full_name) {
      console.log(
        `   \uD83D\uDCDA  Name:      ${user.user_metadata.full_name}`,
      );
    }
    if (user.user_metadata?.avatar_url) {
      console.log(
        `   \uD83D\uDDBC️  Avatar:    ${user.user_metadata.avatar_url}`,
      );
    }
    console.log("");
    if (session.workspace) {
      console.log(
        `\uD83C\uDFE2  Current Workspace: \u001b[1m${session.workspace}\u001b[0m\n`,
      );
    } else {
      console.log("\u26A0\uFE0F  No workspace selected.\n");
    }
  } catch (err: unknown) {
    const message =
      typeof err === "object" && err && "message" in err
        ? (err as { message: string }).message
        : String(err);
    console.error("\u274C  Error reading session:", message);
  }
};
