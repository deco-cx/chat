## Implementing Invites

### Invite Method

I want to change the behavior of TEAM_MEMBERS_ADD to actually use an
invite-based flow to add team members.

We use tables from a system that already exists and have this flow

I want to update this method/tool to absorve the logic from the current
invite_add implementation

I'll paste the implementation below.

The corrent codebase has no logic for sending emails. We'll use resend for that.
Create api/clients/resend.ts with the necessary logic (I'll attach it as well).

Use the same logic as other files from /api is using. Import from my example
only the business logic.

sync function inviteMembers( { invitees, teamId }: Props, _: any, {
supabaseClient, user, invoke }: AppContext, ) { const teamIdAsNum =
Number(teamId);

// check if any of the invitees are being invited with owner role const
hasOwnerInvitee = invitees.some(({ roles }) => { return roles.some(({ id }) =>
id === BASE_ROLES_ID.OWNER); });

if (hasOwnerInvitee) { // check if user perfoming the action is owner const
isOwner = await invoke("deco-sites/admin/loaders/teams/isOwner.ts", { teamId:
teamIdAsNum, userId: user.id, });

    if (!isOwner) {
      const errorMsg = "You are not allowed to invite users as owners.";
      return Response.json({ message: errorMsg }, { status: 403 });
    }

}

if (!invitees || !teamId || Number.isNaN(teamIdAsNum)) { return Response.json({
error: { message: "Missing information" } }, { status: 400, }); }

if (invitees.some(({ email }) => !email)) { return Response.json({ error: {
message: "Missing emails" } }, { status: 400, }); }

if (invitees.some(({ roles }) => !roles || roles.length === 0)) { return
Response.json({ error: { message: "Missing roles" } }, { status: 400, }); }

const inviteesPromises = invitees.map(async (invitee) => { const email =
invitee.email.trim(); /** * Do not allow invite user for the same team * Check
if invitee is already created or user with this email already exists */ const
[invites, alreadyExistsUserInTeam] = await Promise.all([
getInviteIdByEmailAndTeam({ email, teamId }, { supabaseClient, }),
checkAlreadyExistUserIdInTeam({ email, teamId }), ]);

    return {
      invitee,
      ignoreInvitee: invites && invites.length > 0 || alreadyExistsUserInTeam,
    };

});

const inviteesResults = await Promise.all(inviteesPromises);

// Filter out invitees that already have an invite const inviteesToInvite =
inviteesResults .filter((inviteeResult) => !inviteeResult.ignoreInvitee)
.map((inviteeResult) => inviteeResult.invitee);

const emailsToInvite = inviteesToInvite.map(({ email }) => email.trim());

const [ { data: profiles, error: profileError }, { data: teamData, error:
teamError }, ] = await Promise.all([ getProfilesWithServerToken(emailsToInvite),
getTeamById(teamId, { supabaseClient }), ]);

if (!teamData || !userBelongsToTeam(teamData)) { return Response.json({ error: {
message: `Caller does not belong to team ${teamId}` }, }, { status: 400, }); }

if (!profiles || profileError || teamError) { return Response.json({ error: {
message: "Something went wrong. Try again" }, }, { status: 400, }); }

const { data: membersOnTeam, error: membersError } = await
getMembersFromProfilesOnTeam( teamIdAsNum, profiles.map(({ user_id }) =>
user_id), );

if (!membersOnTeam || membersError) { return Response.json({ error: { message:
"Something went wrong. Try again" }, }, { status: 400, }); }

const members = membersOnTeam?.map(({ profiles }) => profiles ?
(Array.isArray(profiles) ? profiles[0] : profiles) : null ).filter(Boolean) as
Profile[];

// Add missing emails as pending invites in the database. // When the user with
this email logs in, they will be added to the team. const missingInvitees =
inviteesToInvite.filter(({ email }) => { return !members.find(({ email:
memberEmail, deleted_at }) => memberEmail === email && deleted_at === null );
});

// Add missing emails as pending invites in the database. if
(missingInvitees.length) { const invites = missingInvitees.map((invitee) => ({
invited_email: invitee.email.toLowerCase(), team_id: teamIdAsNum, team_name:
teamData.name, inviter_id: user.id, invited_roles: invitee.roles, }));

    const inviteResult = await insertInvites(invites, { supabaseClient });
    const loggedUser = getLoggedUser(user);

    if (inviteResult.error) {
      return Response.json({
        error: inviteResult.error,
      }, { status: inviteResult.status });
    }

    const requestPromises = inviteResult.data?.map(async (invite) => {
      const rolesNames = invite.invited_roles.map(({ name }) => name);

      await sendInviteEmail({
        ...invite,
        inviter: loggedUser.email,
        roles: rolesNames,
      });
      invoke["deco-sites/admin"].actions.userevents.sendEvent({
        name: "invite_team_member",
        properties: { teamId, invitedEmail: invite.invited_email },
      });
    });

    await Promise.all(requestPromises);

}

return Response.json({ data: { message:
`Invite sent to their home screen. Ask them to log in at https://deco.cx/admin`,
}, }, { status: 201, }); }

The tool should now be called TEAM_MEMBERS_INVITE and the input schema is
interface Roles { name: string; id: number; } interface Invitees { email:
string; roles: Roles[]; }

interface Props { invitees: Invitees[]; teamId: string; }

#### Invite Email

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

export interface EmailBodyProps { inviteId: string; teamName: string; inviter:
string; roles: Array<string>; }

// CORRIGIR O BOTAO DE Accept export function generateEmailBody( { inviteId,
teamName, inviter, roles }: EmailBodyProps, ) { const cleanTeamName =
sanitizeTeamName(teamName); const cleanInviteId = encodeURI(inviteId); const
cleanInviter = sanitizeTeamName(inviter);

function formatRoles(roles: Array<string>) { const capitalizedRoles =
roles.map((role) => role.charAt(0).toUpperCase() + role.slice(1) );

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

return emailHTML; }

viteEmail = async ( { id, team_name, invited_email, inviter, roles }: { id:
string; team_name: string; invited_email: string; inviter: string; roles:
Array<string>; }, ) => { const htmlProps: EmailBodyProps = { inviteId: id,
teamName: team_name, inviter, roles, };

const res = await fetch("https://api.resend.com/emails", { method: "POST",
headers: { "Content-Type": "application/json", "Authorization":
`Bearer ${RESEND_API_KEY}`, }, body: JSON.stringify({ from: "Deco.cx
<noreply@deco.cx>", to: [invited_email], subject: "Team invitation", html:
generateEmailBody(htmlProps), }), });

if (res.status >= 400) { throw new Error(res.statusText); } };

### Accept Invite

Also inside apps/api/src/api/members/api.ts add a new api handler to accept
input in behalf of the receiving user. This is the current logic:

const ROLE_ACTION = "grant"; async function acceptInviteAction( { id }: Props,
_Req: Request, { supabaseClient, user }: AppContext, ) { const policyClient =
PolicyClient.getInstance(); // Add user to this team and Github repos const {
data: members, error, teamId, teamName, invitedData, alreadyExistUserInTeam, } =
await acceptInvite({ inviteId: id, userId: user.id }, { supabaseClient }); if
(alreadyExistUserInTeam) { return { ok: true, teamId }; } if (!members?.[0] ||
error) { logger.warn("No members found", { members, error }); return
shortcircuit(Response.json({ error: error || { message: "Failed to accept
invite. Try again" }, }, { status: 400, })); } await
Promise.all(invitedData.invited_roles.map(async ({ id }) => { await
policyClient.updateUserRole( Number(invitedData.team_id),
invitedData.invited_email, { roleId: id, action: ROLE_ACTION, }, ); })); const
profiles = members.map(({ user_id }) => ({ user_id }) as ({ user_id: string; })
); try { const response = await insertGithubUsers({ supabaseClient }, teamId, {
profiles, }); if (response?.error) { logger.error(
`Error response1 ${response.error} - invite: ${id} - email: ${invitedData.invited_email}`,
); } } catch (_) { /**/ } return { ok: true, teamId, teamName }; }

### Delete Invite

Also inside the same file, add a new method deleteInvite following the logic

interface Props { id: string; _invitedEmail: string; teamId?: string; } async
function deleteInviteAction( { id, _invitedEmail }: Props, _req: Request, {
supabaseClient }: AppContext, ) { const { data } = await deleteInvite({ id }, {
supabaseClient }); if (data === null) { return shortcircuit(new Response("Bad
request", { status: 400 })); } return { ok: true }; }

### Invite Client.ts

Just for you to take a look t insertInvites = async ( invitesBase:
InsertInviteData | InsertInviteData[], { supabaseClient }: WithSupabaseClient, )
=> { const invites = Array.isArray(invitesBase) ? invitesBase : [invitesBase];
const insertData = await supabaseClient.from("invites")
.insert(invites).select(); return insertData; }; export class InviteError
extends Error { constructor(...args: any[]) { super(...args); } } export const
acceptInvite = async ({ inviteId, userId }: { inviteId: string; userId: string;
}, { supabaseClient }: WithSupabaseClient) => { // Use provided supabaseClient
to leverage invite RLS const { data, error } = await
supabaseClientWithServerToken.from("invites") .select("team_id, team_name,
invited_email, invited_roles").eq( "id", inviteId, ).single();

if (!data || error) { throw new InviteError( "We couldn't find your invitation.
It may be invalid or already accepted.", ); } // Use provided supabaseClient to
leverage profiles RLS const { data: profiles, error: profilesError } = await
supabaseClient.from( "profiles", ).select("user_id").eq("email",
data.invited_email.toLowerCase()); if (profilesError) { throw profilesError; }
if (!profiles || !profiles[0]) { const msg =
`Catch admin/invites/accept: error: Profile not found. inviteId: ${inviteId} - email: ${data.invited_email}`;
logger.error(msg); } if (profiles?.[0]?.user_id !== userId) { throw new
InviteError( "It looks like this invite isn't for you. Please ensure your email
matches the one specified in the invitation.", ); } const [profile] = profiles;
const alreadyExistUserInTeam = await checkAlreadyExistUserIdInTeam({ userId:
profile.user_id, teamId: data.team_id.toString(), }); let insertResult = null;
let insertError = null; // Prevent insert user twice, it will fail, since the
supabase is unique (team_id, user_id) if (!alreadyExistUserInTeam) { // TODO:
Wrap in a transaction when Supabase SDK adds support // Use dangerous
supabaseClient to bypass RLS const { data: supabaseInsertResult, error:
supabaseInsertError } = await insertMembers({ team_id: data.team_id, user_id:
profiles[0].user_id, deleted_at: null, admin: null, }, { supabaseClient:
dangerousSupabase }); insertResult = supabaseInsertResult; insertError =
supabaseInsertError; } // Use dangerous supabaseClient to bypass RLS and delete
the invite await dangerousSupabase.from("invites").delete().eq("id", inviteId);
return { alreadyExistUserInTeam, data: insertResult, error: insertError, teamId:
data.team_id, teamName: data.team_name, invitedData: data, }; }; export const
deleteInvite = async ({ id }: { id: string; }, { supabaseClient }:
WithSupabaseClient) => { return await
supabaseClient.from("invites").delete().eq("id", id).select(); }; export const
getTeamInvites = async ( teamId: string, { supabaseClient }: WithSupabaseClient,
) => { const { data } = await supabaseClient.from("invites").select( "id,
email:invited_email, invited_roles", ).eq("team_id", teamId); return data; };
export const removeInvitesFromUser = async (userId: string) => { return await
dangerousSupabase .from("invites") .delete().eq("inviter_id", userId); }; export
const getInviteIdByEmailAndTeam = async ({ email, teamId }: { email: string;
teamId: string; }, { supabaseClient }: WithSupabaseClient) => { const { data } =
await supabaseClient.from("invites").select("id").eq( "invited_email", email,
).eq("team_id", teamId); return data; };

## Implementation Completion Tracking

| Task                                                | Status    | Notes                                                                                |
| --------------------------------------------------- | --------- | ------------------------------------------------------------------------------------ |
| Create TEAM_MEMBERS_INVITE handler in api.ts        | Completed | Implemented with email sending and database operations                               |
| Create acceptInvite handler in api.ts               | Completed | Implemented as TEAM_INVITE_ACCEPT                                                    |
| Create deleteInvite handler in api.ts               | Completed | Implemented as TEAM_INVITE_DELETE                                                    |
| Implement Resend email functionality                | Completed | Implemented in invitesUtils.ts                                                       |
| Implement helper functions for invite handling      | Completed | Added necessary helpers for checking team membership, getting invites, etc.          |
| Move email and utility functions to invitesUtils.ts | Completed | Extracted all email and utility functions to a separate file for better organization |
| Remove duplicate email code from api.ts             | Completed | Removed all email-related code from api.ts to avoid duplication                      |
