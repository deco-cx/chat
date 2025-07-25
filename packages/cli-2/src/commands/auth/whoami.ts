import { readSession } from "../../lib/session.js";
import { createClient } from "../../lib/supabase.js";

export const whoamiCommand = async () => {
  try {
    const session = await readSession();
    if (!session || !session.access_token || !session.refresh_token) {
      console.log("❌  Not logged in. Run `deco login` to authenticate.\n");
      return;
    }

    const { client: supabase } = createClient();
    // Set the session so we can get the user
    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (setSessionError) {
      console.log("❌  Session expired or invalid. Please log in again.\n");
      return;
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      console.log(
        "❌  Could not retrieve user info. Please log in again.\n",
      );
      return;
    }
    const user = data.user;
    // Pretty print user info
    console.log("👤  User Info:");
    console.log(`   💻  ID:        ${user.id}`);
    console.log(`   📧  Email:     ${user.email ?? "-"}`);
    if (user.user_metadata?.full_name) {
      console.log(
        `   📚  Name:      ${user.user_metadata.full_name}`,
      );
    }
    if (user.user_metadata?.avatar_url) {
      console.log(
        `   🖼️  Avatar:    ${user.user_metadata.avatar_url}`,
      );
    }
    console.log("");
    if (session.workspace) {
      console.log(
        `🏢  Current Workspace: \u001b[1m${session.workspace}\u001b[0m\n`,
      );
    } else {
      console.log(
        "⚠️  No workspace selected.\n",
      );
    }
  } catch (err: unknown) {
    const message = typeof err === "object" && err && "message" in err
      ? (err as { message: string }).message
      : String(err);
    console.error("❌  Error reading session:", message);
  }
};