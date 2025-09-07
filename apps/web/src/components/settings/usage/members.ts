import { useParams } from "react-router";
import { type Member, useTeamMembersBySlug } from "@deco/sdk";
import { useMemo } from "react";
import { useUser } from "../../../hooks/use-user.ts";

function userToMember(user: ReturnType<typeof useUser>): Member {
  return {
    id: -1,
    user_id: user.id,
    profiles: {
      email: user.email,
      id: user.id,
      is_anonymous: false,
      metadata: user.metadata,
      phone: user.phone,
    },
    roles: [],
    created_at: "",
    lastActivity: "",
  };
}

function createUnknownMember(userId: string): Member {
  return {
    id: -1,
    user_id: userId,
    profiles: {
      id: userId,
      email: "Unknown User",
      is_anonymous: false,
      metadata: { avatar_url: "", username: "unknown", email: "Unknown User" },
      phone: null,
    },
    roles: [],
    created_at: new Date().toISOString(),
    lastActivity: "",
  };
}

function useMembers() {
  const { teamSlug } = useParams();
  const {
    data: { members: _members },
  } = useTeamMembersBySlug(teamSlug ?? null);
  const user = useUser();

  const members = useMemo(() => {
    return _members?.length ? _members : [userToMember(user)];
  }, [_members, user]);

  return members;
}

/**
 * Returns all current team members, but also accepts a list of user ids
 * and ensures that those users are included in the list,
 * even as unknown users.
 */
export function useMembersWithUnknownUsers({
  userIdsToEnsureExist,
}: {
  userIdsToEnsureExist: string[];
}) {
  const members = useMembers();

  const allUsers = useMemo(() => {
    const userMap = new Map<string, Member>();

    // Add existing team members to the map
    members.forEach((member) => {
      userMap.set(member.profiles.id, member);
    });

    // Add additional users who weren't found as team members
    userIdsToEnsureExist.forEach((userId) => {
      if (!userMap.has(userId)) {
        userMap.set(userId, createUnknownMember(userId));
      }
    });

    return Array.from(userMap.values());
  }, [members, userIdsToEnsureExist]);

  return allUsers;
}
