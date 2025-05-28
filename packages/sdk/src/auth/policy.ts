import { Client, Json } from "@deco/sdk/storage";
import { WebCache } from "../cache/index.ts";
import { UserPrincipal } from "../mcp/index.ts";
import { z } from "zod";

// Cache duration
const TWO_MIN_TTL = 1000 * 60 * 2;

// Base roles
export const BASE_ROLES_ID = {
  OWNER: 1,
  PUBLISHER: 2,
  COLLABORATOR: 3,
  ADMIN: 4,
};

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

export interface RoleUpdateParams {
  roleId: number;
  action: "grant" | "revoke";
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
    await this.userPolicyCache.delete(cacheKey);
    await this.userPolicyCache.set(
      cacheKey,
      this.filterValidPolicies(policies),
    );

    return [...policies, ...teamPolicies];
  }

  public async removeAllMemberPoliciesAtTeam(
    { teamId, memberId }: { teamId: number; memberId: number },
  ) {
    this.assertDb(this.db);

    const { error } = await this.db.from("member_roles").delete().eq(
      "teamId",
      teamId,
    ).eq(
      "memberId",
      memberId,
    );

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
    await this.teamRolesCache.delete(this.getTeamRolesCacheKey(teamId));
    await this.teamRolesCache.set(this.getTeamRolesCacheKey(teamId), roles);

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

    // Get user by email
    const { data: profile } = await this.db
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .single();

    if (!profile) {
      throw new Error("User not found");
    }

    // Get member by user ID and team ID
    const { data: member } = await this.db
      .from("members")
      .select("id")
      .eq("user_id", profile.user_id)
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .single();

    if (!member) {
      throw new Error("Member not found");
    }

    // Get role details
    const { data: role } = await this.db
      .from("roles")
      .select("*")
      .eq("id", params.roleId)
      .single();

    if (!role) {
      throw new Error("Role not found");
    }

    // Special handling for the owner role
    if (params.roleId === BASE_ROLES_ID.OWNER) {
      if (params.action === "revoke") {
        // Check if this would remove the last owner
        const { count } = await this.db
          .from("member_roles")
          .select("role_id", { count: "exact" })
          .eq("role_id", BASE_ROLES_ID.OWNER)
          .eq("member_id", member.id);

        if (count === 1) {
          throw new Error("Cannot remove the last owner of the team");
        }
      }
    }

    // Update the role assignment
    if (params.action === "grant") {
      // Add role to member
      await this.db
        .from("member_roles")
        .upsert({
          member_id: member.id,
          role_id: params.roleId,
        });
    } else {
      // Remove role from member
      await this.db
        .from("member_roles")
        .delete()
        .eq("member_id", member.id)
        .eq("role_id", params.roleId);
    }

    // Invalidate cache for this user
    await this.userPolicyCache.delete(
      this.getUserPoliceCacheKey(profile.user_id, teamId),
    );

    return role;
  }

  async createPolicyForTeamResource(
    teamIdOrSlug: string | number,
    partialPolicy: { name: string; statements: Statement[] },
  ) {
    this.assertDb(this.db);
    const teamId = await this.getTeamIdByIdOrSlug(teamIdOrSlug);

    const policy = {
      name: `${teamId}_${partialPolicy.name}`,
      team_id: teamId,
      statements: partialPolicy.statements as unknown as Json[],
    };

    const teamPolicies = await this.getTeamPolicies(teamId);
    //  check if one already exists with policy.name, if yes, throw an error saying policy already exists
    if (teamPolicies.some((p) => p.name === policy.name)) return null;

    const { data } = await this.db.from("policies").insert(policy).select();
    await this.teamPoliciesCache.delete(this.getTeamPoliciesCacheKey(teamId));
    return data;
  }

  async deletePolicyForTeamResource(
    teamIdOrSlug: string | number,
    policyName: string,
  ) {
    this.assertDb(this.db);
    const teamId = await this.getTeamIdByIdOrSlug(teamIdOrSlug);

    const { data } = await this.db.from("policies").delete().eq(
      "team_id",
      teamId,
    ).eq("name", policyName).select();

    await this.teamPoliciesCache.delete(this.getTeamPoliciesCacheKey(teamId));
    return data;
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

    await this.teamSlugCache.delete(teamSlug);
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
    userId: string,
    teamIdOrSlug: number | string,
    resource: string,
    ctx: Partial<AuthContext> = {},
  ): Promise<boolean> {
    const policies = await this.policyClient.getUserPolicies(
      userId,
      teamIdOrSlug,
    );

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
    const fn = statement.matchCondition
      ? MatcherFunctions[statement.matchCondition.resource].handler
      : undefined;

    const matched = fn?.(statement.matchCondition!, ctx) ?? true;

    return matched && statement.resource === resource;
  }
}

interface AuthContext {
  user?: UserPrincipal;
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
  is_not_user: createMatchFn({
    schema: z.object({ userId: z.string() }),
    handler: ({ userId }, c) => !!c.user && c.user.id !== userId,
  }),
};
