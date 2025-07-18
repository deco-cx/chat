import type { Client, Json } from "@deco/sdk/storage";
import { WebCache } from "../cache/index.ts";
import type { UserPrincipal } from "../mcp/index.ts";
import { z } from "zod";

// Cache duration in seconds (WebCache expects seconds)
const TWO_MIN_TTL = 60 * 2;

// Base roles
export const BASE_ROLES_ID = {
  OWNER: 1,
  PUBLISHER: 2,
  COLLABORATOR: 3,
  ADMIN: 4,
};

const BLOCKED_ROLES = new Set([BASE_ROLES_ID.PUBLISHER]);

type MatchFunctionsManifest = typeof MatcherFunctions;
type MatchCondition<
  FnR extends keyof MatchFunctionsManifest = keyof MatchFunctionsManifest,
> = { resource: FnR } & z.infer<MatchFunctionsManifest[FnR]["schema"]>;

// Typed interfaces
export interface Statement {
  effect: "allow" | "deny";
  resource: string;
  matchCondition?: MatchCondition;
}

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
  private userPolicyCache: WebCache<Pick<Policy, "statements">[]>;
  private userRolesCache: WebCache<MemberRole[]>;
  private teamRolesCache: WebCache<Role[]>;
  private teamPoliciesCache: WebCache<Pick<Policy, "statements" | "name">[]>;
  private teamSlugCache: WebCache<number>;

  private constructor() {
    // Initialize caches
    this.userPolicyCache = new WebCache<Pick<Policy, "statements">[]>(
      "user-policies",
      TWO_MIN_TTL,
    );
    this.userRolesCache = new WebCache<MemberRole[]>("user-roles", TWO_MIN_TTL);
    this.teamRolesCache = new WebCache<Role[]>("team-role", TWO_MIN_TTL);
    this.teamPoliciesCache = new WebCache<
      Pick<Policy, "statements" | "name">[]
    >(
      "team-policies",
      TWO_MIN_TTL,
    );
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
    if (!this.db) {
      throw new Error("PolicyClient not initialized with database client");
    }

    const teamId = typeof teamIdOrSlug === "number"
      ? teamIdOrSlug
      : await this.getTeamIdBySlug(teamIdOrSlug);

    const cacheKey = this.getUserRolesCacheKey(userId, teamId);

    const cachedRoles = await this.userRolesCache.get(cacheKey);
    if (cachedRoles) {
      return cachedRoles;
    }

    const { data } = await this.db.from("members")
      .select(`
        id,
        member_roles(
          role_id,
          roles(
            id,
            name
          )
        )
      `)
      .eq("user_id", userId)
      .eq("team_id", teamId)
      .single();

    if (!data?.member_roles) {
      return [];
    }

    const roles: MemberRole[] = data.member_roles.map((
      mr: { role_id: number; roles: { id: number; name: string } },
    ) => ({
      member_id: data.id,
      role_id: mr.role_id,
      name: mr.roles.name,
      role: {
        ...mr.roles,
        team_id: teamId,
      },
    }));

    // Cache the result
    await this.userRolesCache.set(cacheKey, roles);

    return roles;
  }

  /**
   * Get all policies for a user in a specific team
   */
  public async getUserPolicies(
    userId: string,
    teamIdOrSlug: number | string,
  ): Promise<Pick<Policy, "statements">[]> {
    this.assertDb(this.db);

    const teamId = typeof teamIdOrSlug === "number"
      ? teamIdOrSlug
      : await this.getTeamIdBySlug(teamIdOrSlug);

    if (teamId === undefined) {
      throw new Error(`Team with slug "${teamIdOrSlug}" not found`);
    }

    const cacheKey = this.getUserPoliceCacheKey(userId, teamId);

    // Try to get from cache first
    const [cachedPolicies, teamPolicies] = await Promise.all([
      this.userPolicyCache.get(cacheKey),
      this.getTeamPolicies(teamId),
    ]);
    if (cachedPolicies) {
      return [...cachedPolicies, ...teamPolicies];
    }

    const { data, error: policiesError } = await this.db
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

    const policies = data?.map((memberRole) => ({
      statements: memberRole.roles.role_policies
        .map((rolePolicies) =>
          rolePolicies.policies.statements as unknown as Statement[] ?? []
        )
        .flat(),
    }));

    if (policiesError || !policies) {
      return [];
    }

    // Cache the result
    await this.userPolicyCache.set(
      cacheKey,
      this.filterValidPolicies(policies),
    );

    return [...policies, ...teamPolicies];
  }

  public async removeAllMemberPoliciesAtTeam(
    { teamId, memberId }: { teamId: number; memberId: number },
  ) {
    if (!this.db) {
      throw new Error("PolicyClient not initialized with database client");
    }

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

    const { error } = await this.db.from("member_roles")
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
      this.db.from("members").select("id, profiles!inner(email, user_id)")
        .eq("team_id", teamId).eq("profiles.email", email).single(),
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
      await this.db
        .from("member_roles")
        .upsert({
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

  async createPolicyForTeamResource(
    teamIdOrSlug: string | number,
    policy: Partial<Policy> & Pick<Policy, "name">,
  ) {
    this.assertDb(this.db);
    const teamId = await this.getTeamIdByIdOrSlug(teamIdOrSlug);

    const policyData = {
      ...policy,
      team_id: teamId,
      statements: policy.statements as unknown as Json[],
    };

    const { data, error } = await this.db.from("policies").insert(policyData)
      .select().single();
    if (error) {
      throw error;
    }
    await this.teamPoliciesCache.delete(this.getTeamPoliciesCacheKey(teamId));
    return data as unknown as Policy | null;
  }

  async deletePolicyForTeamResource(
    teamIdOrSlug: string | number,
    policyIds: number[],
  ) {
    this.assertDb(this.db);
    const teamId = await this.getTeamIdByIdOrSlug(teamIdOrSlug);
    const { data } = await this.db.from("policies").delete().in("id", policyIds)
      .eq("team_id", teamId).select();
    await this.teamPoliciesCache.delete(this.getTeamPoliciesCacheKey(teamId));
    return data;
  }

  private async updatePolicyForTeamResource(
    teamIdOrSlug: string | number,
    policy: Partial<Policy> & Pick<Policy, "id">,
  ) {
    this.assertDb(this.db);
    const teamId = await this.getTeamIdByIdOrSlug(teamIdOrSlug);
    const { data, error } = await this.db
      .from("policies")
      .update({
        ...policy,
        statements: policy.statements as unknown as Json[],
        team_id: teamId,
      })
      .eq("id", policy.id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    await this.teamPoliciesCache.delete(this.getTeamPoliciesCacheKey(teamId));
    return data as unknown as Policy | null;
  }

  async createRole(
    teamIdOrSlug: string | number,
    role: Partial<Role> & Pick<Role, "name">,
    policies?: Partial<Policy> & Pick<Policy, "name">[],
  ) {
    this.assertDb(this.db);
    const teamId = await this.getTeamIdByIdOrSlug(teamIdOrSlug);

    const { data } = await this.db
      .from("roles")
      .insert({
        ...role,
        team_id: teamId,
      })
      .select()
      .single();
    if (!data) {
      throw new Error("Failed to create role");
    }
    await this.teamRolesCache.delete(this.getTeamRolesCacheKey(teamId));

    // TODO: implement rollback if error
    if (policies) {
      const policiesData = (await Promise.all(policies.map(async (p) => {
        return await this.createPolicyForTeamResource(teamId, p);
      }))).filter((p): p is Policy => p !== null);

      await this.createRolePolicies(policiesData, data.id);
      await this.teamPoliciesCache.delete(this.getTeamPoliciesCacheKey(teamId));
    }

    return data;
  }

  private async createRolePolicies(
    policies: Pick<Policy, "id">[],
    roleId: number,
  ) {
    this.assertDb(this.db);
    const { data, error } = await this.db.from("role_policies").upsert(
      policies.map((p) => ({
        policy_id: p.id,
        role_id: roleId,
      }), { onConflict: "role_id, policy_id" }),
    );

    if (error) {
      throw error;
    }
    return data;
  }

  async updateRole(
    teamIdOrSlug: string | number,
    role: Partial<Role> & Pick<Role, "id">,
    policies?: Partial<Policy> & Pick<Policy, "name">[],
  ) {
    this.assertDb(this.db);
    const teamId = await this.getTeamIdByIdOrSlug(teamIdOrSlug);

    // check if role.team_id
    const { data, error } = await this.db
      .from("roles")
      .update({
        ...role,
        team_id: teamId,
      })
      .eq("id", role.id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    await this.teamRolesCache.delete(this.getTeamRolesCacheKey(teamId));

    // TODO: implement rollback if error
    if (policies) {
      const policiesData = (await Promise.all(policies.map(async (p) => {
        if ("id" in p) {
          return await this.updatePolicyForTeamResource(
            teamId,
            p as Partial<Policy> & Pick<Policy, "id">,
          );
        }
        return await this.createPolicyForTeamResource(teamId, p);
      }))).filter((p): p is Policy => p !== null);

      await this.createRolePolicies(policiesData, role.id);
      await this.teamPoliciesCache.delete(this.getTeamPoliciesCacheKey(teamId));
    }

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

    if (!role) {
      throw new Error("Role not found");
    }

    if (role.team_id === null) {
      throw new Error("Cannot delete system roles");
    }

    if (role.team_id !== teamId) {
      throw new Error("Role does not belong to this team");
    }

    // delete all role_policies
    const { data: policiesIds } = await this.db.from("role_policies").delete()
      .eq("role_id", role.id).select("policy_id");

    if (policiesIds) {
      await this.deletePolicyForTeamResource(
        teamId,
        policiesIds.map((p) => p.policy_id),
      );
    }

    // delete all member_roles
    const { data: memberIds } = await this.db.from("member_roles").delete().eq(
      "role_id",
      role.id,
    ).select("member_id");
    // remove cache for all users
    if (memberIds) {
      const { data: _members } = await this.db.from("members").select("user_id")
        .in("id", memberIds.map((m) => m.member_id));
      const members = _members?.filter((m): m is { user_id: string } =>
        m.user_id !== null
      ) ?? [];
      await this.deleteUserRolesCache(teamId, members.map((m) => m.user_id));
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

    const policies: Policy[] = this.filterValidPolicies(
      data.role_policies.map((rp) => rp.policies as unknown as Policy),
    );

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      team_id: data.team_id,
      policies,
    };
  }

  private async getTeamPolicies(
    teamIdOrSlug: number | string,
  ): Promise<Pick<Policy, "statements" | "name">[]> {
    this.assertDb(this.db);

    const teamId = await this.getTeamIdByIdOrSlug(teamIdOrSlug);
    const cacheKey = this.getTeamPoliciesCacheKey(teamId);

    // Try to get from cache first
    const cachedPolicies = await this.teamPoliciesCache.get(cacheKey);
    if (cachedPolicies) {
      return cachedPolicies;
    }

    // Get from database
    const { data: policies, error } = await this.db
      .from("policies")
      .select("id, name, team_id, statements")
      .eq("team_id", teamId);

    if (error || !policies) {
      return [];
    }

    // Transform the data to match Policy interface
    const transformedPolicies: Pick<Policy, "name" | "statements">[] = policies
      .map((policy) => ({
        name: policy.name,
        statements: policy.statements as unknown as Statement[],
      }));

    // Cache the result
    await this.teamPoliciesCache.delete(cacheKey);
    await this.teamPoliciesCache.set(
      cacheKey,
      this.filterValidPolicies(transformedPolicies),
    );

    return transformedPolicies;
  }

  private async getTeamIdByIdOrSlug(teamIdOrSlug: string | number) {
    return typeof teamIdOrSlug === "number"
      ? teamIdOrSlug
      : await this.getTeamIdBySlug(teamIdOrSlug);
  }

  private async getTeamIdBySlug(teamSlug: string): Promise<number> {
    const cachedTeamId = await this.teamSlugCache.get(teamSlug);
    if (cachedTeamId) return cachedTeamId;

    const teamId =
      (await this.db?.from("teams").select("id").eq("slug", teamSlug)
        .single())?.data?.id;

    if (!teamId) throw new Error(`Not found team id with slug: ${teamSlug}`);

    await this.teamSlugCache.set(teamSlug, teamId);
    return teamId;
  }

  private filterValidPolicies<T extends Pick<Policy, "statements">>(
    policies: T[],
  ): T[] {
    return policies.map((policy) => ({
      ...policy,
      // filter admin policies
      statements: policy.statements.filter((r) => !r.resource.endsWith(".ts")),
    }));
  }

  private async deleteUserRolesCache(teamId: number, userIds: string[]) {
    await Promise.all(
      userIds.map((u) =>
        this.userPolicyCache.delete(this.getUserPoliceCacheKey(u, teamId))
      ),
    );
    await Promise.all(
      userIds.map((u) =>
        this.userRolesCache.delete(this.getUserRolesCacheKey(u, teamId))
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

  private getTeamPoliciesCacheKey(teamId: number) {
    return teamId.toString();
  }

  private assertDb(db: unknown = this.db): asserts db is Client {
    if (!db) {
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
    userOrPolicies: string | Pick<Policy, "statements">[],
    teamIdOrSlug: number | string,
    resource: string,
    ctx: Partial<AuthContext> = {},
  ): Promise<boolean> {
    const policies = typeof userOrPolicies === "string"
      ? await this.policyClient.getUserPolicies(
        userOrPolicies,
        teamIdOrSlug,
      )
      : userOrPolicies;

    if (!policies.length) {
      return false;
    }

    let hasAllowMatch = false;

    // Evaluation algorithm: deny overrides allow
    for (const policy of policies) {
      for (const statement of policy.statements) {
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

    statement.matchCondition && console.log(statement.matchCondition);

    const matched = matchFn?.handler?.(
      // deno-lint-ignore no-explicit-any
      matchFn?.schema.parse(statement.matchCondition!) as unknown as any,
      ctx,
    ) ?? true;

    return matched && statement.resource === resource;
  }
}

interface AuthContext {
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
    schema: z.object({ integrationId: z.string() }),
    handler: ({ integrationId }, c) => {
      return c.integrationId === integrationId;
    },
  }),
};
