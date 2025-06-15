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

export type WithTool<TAppContext extends AppContext = AppContext> =
  & Omit<TAppContext, "tool">
  & {
    tool: { name: string };
  };

export type WithResource<TAppContext extends AppContext = AppContext> =
  & Omit<TAppContext, "resource">
  & {
    resource: { name: string };
  };

export function assertHasWorkspace<TContext extends AppContext = AppContext>(
  c: Pick<TContext, "workspace"> | Pick<WithWorkspace<TContext>, "workspace">,
): asserts c is WithWorkspace<TContext> {
  if (!c.workspace) {
    throw new NotFoundError();
  }
}

export function assertPrincipalIsUser<TContext extends AppContext = AppContext>(
  c: Pick<TContext, "user"> | Pick<WithUser<TContext>, "user">,
): asserts c is WithUser<TContext> {
  if (!c.user || typeof c.user.id !== "string") {
    throw new NotFoundError();
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

export const assertWorkspaceResourceAccess = async (
  resource: string,
  c: AppContext,
): Promise<void> => {
  if (c.isLocal) {
    return c.resourceAccess.grant();
  }

  assertHasUser(c);
  assertHasWorkspace(c);

  const user = c.user;
  const { root, slug } = c.workspace;

  // agent tokens
  if ("aud" in user && user.aud === c.workspace.value) {
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
