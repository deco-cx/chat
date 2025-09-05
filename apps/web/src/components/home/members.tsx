import { useTeamMembers } from "@deco/sdk";
import { Avatar } from "../common/avatar";

export function OrgAvatars({ teamId }: { teamId: number }) {
  const members = useTeamMembers(teamId ?? null);
  return (
    <div className="flex items-center">
      {members.data.members.slice(0, 4).map((member) => (
        <Avatar
          key={member.id}
          url={member.profiles.metadata.avatar_url}
          fallback={member.profiles.metadata.full_name}
          shape="circle"
          className="w-6 h-6 border border-border -ml-2 first:ml-0"
          size="sm"
        />
      ))}
    </div>
  );
}

OrgAvatars.Skeleton = () => (
  <div className="flex items-center">
    <div className="h-6 w-6 bg-stone-200 rounded-full animate-pulse" />
    <div className="h-6 w-6 bg-stone-200 rounded-full animate-pulse -ml-2" />
    <div className="h-6 w-6 bg-stone-200 rounded-full animate-pulse -ml-2" />
    <div className="h-6 w-6 bg-stone-200 rounded-full animate-pulse -ml-2" />
  </div>
);

export const OrgMemberCount = ({ teamId }: { teamId: number }) => {
  const members = useTeamMembers(teamId ?? null);
  return <div className="text-xs">{members.data.members.length} members</div>;
};

OrgMemberCount.Skeleton = () => (
  <div className="h-4 w-8 bg-stone-200 rounded-md animate-pulse" />
);
