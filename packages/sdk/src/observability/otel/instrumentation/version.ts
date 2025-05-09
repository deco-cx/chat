import { isVersionMetadata } from "./env.ts";

export function versionAttributes(
  env: unknown,
): Record<string, string | undefined> {
  const attributes = {} as Record<string, string | undefined>;

  if (typeof env === "object" && env !== null) {
    for (const [binding, data] of Object.entries(env)) {
      if (isVersionMetadata(data)) {
        attributes["cf.workers_version_metadata.binding"] = binding;
        attributes["cf.workers_version_metadata.id"] = data.id;
        attributes["cf.workers_version_metadata.tag"] = data.tag;
        // Version metadata bindings are identical, so we can stop after the first one found
        break;
      }
    }
  }

  return attributes;
}
