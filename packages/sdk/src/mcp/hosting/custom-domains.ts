import { resolveCname } from "node:dns";
import { UserInputError } from "../../errors.ts";
import type { AppContext } from "../context.ts";
import { HOSTING_APPS_DOMAIN } from "./api.ts";

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
  const targetAddress = `${scriptSlug}${HOSTING_APPS_DOMAIN}`;
  if (
    !addresses.some(
      (addr) => addr === targetAddress || addr === `${targetAddress}.`,
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
      deco_chat_hosting_apps!inner(slug, workspace)
    `)
    .eq("route_pattern", domain)
    .maybeSingle();

  if (error) {
    throw new UserInputError(error.message);
  }

  if (data) {
    // Check if the domain belongs to the same app slug and workspace
    const hostingApp = data.deco_chat_hosting_apps;
    if (
      hostingApp &&
      hostingApp.slug === slug &&
      hostingApp.workspace === c.workspace?.value
    ) {
      // Domain is already allocated to the same script, so skip the check
      return;
    }

    throw new UserInputError(`The domain ${domain} is already in use`);
  }
};
