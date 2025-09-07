import {
  type Prompt,
  type PromptVersion,
  renamePromptVersion,
  type TeamMember,
  usePromptVersions,
  type User,
  useSDK,
  useTeamMembers,
  useTeams,
  useUpdatePrompt,
  type Workspace,
} from "@deco/sdk";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@deco/ui/components/avatar.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { UseFormReturn } from "react-hook-form";
import { useParams } from "react-router";
import { useUser } from "../../../hooks/use-user.ts";
import { useFormContext } from "./context.ts";

export default function HistoryTab() {
  const { id } = useParams();
  const { workspace } = useSDK();
  const { data: versions, refetch } = usePromptVersions(id ?? "");
  const { form, prompt, setSelectedPrompt, promptVersion, setPromptVersion } =
    useFormContext();

  const user = useUser();
  const params = useParams();
  const resolvedTeamSlug = params.teamSlug;
  const { data: teams } = useTeams();
  const teamId = useMemo(
    () => teams?.find((t) => t.slug === resolvedTeamSlug)?.id ?? null,
    [teams, resolvedTeamSlug],
  );
  const {
    data: { members: teamMembers = [] },
  } = useTeamMembers(teamId ?? null);

  const filteredVersions = useMemo(() => {
    return versions?.slice(1);
  }, [versions, promptVersion]);

  const teamMembersMap = useMemo(() => {
    if (!teamMembers.length) return new Map();
    return new Map(teamMembers.map((member) => [member.user_id, member]));
  }, [teamMembers]);

  return (
    <div className="flex flex-col py-1">
      <div className="relative">
        <div className="flex flex-col relative z-10">
          <div
            className={`flex items-center gap-6 h-[64px] group relative hover:bg-muted rounded-md px-6 cursor-pointer ${
              !promptVersion ? "bg-muted" : ""
            }`}
            onClick={() => {
              setPromptVersion(null);
              setSelectedPrompt({
                ...prompt,
                name: versions[0]?.name ?? "",
                content: versions[0]?.content ?? "",
                readonly: false,
              });
            }}
          >
            <div className="flex flex-col justify-end items-center gap-2 h-[64px]">
              {versions.length > 1 && (
                <div
                  className="w-[2px] bg-border b z-0 h-[36px] mt-1"
                  style={{ minHeight: 36, pointerEvents: "none" }}
                />
              )}
              <span className="w-6 h-6 bg-foreground rounded-full absolute top-1/2 -translate-y-1/2 flex items-center justify-center">
                <span className="w-4 h-4 bg-background rounded-full flex items-center justify-center">
                  <span className="w-3 h-3 bg-foreground rounded-full flex items-center justify-center">
                    <span className="w-2 h-2 bg-background rounded-full flex items-center justify-center">
                      <span className="w-1 h-1 bg-foreground rounded-full flex items-center justify-center"></span>
                    </span>
                  </span>
                </span>
              </span>
            </div>
            <span className="font-semibold text-sm">
              {versions[0]?.version_name || "Current Version"}
            </span>
          </div>
          {filteredVersions.map((version, idx) => {
            return (
              <HistoryCard
                key={version.id}
                version={version}
                form={form}
                idx={idx}
                length={filteredVersions.length}
                user={user}
                teamMembersMap={teamMembersMap}
                workspace={workspace}
                teamId={teamId}
                refetch={refetch}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function HistoryCard({
  version,
  user,
  idx,
  length,
  refetch,
  teamId,
  teamMembersMap,
  workspace,
}: {
  version: PromptVersion;
  form: UseFormReturn<Prompt>;
  user: User;
  idx: number;
  length: number;
  teamId: number | null;
  teamMembersMap: Map<string, TeamMember>;
  workspace: Workspace;
  refetch: () => void;
}) {
  const updatePrompt = useUpdatePrompt();
  const [isEditing, setIsEditing] = useState(false);
  const [versionName, setVersionName] = useState(version.version_name);
  const inputRef = useRef<HTMLInputElement>(null);

  const { prompt, setSelectedPrompt, promptVersion, setPromptVersion } =
    useFormContext();

  const handleStartEditing = () => {
    flushSync(() => {
      setIsEditing(true);
    });
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const handleSaveLabel = async () => {
    if (versionName === version.version_name || !versionName) {
      setIsEditing(false);
      return;
    }

    await renamePromptVersion(workspace, {
      id: version.id,
      versionName,
    });
    refetch();
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveLabel();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  const userId = version.created_by || "";

  const isCurrentUser = userId && user && userId === user.id;

  const member =
    !isCurrentUser && teamId !== null ? teamMembersMap.get(userId) : undefined;

  const avatarUrl = isCurrentUser
    ? user.metadata.avatar_url
    : member?.profiles?.metadata?.avatar_url;
  const userName = isCurrentUser
    ? user.metadata.full_name
    : member?.profiles?.metadata?.full_name;

  const handleRestoreVersion = async () => {
    await updatePrompt.mutateAsync({
      id: prompt.id,
      data: {
        name: version?.name ?? "",
        content: version?.content ?? "",
      },
      versionName: version?.version_name ?? "",
    });
    setPromptVersion(null);
  };

  return (
    <div
      key={version.id}
      className={cn(
        "flex items-center h-[64px] group relative hover:bg-muted rounded-md px-6 cursor-pointer",
        promptVersion === version.id ? "bg-muted" : "",
      )}
      onClick={() => {
        setSelectedPrompt({
          ...prompt,
          name: version.name ?? "",
          content: version.content,
          readonly: true,
        });
        setPromptVersion(version.id);
      }}
    >
      <div className="flex flex-col justify-center items-center gap-2 h-full relative">
        <div
          className={cn(
            "w-[2px] bg-border b z-0 h-full",
            idx === length - 1 ? "h-[36px] mt-[-28px]" : "",
          )}
          style={{ minHeight: 36, pointerEvents: "none" }}
        />
        <span className="w-2 h-2 bg-foreground rounded-full absolute mt-2 -translate-y-1/2"></span>
      </div>
      <div className="flex-1 flex items-center gap-2 pl-6 pr-2">
        <div className="flex flex-col justify-start items-start gap-2">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={versionName || ""}
              onChange={(e) => setVersionName(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e)}
              onBlur={handleSaveLabel}
              className="text-sm font-semibold border-none outline-none focus:ring-0 p-0 px-1 bg-white"
              placeholder="Enter version label..."
            />
          ) : (
            <span
              className="text-sm font-semibold cursor-pointer hover:bg-muted px-1 py-0.5 rounded"
              onClick={() => handleStartEditing()}
            >
              {version.version_name ||
                new Date(version.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
            </span>
          )}
          <div className="flex items-center gap-1">
            <Avatar className="size-4">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={userName} />
              ) : (
                <AvatarFallback className="text-xs">
                  {userName
                    ?.split(" ")
                    .map((n: string) => n[0])
                    .join("")}
                </AvatarFallback>
              )}
            </Avatar>
            <span className="text-xs text-muted-foreground font-normal">
              {userName}
            </span>
          </div>
        </div>

        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6 p-0 ml-1">
              <Icon name="more_vert" size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                handleStartEditing();
              }}
            >
              <Icon name="border_color" size={12} />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                handleRestoreVersion();
              }}
            >
              <Icon name="replay" size={12} />
              Restore this version
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
