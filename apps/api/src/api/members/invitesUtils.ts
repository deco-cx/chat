import type { Client } from "../../db/client.ts";

// Email sending functionality
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_CANONICAL_DOMAIN = Deno.env.get("ADMIN_CANONICAL_DOMAIN") ||
  "https://deco.cx";

export function sanitizeTeamName(name: string): string {
  return name.replace(/[<>&'"]/g, "");
}

export interface EmailBodyProps {
  inviteId: string;
  teamName: string;
  inviter: string;
  roles: Array<string>;
}

export function generateEmailBody(
  { inviteId, teamName, inviter, roles }: EmailBodyProps,
) {
  const cleanTeamName = sanitizeTeamName(teamName);
  const cleanInviteId = encodeURI(inviteId);
  const cleanInviter = sanitizeTeamName(inviter);

  function formatRoles(roles: Array<string>) {
    const capitalizedRoles = roles.map((role) =>
      role.charAt(0).toUpperCase() + role.slice(1)
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

  const emailHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
<title>Email Template</title>
</head>
<body>
<!-- Main Table -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; margin: 0 auto; text-align: center;">
  <!-- Logo Row -->
  <tr>
    <td style="padding: 24px;">
      <img width="144px" height="40px" style="width:144px;height:40px;" src="https://admin.deco.cx/live/invoke/deco-sites/std/loaders/x/image.ts?src=https://ozksgdmyrqcxcwhnbepg.supabase.co/storage/v1/object/public/assets/1/f57315b2-b88e-4977-9178-40c105af44cb" alt="Logo"/>
    </td>
  </tr>

  <!-- Message Row -->
  <tr>
    <td style="color: #000; font-size: 24px; padding: 16px;">
      <strong>${cleanInviter}</strong> has invited you to join the team <strong>${cleanTeamName}</strong> as <strong>${formattedRoles}</strong>.
    </td>
  </tr>

  <!-- Button Row -->
  <tr>
    <td style="padding-bottom: 24px; padding-top: 12px;">
      <!-- Use a link instead of a button for better email client support -->
      <a href="${ADMIN_CANONICAL_DOMAIN}/admin/invites/${cleanInviteId}/accept" target="_blank" style="display: inline;   color: #fff;   font-size: 18px;   font-weight: 700;   line-height: 24px;    text-decoration: none;    border-radius: 8px;   background: #0d1717; padding: 13px 32px;">Join team</a>
    </td>
  </tr>

  <!-- Divider Line -->
  <tr>
    <td>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="background: #C9CFCF; height: 1px; width: 100%;"></td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Icons Row -->
  <tr>
    <td style="padding: 24px;">
      <a href="https://www.youtube.com/@deco-cx"><img style="padding-bottom: 8px; padding-right: 8px" src="https://admin.deco.cx/live/invoke/deco-sites/std/loaders/x/image.ts?src=https://ozksgdmyrqcxcwhnbepg.supabase.co/storage/v1/object/public/assets/1/c1604884-bdc5-4d83-92c9-98576ed94c6c" alt="YouTube" /></a>
      <a href="https://www.linkedin.com/company/deco-cx/mycompany/" ><img src="https://admin.deco.cx/live/invoke/deco-sites/std/loaders/x/image.ts?src=https://ozksgdmyrqcxcwhnbepg.supabase.co/storage/v1/object/public/assets/1/fc248a9d-ae2b-4032-a389-84934bab54fc" alt="LinkedIn" /></a>
      <a href="https://www.instagram.com/deco.cx/"><img src="https://admin.deco.cx/live/invoke/deco-sites/std/loaders/x/image.ts?src=https://ozksgdmyrqcxcwhnbepg.supabase.co/storage/v1/object/public/assets/1/094f9577-a9b0-44c3-b65a-78062573f3c1" alt="Instagram" /></a>
      <a href="https://github.com/deco-sites"><img src="https://admin.deco.cx/live/invoke/deco-sites/std/loaders/x/image.ts?src=https://ozksgdmyrqcxcwhnbepg.supabase.co/storage/v1/object/public/assets/1/b061cd1f-99c9-4b97-83a7-95ef093d493b" alt="Github" /></a>
      <a href="https://discord.gg/mC7X6YdarJ"><img src="https://admin.deco.cx/live/invoke/deco-sites/std/loaders/x/image.ts?src=https://ozksgdmyrqcxcwhnbepg.supabase.co/storage/v1/object/public/assets/1/c738cb90-11a1-4a93-a2fa-8a544fce6b0b" alt="Discord" /></a>
    </td>
  </tr>
</table>
<!-- End Main Table -->
</body>
</html>
`;

  return emailHTML;
}

export async function sendInviteEmail(
  { id, team_name, invited_email, inviter, roles }: {
    id: string;
    team_name: string;
    invited_email: string;
    inviter: string;
    roles: Array<string>;
  },
) {
  const htmlProps: EmailBodyProps = {
    inviteId: id,
    teamName: team_name,
    inviter,
    roles,
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Deco.cx <noreply@deco.cx>",
      to: [invited_email],
      subject: "Team invitation",
      html: generateEmailBody(htmlProps),
    }),
  });

  if (res.status >= 400) {
    console.log(await res.json());
    throw new Error(res.statusText);
  }

  return res;
}

// Helper functions for invite handling
export async function getInviteIdByEmailAndTeam({ email, teamId }: {
  email: string;
  teamId: string;
}, db: Client) {
  const { data } = await db.from("invites").select("id").eq(
    "invited_email",
    email,
  ).eq("team_id", teamId);
  return data;
}

export async function checkAlreadyExistUserIdInTeam({
  userId,
  teamId,
  email,
}: {
  userId?: string;
  teamId: string;
  email?: string;
}, db: Client) {
  if (userId) {
    const { data } = await db.from("members")
      .select("id")
      .eq("user_id", userId)
      .eq("team_id", Number(teamId))
      .is("deleted_at", null)
      .limit(1);

    return data && data.length > 0;
  } else if (email) {
    const { data: profiles } = await db.from("profiles")
      .select("user_id")
      .eq("email", email.toLowerCase());

    if (!profiles || profiles.length === 0) return false;

    const userId = profiles[0].user_id;
    const { data } = await db.from("members")
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

export async function getTeamById(teamId: string, db: Client) {
  const { data, error } = await db.from("teams")
    .select("id, name, members(user_id)")
    .eq("id", Number(teamId))
    .single();

  return { data, error };
}

export function userBelongsToTeam(
  team: { members: Array<{ user_id: string }> },
  userId?: string,
) {
  if (!userId) return false;
  return team.members.some((member) => member.user_id === userId);
}

// Interface for Role data structure based on database schema
export interface Role {
  id: number;
  name: string;
  description: string | null;
  team_id: number | null;
  created_at: string;
}

export async function updateUserRole(
  db: Client,
  teamId: number,
  email: string,
  { roleId, action }: {
    roleId: number;
    action: "grant" | "revoke";
  },
): Promise<Role | null> {
  // Get the team member data with their profile
  const { data: userTeamMemberData, error } = await db
    .from("members")
    .select("id, profiles!inner(email, user_id)")
    .eq("team_id", teamId)
    .eq("profiles.email", email);

  const userTeamMember = userTeamMemberData?.[0];

  if (!userTeamMember || error) {
    throw new Error("Not Allowed - User not found in team");
  }

  // Get the role data
  const { data: role, error: roleError } = await db
    .from("roles")
    .select("*")
    .eq("id", roleId)
    .single();

  if (!role || roleError) {
    throw new Error("Role not found");
  }

  // Perform the action (grant or revoke)
  if (action === "revoke") {
    const { data: deletedRole, error: deleteError } = await db
      .from("member_roles")
      .delete()
      .eq("member_id", userTeamMember.id)
      .eq("role_id", role.id)
      .select()
      .single();

    if (deleteError) {
      throw deleteError;
    }

    return deletedRole !== null ? role : null;
  }

  // Check if role already exists for this member
  const { data: memberRole, error: memberRoleError } = await db
    .from("member_roles")
    .select("id")
    .eq("member_id", userTeamMember.id)
    .eq("role_id", role.id)
    .single();

  if (memberRoleError && memberRoleError.code !== "PGRST116") {
    throw memberRoleError;
  }

  // If role doesn't exist for this member, create it
  if (!memberRole) {
    const { data: createdRole, error: createError } = await db
      .from("member_roles")
      .insert({ role_id: role.id, member_id: userTeamMember.id })
      .select()
      .single();

    if (createError || !createdRole) {
      throw createError || new Error("Failed to create role assignment");
    }
  }

  return role;
}
