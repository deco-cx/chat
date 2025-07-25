import { resolveCname } from "node:dns";
import { UserInputError } from "../../errors.ts";
import type { AppContext } from "../context.ts";
import { Entrypoint } from "./api.ts";

export const assertsDomainOwnership = async (
  domain: string,
  scriptSlug: string,
) => {
  const resolvePromise = Promise.withResolvers<string[]>();
  resolveCname(domain, (err, addrs) => {
    if (err) {
      resolvePromise.reject(err);
    } else {
      resolvePromise.resolve(addrs);
    }
  });
  const addresses = await resolvePromise.promise;
  const targetAddress = Entrypoint.host(scriptSlug);
  if (
    !addresses.some((addr: string) =>
      addr === targetAddress || addr === `${targetAddress}.`
    )
  ) {
    throw new UserInputError(
      `The domain ${domain} does not point to the script ${targetAddress}`,
    );
  }
};

export const assertsDomainUniqueness = async (
  c: AppContext,
  domain: string,
  slug: string,
) => {
  const { data, error } = await c.db
    .from("deco_chat_hosting_routes")
    .select(`
      *,
      deco_chat_hosting_apps_deployments!deployment_id(
        id,
        deco_chat_hosting_apps!hosting_app_id(slug, workspace)
      )
    `)
    .eq("route_pattern", domain)
    .maybeSingle();

  if (error) {
    throw new UserInputError(error.message);
  }

  if (data) {
    // Check if the domain belongs to the same app slug and workspace
    const deployment = data.deco_chat_hosting_apps_deployments;
    const hostingApp = deployment?.deco_chat_hosting_apps;
    if (
      hostingApp && hostingApp.slug === slug &&
      hostingApp.workspace === c.workspace?.value
    ) {
      // Domain is already allocated to the same script, so skip the check
      return;
    }

    throw new UserInputError(
      `The domain ${domain} is already in use`,
    );
  }
};
