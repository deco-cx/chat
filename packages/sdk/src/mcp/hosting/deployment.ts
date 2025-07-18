import crypto from "node:crypto";
import { WorkersMCPBindings } from "@deco/workers-runtime";
import { assertHasWorkspace } from "../assertions.ts";
import { type AppContext, getEnv } from "../context.ts";
import { getMimeType } from "./api.ts";
import { assertsDomainOwnership } from "./custom-domains.ts";
import { polyfill } from "./fs-polyfill.ts";
import { isDoBinding, migrationDiff } from "./migrations.ts";
import type { WranglerConfig } from "./wrangler.ts";

const METADATA_FILE_NAME = "metadata.json";
// Common types and utilities
export type DeployResult = {
  etag?: string;
  id?: string;
};
const CUSTOM_HOSTNAME_POST_BODY = {
  ssl: {
    bundle_method: "ubiquitous" as const,
    method: "http" as const,
    type: "dv" as const,
    settings: {
      ciphers: ["ECDHE-RSA-AES128-GCM-SHA256", "AES128-SHA"],
      early_hints: "on" as const,
      http2: "on" as const,
      min_tls_version: "1.2" as const,
      tls_1_3: "on" as const,
    },
    wildcard: false as const,
  },
};
export interface Polyfill {
  fileName: string;
  aliases: string[];
  content: string;
}

const addPolyfills = (
  files: Record<string, File>,
  metadata: Record<string, unknown>,
  polyfills: Polyfill[],
) => {
  const aliases: Record<string, string> = {};
  metadata.alias = aliases;

  for (const polyfill of polyfills) {
    const filePath = `${polyfill.fileName}.mjs`;
    files[filePath] ??= new File([polyfill.content], filePath, {
      type: "application/javascript+module",
    });

    for (const alias of polyfill.aliases) {
      aliases[alias] = `./${polyfill.fileName}`;
    }
  }
};

interface FileMetadata {
  hash: string;
  size: number;
}

function calculateFileHash(base64Content: string): FileMetadata {
  const fileBuffer = new TextEncoder().encode(base64Content);
  const hash = crypto.createHash("sha256");
  hash.update(fileBuffer);
  const fileHash = hash.digest("hex").slice(0, 32); // Grab the first 32 characters
  const fileSize = fileBuffer.length;
  return { hash: fileHash, size: fileSize };
}

function createAssetsManifest(
  assets: Record<string, string>,
): Record<string, FileMetadata> {
  return Object.fromEntries(
    Object.entries(assets).map(([path, content]) => [
      path,
      calculateFileHash(content),
    ]),
  );
}

function findMatch(
  fileHash: string,
  fileMetadata: Record<string, FileMetadata>,
): string {
  for (const prop in fileMetadata) {
    const file = fileMetadata[prop] as FileMetadata;
    if (file.hash === fileHash) {
      return prop;
    }
  }
  throw new Error("unknown fileHash");
}

const handleAssetUpload = async ({
  c,
  jwt,
  fileHashes,
  manifest,
  files,
}: {
  c: AppContext;
  jwt: string;
  fileHashes: string[][];
  manifest: Record<string, FileMetadata>;
  files: Record<string, string>;
}): Promise<string | null> => {
  const form = new FormData();

  let finalJwt: string | null = null;
  for (const bucket of fileHashes) {
    bucket.forEach((fileHash) => {
      const fullPath = findMatch(fileHash, manifest);
      const base64Data = files[fullPath];

      const mimeType = getMimeType(fullPath);

      form.append(
        fileHash,
        new File([base64Data], fileHash, {
          type:
            mimeType === "application/javascript+module"
              ? "application/javascript"
              : mimeType,
        }),
        fileHash,
      );
    });

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${c.envVars.CF_ACCOUNT_ID}/workers/assets/upload?base64=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        body: form,
      },
    );

    const data = (await response.json()) as {
      result: {
        jwt: string;
      };
    };

    if (data.result.jwt) {
      finalJwt = data.result.jwt;
    }
  }

  return finalJwt;
};

const uploadWranglerAssets = async ({
  c,
  assets,
  scriptSlug,
}: {
  c: AppContext;
  assets: Record<string, string>;
  scriptSlug: string;
}) => {
  const assetsManifest = createAssetsManifest(assets);

  const assetUploadSession =
    await c.cf.workersForPlatforms.dispatch.namespaces.scripts.assetUpload.create(
      c.envVars.CF_DISPATCH_NAMESPACE,
      scriptSlug,
      {
        account_id: c.envVars.CF_ACCOUNT_ID,
        manifest: assetsManifest,
      },
    );

  if (!assetUploadSession.buckets || assetUploadSession.buckets.length === 0) {
    return;
  }

  if (!assetUploadSession.jwt) {
    throw new Error("No buckets found in asset upload session");
  }

  const jwt = await handleAssetUpload({
    c,
    jwt: assetUploadSession.jwt,
    fileHashes: assetUploadSession.buckets,
    manifest: assetsManifest,
    files: assets,
  });

  return jwt;
};

export async function deployToCloudflare({
  c,
  mainModule,
  bundledCode,
  assets,
  _envVars,
  wranglerConfig: {
    name: scriptSlug,
    compatibility_flags,
    compatibility_date,
    vars,
    kv_namespaces,
    hyperdrive,
    deco,
    ai,
    browser,
    durable_objects,
    queues,
    workflows,
    routes,
    triggers,
    d1_databases,
    migrations,
    assets: wranglerAssetsConfig,
  },
}: {
  c: AppContext;
  wranglerConfig: WranglerConfig;
  mainModule: string;
  bundledCode: Record<string, File>;
  assets: Record<string, string>;
  _envVars?: Record<string, string>;
}): Promise<DeployResult> {
  assertHasWorkspace(c);
  const env = getEnv(c);
  const envVars = {
    ..._envVars,
    ...vars,
  };
  const zoneId = env.CF_ZONE_ID;
  if (!zoneId) {
    throw new Error("CF_ZONE_ID is not set");
  }

  await Promise.all(
    (routes ?? []).map(
      (route) =>
        route.custom_domain &&
        assertsDomainOwnership(route.pattern, scriptSlug).then(() => {
          if (!env.CF_ZONE_ID) {
            return;
          }
          return c.cf.customHostnames
            .create({
              hostname: route.pattern,
              zone_id: zoneId,
              ...CUSTOM_HOSTNAME_POST_BODY,
            })
            .catch((err) => {
              if (err.status === 409) {
                // fine, domain already exists
                return;
              }
              throw err;
            });
        }),
    ),
  );

  const decoBindings = deco?.bindings ?? [];
  if (decoBindings.length > 0) {
    envVars["DECO_CHAT_BINDINGS"] = WorkersMCPBindings.stringify(decoBindings);
  }

  const { bindings } =
    await c.cf.workersForPlatforms.dispatch.namespaces.scripts.settings
      .get(env.CF_DISPATCH_NAMESPACE, scriptSlug, {
        account_id: env.CF_ACCOUNT_ID,
      })
      .catch(() => ({
        bindings: [],
      }));

  const doMigrations = migrationDiff(
    migrations ?? [],
    (bindings ?? []).filter(isDoBinding),
  );

  const wranglerBindings = [
    ...(durable_objects?.bindings?.map((binding) => ({
      type: "durable_object_namespace" as const,
      name: binding.name,
      class_name: binding.class_name,
    })) ?? []),
    ...(kv_namespaces?.map((kv) => ({
      type: "kv_namespace" as const,
      name: kv.binding,
      namespace_id: kv.id,
    })) ?? []),
    ...(ai ? [{ type: "ai" as const, name: ai.binding }] : []),
    ...(browser ? [{ type: "browser" as const, name: browser.binding }] : []),
    ...(queues?.producers?.map((producer) => ({
      type: "queue" as const,
      queue_name: producer.queue,
      name: producer.binding,
    })) ?? []),
    ...(workflows?.map((workflow) => ({
      type: "workflow" as const,
      name: workflow.binding,
      workflow_name: workflow.name,
      class_name: workflow.class_name,
      script_name: workflow.script_name,
    })) ?? []),
    ...(d1_databases?.map((d1) => ({
      type: "d1" as const,
      name: d1.binding,
      id: d1.database_id!,
    })) ?? []),
    ...(hyperdrive?.map((hd) => ({
      type: "hyperdrive" as const,
      name: hd.binding,
      id: hd.id,
      localConnectionString: hd.localConnectionString,
    })) ?? []),
  ];

  let assetsMetadata: Pick<WranglerConfig, "assets" | "keep_assets"> = {
    assets: wranglerAssetsConfig,
  };

  if (Object.keys(assets).length > 0) {
    const jwt = await uploadWranglerAssets({
      c,
      assets,
      scriptSlug,
    });

    if (!jwt) {
      assetsMetadata = {
        assets: wranglerAssetsConfig,
        keep_assets: true,
      };
    } else {
      assetsMetadata = {
        assets: {
          ...wranglerAssetsConfig,
          jwt,
        },
      };
    }
  }

  const metadata = {
    main_module: mainModule,
    compatibility_flags: compatibility_flags ?? ["nodejs_compat"],
    compatibility_date: compatibility_date ?? "2024-11-27",
    tags: [c.workspace.value],
    bindings: wranglerBindings,
    triggers,
    observability: {
      enabled: true,
    },
    migrations: doMigrations,
    ...assetsMetadata,
  };

  addPolyfills(bundledCode, metadata, [polyfill]);

  const body = {
    metadata: new File([JSON.stringify(metadata)], METADATA_FILE_NAME, {
      type: "application/json",
    }),
    ...bundledCode,
  };

  const result =
    await c.cf.workersForPlatforms.dispatch.namespaces.scripts.update(
      env.CF_DISPATCH_NAMESPACE,
      scriptSlug,
      {
        account_id: env.CF_ACCOUNT_ID,
        metadata,
      },
      {
        method: "put",
        body,
      },
    );

  if (envVars) {
    const promises = [];
    for (const [key, value] of Object.entries(envVars)) {
      promises.push(
        c.cf.workersForPlatforms.dispatch.namespaces.scripts.secrets.update(
          env.CF_DISPATCH_NAMESPACE,
          scriptSlug,
          {
            account_id: env.CF_ACCOUNT_ID,
            name: key,
            text: value,
            type: "secret_text",
          },
        ),
      );
    }
    await Promise.all(promises);
  }
  return {
    etag: result.etag,
    id: result.id,
  };
}
