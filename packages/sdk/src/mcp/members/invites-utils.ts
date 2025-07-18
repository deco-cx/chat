import { NotFoundError } from "../../errors.ts";
import type { Plan, PlanWithTeamMetadata } from "../../plan.ts";
import type { Client } from "../../storage/index.ts";
import { type AppContext, getEnv } from "../context.ts";
import { getInviteEmailTemplate } from "./invite-email-template.ts";

// Email sending functionality

export function sanitizeTeamName(name: string): string {
  return name.replace(/[<>&'"]/g, "");
}

export interface EmailBodyProps {
  inviteId: string;
  teamName: string;
  inviter: string;
  roles: Array<string>;
}

export function generateEmailBody({
  teamName,
  inviter,
  roles,
}: EmailBodyProps) {
  const cleanTeamName = sanitizeTeamName(teamName);
  const cleanInviter = sanitizeTeamName(inviter);

  function formatRoles(roles: Array<string>) {
    const capitalizedRoles = roles.map(
      (role) => role.charAt(0).toUpperCase() + role.slice(1),
    );

    if (capitalizedRoles.length === 1) {
      return capitalizedRoles[0];
    } else if (capitalizedRoles.length === 2) {
      return `${capitalizedRoles[0]} and ${capitalizedRoles[1]}`;
    } else {
      const lastRole = capitalizedRoles.pop();
      return `${capitalizedRoles.join(", ")}, and ${lastRole}`;
    }
  }

  const formattedRoles = formatRoles([...roles]);

  const emailHTML = getInviteEmailTemplate({
    cleanInviter,
    cleanTeamName,
    formattedRoles,
  });

  return emailHTML;
}

export async function sendInviteEmail(
  {
    id,
    team_name,
    invited_email,
    inviter,
    roles,
  }: {
    id: string;
    team_name: string;
    invited_email: string;
    inviter: string;
    roles: Array<string>;
  },
  c: AppContext,
) {
  const htmlProps: EmailBodyProps = {
    inviteId: id,
    teamName: team_name,
    inviter,
    roles,
  };
  const { RESEND_API_KEY } = getEnv(c);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "deco.chat <noreply@deco.chat>",
      to: [invited_email],
      subject: "Team invitation",
      html: generateEmailBody(htmlProps),
    }),
  });

  if (res.status >= 400) {
    console.error("[Resend Error] error sending email", await res.text());
    throw new Error(res.statusText);
  }

  return res;
}

// Helper functions for invite handling
export async function getInviteIdByEmailAndTeam(
  {
    email,
    teamId,
  }: {
    email: string;
    teamId: string;
  },
  db: Client,
) {
  const { data } = await db
    .from("invites")
    .select("id")
    .eq("invited_email", email)
    .eq("team_id", Number(teamId));
  return data;
}

export async function checkAlreadyExistUserIdInTeam(
  {
    userId,
    teamId,
    email,
  }: {
    userId?: string;
    teamId: string;
    email?: string;
  },
  db: Client,
) {
  if (userId) {
    const { data } = await db
      .from("members")
      .select("id")
      .eq("user_id", userId)
      .eq("team_id", Number(teamId))
      .is("deleted_at", null)
      .limit(1);

    return data && data.length > 0;
  } else if (email) {
    const { data: profiles } = await db
      .from("profiles")
      .select("user_id")
      .eq("email", email.toLowerCase());

    if (!profiles || profiles.length === 0) return false;

    const userId = profiles[0].user_id;
    const { data } = await db
      .from("members")
      .select("id")
      .eq("user_id", userId)
      .eq("team_id", Number(teamId))
      .is("deleted_at", null)
      .limit(1);

    return data && data.length > 0;
  }

  return false;
}

export async function insertInvites(
  invites: Array<{
    invited_email: string;
    team_id: number;
    team_name: string;
    inviter_id: string;
    invited_roles: Array<{ id: number; name: string }>;
  }>,
  db: Client,
) {
  const { data, error } = await db.from("invites").insert(invites).select();

  if (error) {
    return { error, status: 400 };
  }

  return { data, error: null, status: 201 };
}

export function enrichPlanWithTeamMetadata({
  team,
  plan,
}: {
  team: {
    members: Array<{
      user_id: string | null;
      profile: {
        email: string;
      } | null;
    }>;
  };
  plan: Plan;
}): PlanWithTeamMetadata {
  const extractOptionalProfile = (member: (typeof team.members)[number]) =>
    member.profile;
  const filterExistingEmail = (
    member: { email: string } | null,
  ): member is { email: string } => Boolean(member?.email);

  /**
   * Developers from deco can sometimes join user teams to provide support,
   * so we don't want to count those as seats.
   */
  const excludeDevEmails = (member: { email: string }) =>
    !member.email.endsWith("@deco.cx");

  const members = team.members
    .map(extractOptionalProfile)
    .filter(filterExistingEmail)
    .filter(excludeDevEmails);

  const remainingSeats = Math.max(plan.user_seats - members.length, 0);

  return {
    ...plan,
    remainingSeats,
    isAtSeatLimit: remainingSeats === 0,
  };
}

export async function getTeamBySlug(slug: string, db: Client) {
  const { data: team, error } = await db
    .from("teams")
    .select(
      "id, name, slug, members(user_id, profile:profiles(email)), plan_id, plan:deco_chat_plans(*)",
    )
    .eq("slug", slug)
    .single();

  if (!team || error || !team.plan) {
    throw new NotFoundError("Could not find team");
  }

  return team;
}

export async function getTeamById(teamId: string, db: Client) {
  const { data: team, error } = await db
    .from("teams")
    .select(
      "id, name, members(user_id, profile:profiles(email)), plan_id, plan:deco_chat_plans(*)",
    )
    .eq("id", Number(teamId))
    .single();

  if (!team || error || !team.plan) {
    throw new NotFoundError("Could not find team");
  }

  return team;
}

export function userBelongsToTeam(
  team: { members: Array<{ user_id: string | null }> },
  userId?: string,
) {
  if (!userId) return false;
  return team.members.some((member) => member.user_id === userId);
}
