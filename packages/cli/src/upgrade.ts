import { Confirm } from "@cliffy/prompt";
import { bold, green, red, yellow } from "@std/fmt/colors";
import * as semver from "@std/semver";
import denoJson from "../deno.json" with { type: "json" };

const getLatestVersion = async (): Promise<semver.SemVer> => {
  const signal = AbortSignal.timeout(2_000);

  const versions: { latest: string } = await fetch(
    `https://jsr.io/${denoJson.name}/meta.json`,
    { signal },
  )
    .then((resp) => resp.json() as Promise<{ latest: string }>)
    .catch(() => {
      return { latest: denoJson.version };
    });
  return semver.parse(versions.latest);
};

export const upgrade = async () => {
  console.log(yellow("Upgrading to the latest version..."));
  const deno = new Deno.Command("deno", {
    args: ["install", "-Ar", "-g", "-n", "deco", "jsr:@deco/cli", "-f"],
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();

  const status = await deno.status;
  if (status.success) {
    console.log(green("🎉 CLI updated successfully!"));
  } else {
    console.error(red("Failed to update the CLI."));
  }
};

export async function checkForUpdates() {
  if (Deno.env.get("DECO_CLI_UPDATE_CHECKED") || Deno.args.includes("update")) {
    return;
  }
  Deno.env.set("DECO_CLI_UPDATE_CHECKED", "true");

  try {
    const currentVersion = semver.parse(denoJson.version);
    const latestVersion = await getLatestVersion();

    if (semver.compare(latestVersion, currentVersion) === 1) {
      console.log();
      console.log(
        green(
          `A new version of deco is available: ${bold(
            `v${semver.format(latestVersion)}`,
          )}`,
        ),
      );
      console.log(
        yellow(`You are on version: v${semver.format(currentVersion)}`),
      );
      console.log();

      const upgradeConfirm = await Confirm.prompt({
        message: "Do you want to upgrade?",
        default: true,
      });

      if (upgradeConfirm) {
        await upgrade();
      }
    }
  } catch (_e) {
    // We can ignore this error since it's not critical.
  }
}
