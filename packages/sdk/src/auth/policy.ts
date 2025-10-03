import type { Client, Json } from "@deco/sdk/storage";
import { WebCache } from "../cache/index.ts";
import type { UserPrincipal } from "../mcp/index.ts";
import { z } from "zod/v3";

// Cache duration in seconds (WebCache expects seconds)
const TWO_MIN_TTL = 60 * 2;

// Base roles
export const BASE_ROLES_ID = {
  OWNER: 1,
  PUBLISHER: 2,
  COLLABORATOR: 3,
  ADMIN: 4,
  PUBLIC: 115,
  PRIVATE: 116,
};

// Roles that should not be displayed in the UI
const BLOCKED_ROLES = new Set([
  BASE_ROLES_ID.PUBLISHER,
  BASE_ROLES_ID.PUBLIC,
  BASE_ROLES_ID.PRIVATE,
]);

const IsIntegrationSchema = z.object({
  resource: z.literal("is_integration"),
  integrationId: z.string(),
});

export const MatchConditionsSchema = z.discriminatedUnion("resource", [
  IsIntegrationSchema,
]);

export const StatementSchema = z.object({
  effect: z.enum(["allow", "deny"]),
  resource: z.string(),
  matchCondition: MatchConditionsSchema.optional(),
});

// Typed interfaces
export type Statement = z.infer<typeof StatementSchema>;

export interface Policy {
  id: number;
  name: string;
  team_id: number | null;
  statements: Statement[];
}

export interface Role {
  id: number;
  name: string;
  description?: string | null;
  team_id: number | null;
  statements?: Statement[] | null;
}

export interface RoleWithPolicies extends Role {
  policies: Policy[];
}

export interface MemberRole {
  member_id: number;
  role_id: number;
  name: string;
  role?: Role;
}

export const RoleUpdateAction = z.enum(["grant", "revoke"]);

export interface RoleUpdateParams {
  roleId: number;
  action: z.infer<typeof RoleUpdateAction>;
}

/**
 * PolicyClient - Singleton class for managing policy access
 */
export class PolicyClient {
  private static instance: PolicyClient | null = null;
  private db: Client | null = null;
  private userPolicyCache: WebCache<Statement[]>;
  private userRolesCache: WebCache<MemberRole[]>;
  private teamRolesCache: WebCache<Role[]>;
  private teamSlugCache: WebCache<number>;

  private constructor() {
    // Initialize caches
    this.userPolicyCache = new WebCache<Statement[]>(
      "user-policies",
      TWO_MIN_TTL,
    );
    this.userRolesCache = new WebCache<MemberRole[]>("user-roles", TWO_MIN_TTL);
    this.teamRolesCache = new WebCache<Role[]>("team-role", TWO_MIN_TTL);
    this.teamSlugCache = new WebCache<number>("team-slug", TWO_MIN_TTL);
  }

  /**
   * Get singleton instance of PolicyClient
   */
  public static getInstance(db: Client): PolicyClient {
    if (!PolicyClient.instance) {
      PolicyClient.instance = new PolicyClient();
    }
    PolicyClient.instance.db = db;
    return PolicyClient.instance;
  }

  public async getUserRoles(
    userId: string,
    teamIdOrSlug: number | string,
  ): Promise<MemberRole[]> {
    this.assertDb(this.db);

    const teamId =
      typeof teamIdOrSlug === "number"
        ? teamIdOrSlug
        : await this.getTeamIdBySlug(teamIdOrSlug);

    const cacheKey = this.getUserRolesCacheKey(userId, teamId);

    const cachedRoles = await this.userRolesCache.get(cacheKey);
    if (cachedRoles) {
      return cachedRoles;
    }

    const { data } = await this.db
      .from("members")
      .select(`
        id,
        member_roles(
          role_id,
          roles(
            id,
            name,
            statements
          )
        )
      `)
      .eq("user_id", userId)
      .eq("team_id", teamId)
      .single();

    if (!data?.member_roles) {
      return [];
    }

    const roles: MemberRole[] = data.member_roles.map(
      (mr: { role_id: number; roles: { id: number; name: string } }) => ({
        member_id: data.id,
        role_id: mr.role_id,
        name: mr.roles.name,
        role: {
          ...mr.roles,
          team_id: teamId,
        },
      }),
    );

    // Cache the result
    await this.userRolesCache.set(cacheKey, roles);

    return roles;
  }

  /**
   * Get all policies for a user in a specific team
   * Only gets policies from member_roles -> roles -> policies chain
   */
  public async getUserStatements(
    userId: string,
    teamIdOrSlug: number | string,
  ): Promise<Statement[]> {
    this.assertDb(this.db);

    const teamId =
      typeof teamIdOrSlug === "number"
        ? teamIdOrSlug
        : await this.getTeamIdBySlug(teamIdOrSlug);

    if (teamId === undefined) {
      throw new Error(`Team with slug "${teamIdOrSlug}" not found`);
    }

    const cacheKey = this.getUserPoliceCacheKey(userId, teamId);

    // Try to get from cache first
    const [cachedPolicies, userRoles] = await Promise.all([
      this.userPolicyCache.get(cacheKey),
      this.getUserRoles(userId, teamId),
    ]);
    const userRolesStatements = userRoles
      .map((r) => r.role?.statements)
      .filter((s): s is Statement[] => !!s)
      .flat();

    if (cachedPolicies) {
      return [...cachedPolicies, ...userRolesStatements];
    }

    // Fetch roles for the user and get inline statements from roles
    const { data, error } = await this.db
      .from("member_roles")
      .select(`
            members!inner(team_id, user_id),
            roles (
              role_policies (
                policies (
                  statements
                )
              )
            )
          `)
      .eq("members.team_id", teamId)
      .eq("members.user_id", userId);

    if (error || !data) {
      return [];
    }

    const policiesStatements = this.filterValidStatements(
      data
        .map((mr) =>
          mr.roles.role_policies.map((p) => p.policies.statements).flat(),
        )
        .flat() as unknown as Statement[],
    );
    // Cache the result
    await this.userPolicyCache.set(cacheKey, policiesStatements);

    return [...policiesStatements, ...userRolesStatements];
  }

  public async removeAllMemberPoliciesAtTeam({
    teamId,
    memberId,
  }: {
    teamId: number;
    memberId: number;
  }) {
    this.assertDb(this.db);

    // Get member's user_id for cache invalidation
    const { data: member } = await this.db
      .from("members")
      .select("user_id")
      .eq("id", memberId)
      .single();

    // Invalidate caches if we have the user_id
    if (member?.user_id) {
      await Promise.all([
        this.userPolicyCache.delete(
          this.getUserPoliceCacheKey(member.user_id, teamId),
        ),
        this.userRolesCache.delete(
          this.getUserRolesCacheKey(member.user_id, teamId),
        ),
      ]);
    }

    const { error } = await this.db
      .from("member_roles")
      .delete()
      .eq("member_id", memberId);

    if (error) throw error;

    return true;
  }

  /**
   * Get all roles for a team
   */
  public async getTeamRoles(teamId: number): Promise<Role[]> {
    this.assertDb(this.db);

    // Try to get from cache first
    const cachedRoles = await this.teamRolesCache.get(
      this.getTeamRolesCacheKey(teamId),
    );
    if (cachedRoles) {
      return cachedRoles;
    }

    const { data: roles, error } = await this.db
      .from("roles")
      .select(`
        id,
        name,
        description,
        team_id
      `)
      .or(`team_id.eq.${teamId},team_id.is.null`);

    if (error || !roles) {
      return [];
    }

    // Cache the result
    await this.teamRolesCache.set(
      this.getTeamRolesCacheKey(teamId),
      this.filterTeamRoles(roles),
    );

    return roles;
  }

  /**
   * Update a user's role in a team
   */
  public async updateUserRole(
    teamId: number,
    email: string,
    params: RoleUpdateParams,
  ): Promise<Role | null> {
    this.assertDb(this.db);

    const [{ data: memberWithProfile }, roles] = await Promise.all([
      this.db
        .from("members")
        .select("id, profiles!inner(email, user_id)")
        .eq("team_id", teamId)
        .eq("profiles.email", email)
        .single(),
      this.getTeamRoles(teamId),
    ]);

    const profile = memberWithProfile?.profiles;
    const role = roles.find((r) => r.id === params.roleId);

    if (!profile) {
      throw new Error("User not found");
    }

    if (!memberWithProfile) {
      throw new Error("Member not found");
    }

    if (!role) {
      throw new Error("Role not found");
    }

    // Special handling for the owner role
    if (params.roleId === BASE_ROLES_ID.OWNER) {
      if (params.action === "revoke") {
        // Check if this would remove the last owner
        const { count } = await await this.db
          .from("members")
          .select(
            `
          id,
          team_id,
          member_roles!inner(
            role_id
          )
        `,
            { count: "exact" },
          )
          .eq("team_id", teamId)
          .eq("member_roles.role_id", BASE_ROLES_ID.OWNER);

        if (count === 1) {
          throw new Error("Cannot remove the last owner of the team");
        }
      }
    }

    // Invalidate all caches for this user
    await this.deleteUserRolesCache(teamId, [profile.user_id]);

    // Update the role assignment
    if (params.action === "grant") {
      // Add role to member
      await this.db.from("member_roles").upsert({
        member_id: memberWithProfile.id,
        role_id: params.roleId,
      });
    } else {
      // Remove role from member
      await this.db
        .from("member_roles")
        .delete()
        .eq("member_id", memberWithProfile.id)
        .eq("role_id", params.roleId);
    }

    return role;
  }

  async createRole(
    teamIdOrSlug: string | number,
    role: Partial<Role> & Pick<Role, "name">,
    statements?: Statement[],
  ) {
    this.assertDb(this.db);
    const teamId = await this.getTeamIdByIdOrSlug(teamIdOrSlug);

    const { data } = await this.db
      .from("roles")
      .insert({
        ...role,
        team_id: teamId,
        statements:
          statements?.length === 0 ? null : (statements as unknown as Json[]),
      })
      .select()
      .single();
    if (!data) {
      throw new Error("Failed to create role");
    }
    await this.teamRolesCache.delete(this.getTeamRolesCacheKey(teamId));

    return data;
  }

  async updateRole(
    teamIdOrSlug: string | number,
    role: Partial<Role> & Pick<Role, "id">,
    statements?: Statement[],
  ) {
    this.assertDb(this.db);
    const teamId = await this.getTeamIdByIdOrSlug(teamIdOrSlug);

    // check if role.team_id
    const { data, error } = await this.db
      .from("roles")
      .update({
        ...role,
        team_id: teamId,
        statements:
          statements?.length === 0 ? null : (statements as unknown as Json[]),
      })
      .eq("id", role.id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    await this.teamRolesCache.delete(this.getTeamRolesCacheKey(teamId));

    return data;
  }

  async deleteRole(teamIdOrSlug: string | number, roleId: number) {
    this.assertDb(this.db);
    const teamId = await this.getTeamIdByIdOrSlug(teamIdOrSlug);

    // Only allow deletion of team-specific roles (not system roles)
    const { data: role } = await this.db
      .from("roles")
      .select("id, team_id")
      .eq("id", roleId)
      .eq("team_id", teamId)
      .single();

    if (!role || role.team_id === null || role.team_id !== teamId) {
      throw new Error("Role not found");
    }

    // delete all member_roles
    const { data: memberIds } = await this.db
      .from("member_roles")
      .delete()
      .eq("role_id", role.id)
      .select("member_id");
    // remove cache for all users
    if (memberIds) {
      const { data: _members } = await this.db
        .from("members")
        .select("user_id")
        .in(
          "id",
          memberIds.map((m) => m.member_id),
        );
      const members =
        _members?.filter((m): m is { user_id: string } => m.user_id !== null) ??
        [];
      await this.deleteUserRolesCache(
        teamId,
        members.map((m) => m.user_id),
      );
    }

    // Delete the role
    const { data, error } = await this.db
      .from("roles")
      .delete()
      .eq("id", role.id)
      .eq("team_id", teamId)
      .select();

    if (error) {
      throw error;
    }

    await this.teamRolesCache.delete(this.getTeamRolesCacheKey(teamId));
    return data;
  }

  async getRoleWithPolicies(
    teamIdOrSlug: string | number,
    roleId: number,
  ): Promise<RoleWithPolicies | null> {
    this.assertDb(this.db);
    const teamId = await this.getTeamIdByIdOrSlug(teamIdOrSlug);

    const { data } = await this.db
      .from("roles")
      .select(`
        id,
        name,
        description,
        team_id,
        statements,
        role_policies (
          policies (
            id,
            name,
            team_id,
            statements
          )
        )
      `)
      .eq("id", roleId)
      .or(`team_id.eq.${teamId},team_id.is.null`)
      .single();

    if (!data) {
      return null;
    }

    const policies: Policy[] = data.role_policies.map((rp) => ({
      ...rp.policies,
      statements: this.filterValidStatements(
        rp.policies.statements as unknown as Statement[],
      ),
    }));

    const roleStatementsAsPolicies: Policy | null = data.statements
      ? {
          id: data.id,
          name: data.name,
          team_id: data.team_id,
          statements: this.filterValidStatements(
            data.statements as unknown as Statement[],
          ),
        }
      : null;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      team_id: data.team_id,
      policies: roleStatementsAsPolicies
        ? [...policies, roleStatementsAsPolicies]
        : policies,
    };
  }

  private async getTeamIdByIdOrSlug(teamIdOrSlug: string | number) {
    return typeof teamIdOrSlug === "number"
      ? teamIdOrSlug
      : await this.getTeamIdBySlug(teamIdOrSlug);
  }

  private async getTeamIdBySlug(teamSlug: string): Promise<number> {
    const cachedTeamId = await this.teamSlugCache.get(teamSlug);
    if (cachedTeamId) return cachedTeamId;

    const teamId = (
      await this.db?.from("teams").select("id").eq("slug", teamSlug).single()
    )?.data?.id;

    if (!teamId) throw new Error(`Not found team id with slug: ${teamSlug}`);

    await this.teamSlugCache.set(teamSlug, teamId);
    return teamId;
  }

  private filterValidStatements<T extends Statement>(statements: T[]): T[] {
    return statements.filter((r) => !r.resource.endsWith(".ts"));
  }

  private async deleteUserRolesCache(teamId: number, userIds: string[]) {
    await Promise.all(
      userIds.map((u) =>
        this.userPolicyCache.delete(this.getUserPoliceCacheKey(u, teamId)),
      ),
    );
    await Promise.all(
      userIds.map((u) =>
        this.userRolesCache.delete(this.getUserRolesCacheKey(u, teamId)),
      ),
    );
  }

  public filterTeamRoles<R extends Pick<Role, "id">>(roles: R[]): R[] {
    return roles.filter((r) => !BLOCKED_ROLES.has(r.id));
  }

  private getUserPoliceCacheKey(userId: string, teamId: number) {
    return `${userId}:${teamId}`;
  }

  private getUserRolesCacheKey(userId: string, teamId: number) {
    return `${userId}:${teamId}`;
  }

  private getTeamRolesCacheKey(teamId: number) {
    return teamId.toString();
  }

  private assertDb(db: unknown = this.db): asserts db is Client {
    if (!db) {
      console.trace("Tracing error");
      throw new Error("PolicyClient not initialized with database client");
    }
  }
}

/**
 * Authorization service for evaluating access permissions
 */
export class AuthorizationClient {
  private policyClient: PolicyClient;

  constructor(policyClient: PolicyClient) {
    this.policyClient = policyClient;
  }

  /**
   * Check if a user has access to a specific resource
   */
  public async canAccess(
    userOrPolicies: string | Statement[],
    teamIdOrSlug: number | string,
    resource: string,
    ctx: Partial<AuthContext> = {},
  ): Promise<boolean> {
    const statements =
      typeof userOrPolicies === "string"
        ? await this.policyClient.getUserStatements(
            userOrPolicies,
            teamIdOrSlug,
          )
        : (userOrPolicies ?? []);

    let hasAllowMatch = false;

    // Evaluation algorithm: deny overrides allow
    for (const statement of statements) {
      // Check if statement applies to this resource
      const resourceMatch = this.matchResource(statement, resource, ctx);

      if (resourceMatch) {
        // Explicit deny always overrides any allows
        if (statement.effect === "deny") {
          return false;
        }

        if (statement.effect === "allow") {
          hasAllowMatch = true;
        }
      }
    }

    return hasAllowMatch;
  }

  /**
   * Check if a resource pattern matches the requested resource
   */
  private matchResource(
    statement: Statement,
    resource: string,
    ctx: Partial<AuthContext> = {},
  ): boolean {
    const matchFn = statement.matchCondition
      ? MatcherFunctions[statement.matchCondition.resource]
      : undefined;

    const matched =
      matchFn?.handler?.(
        // deno-lint-ignore no-explicit-any
        matchFn?.schema.parse(statement.matchCondition!) as unknown as any,
        ctx,
      ) ?? true;

    return matched && statement.resource === resource;
  }
}

export interface AuthContext {
  user?: UserPrincipal;
  integrationId?: string;
}

interface MatchFunction<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  schema: TSchema;
  handler: (
    props: z.infer<TSchema>,
    context: Partial<AuthContext>,
  ) => boolean | Promise<boolean>;
}

// fn to type
const createMatchFn = <TSchema extends z.ZodTypeAny>(
  def: MatchFunction<TSchema>,
): MatchFunction<TSchema> => def;

const MatcherFunctions = {
  is_integration: createMatchFn({
    schema: IsIntegrationSchema.omit({ resource: true }),
    handler: ({ integrationId }, c) => {
      return !c.integrationId || c.integrationId === integrationId;
    },
  }),
};
