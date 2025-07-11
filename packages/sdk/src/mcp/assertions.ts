import type { Statement } from "../auth/policy.ts";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../errors.ts";
import type { Workspace } from "../path.ts";
import type { AppContext, UserPrincipal } from "./context.ts";

type WithUser<TAppContext extends AppContext = AppContext> =
  & Omit<TAppContext, "user">
  & {
    user: UserPrincipal;
  };

type WithWorkspace<TAppContext extends AppContext = AppContext> =
  & Omit<TAppContext, "workspace">
  & {
    workspace: { root: string; slug: string; value: Workspace };
  };

type WithKbFileProcessor<TAppContext extends AppContext = AppContext> =
  & Omit<TAppContext, "kbFileProcessor">
  & {
    kbFileProcessor: import("../queues/file-processor/batch-file-processor.ts").KbFileProcessorQueue;
  };

export type WithTool<TAppContext extends AppContext = AppContext> =
  & Omit<TAppContext, "tool">
  & {
    tool: { name: string };
  };

export function assertHasWorkspace<TContext extends AppContext = AppContext>(
  c: Pick<TContext, "workspace"> | Pick<WithWorkspace<TContext>, "workspace">,
): asserts c is WithWorkspace<TContext> {
  if (!c.workspace) {
    throw new NotFoundError("Workspace not found");
  }
}

export function assertPrincipalIsUser<TContext extends AppContext = AppContext>(
  c: Pick<TContext, "user"> | Pick<WithUser<TContext>, "user">,
): asserts c is WithUser<TContext> {
  if (!c.user || typeof c.user.id !== "string") {
    throw new NotFoundError("User not found");
  }
}

export const assertHasUser = (c: AppContext) => {
  if (c.isLocal) { // local calls
    return;
  }
  const user = c.user;

  if (!user) {
    throw new UnauthorizedError();
  }
};

const assertPoliciesIsStatementArray = (
  policies: unknown,
): policies is Statement[] => {
  return Array.isArray(policies) &&
    policies.every((p) =>
      typeof p === "object" && "effect" in p && "resource" in p
    );
};

export function assertsNotNull<T>(
  value: T | null | undefined,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error("Value is null or undefined");
  }
}

export const assertWorkspaceResourceAccess = async (
  resource: string,
  c: AppContext,
): Promise<void> => {
  if (c.isLocal || c.resourceAccess.granted()) {
    return c.resourceAccess.grant();
  }

  assertHasUser(c);
  assertHasWorkspace(c);

  const user = c.user;
  const { root, slug } = c.workspace;

  // agent tokens
  if ("aud" in user && user.aud === c.workspace.value) {
    // API keys
    const [sub, id] = user.sub?.split(":") ?? [];
    if (sub === "api-key") {
      const { data, error } = await c.db.from("deco_chat_api_keys").select("*")
        .eq("id", id)
        .eq("enabled", true)
        .maybeSingle();
      if (error) {
        throw new ForbiddenError(error.message);
      }
      if (!data) {
        throw new ForbiddenError(
          `Cannot access ${resource} in workspace ${c.workspace.value}`,
        );
      }

      // scopes should be a space-separated list of resourcesAdd commentMore actions
      if (
        assertPoliciesIsStatementArray(data.policies) &&
        !(await c.authorization.canAccess(
          [{ statements: data.policies ?? [] }],
          slug,
          resource,
        ))
      ) {
        throw new ForbiddenError(
          `Cannot access ${resource} in workspace ${c.workspace.value}`,
        );
      }
    }

    return c.resourceAccess.grant();
  }

  if (root === "users" && user.id === slug) {
    return c.resourceAccess.grant();
  }

  if (root === "shared") {
    const canAccess = await c.authorization.canAccess(
      user.id as string,
      slug,
      resource,
    );

    if (canAccess) {
      return c.resourceAccess.grant();
    }
  }

  throw new ForbiddenError(
    `Cannot access ${resource} in workspace ${c.workspace.value}`,
  );
};

export const assertTeamResourceAccess = async (
  resource: string,
  teamIdOrSlug: string | number,
  c: AppContext,
): Promise<void> => {
  if (c.isLocal) {
    return c.resourceAccess.grant();
  }
  assertHasUser(c);
  const user = c.user;
  if ("id" in user && typeof user.id === "string") {
    const canAccess = await c.authorization.canAccess(
      user.id,
      teamIdOrSlug,
      resource,
    );

    if (canAccess) {
      return c.resourceAccess.grant();
    }
  }

  throw new ForbiddenError(
    `Cannot access ${resource} in team ${teamIdOrSlug}`,
  );
};

export function assertKbFileProcessor(
  c: AppContext,
): asserts c is WithKbFileProcessor<AppContext> {
  if (!c.kbFileProcessor) {
    throw new ForbiddenError("KbFileProcessor not found");
  }
}
