import type { Agent } from "@deco/sdk";
import { useSDK, useTeams } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { RadioGroup, RadioGroupItem } from "@deco/ui/components/radio-group.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useState } from "react";
import { useNavigate } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useUser } from "../../hooks/use-user.ts";
import { Avatar } from "../common/avatar/index.tsx";
import { useCopyAgentToWorkspace } from "./hooks.ts";

interface WorkspaceOption {
  id: string;
  label: string;
  slug: string;
  isPersonal: boolean;
  avatarUrl?: string;
}

export function CopyAgentDialog({ 
  agent, 
  open, 
  onOpenChange 
}: {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspace: currentWorkspace } = useSDK();
  const { data: teams } = useTeams();
  const user = useUser();
  const navigate = useNavigate();
  const { copyAgent, isLoading } = useCopyAgentToWorkspace();
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");

  if (!agent) return null;

  // Get current workspace slug from the workspace context
  const currentWorkspaceSlug = currentWorkspace.startsWith("shared/") 
    ? currentWorkspace.replace("shared/", "")
    : "";

  // Build workspace options
  const userTeam: WorkspaceOption = {
    id: user?.id || "",
    label: `${user?.metadata?.full_name?.split(" ")[0] || user?.email}'s team`,
    slug: "",
    isPersonal: true,
    avatarUrl: user?.metadata?.avatar_url,
  };

  const workspaceOptions: WorkspaceOption[] = [
    userTeam,
    ...teams.map((team) => ({
      id: team.id.toString(),
      label: team.name,
      slug: team.slug,
      isPersonal: false,
    })),
  ].filter((option) => 
    // Exclude current workspace
    (option.slug || "personal") !== (currentWorkspaceSlug || "personal")
  );

  const handleCopy = async () => {
    if (!selectedWorkspace || !agent) return;

    const targetWorkspace = workspaceOptions.find(w => w.id === selectedWorkspace);
    if (!targetWorkspace) return;

    try {
      await copyAgent(agent, targetWorkspace);
      
      trackEvent("agent_copy_workspace", {
        success: true,
        sourceWorkspace: currentWorkspace,
        targetWorkspace: targetWorkspace.isPersonal 
          ? `users/${user?.id}` 
          : `shared/${targetWorkspace.slug}`,
      });

      // Navigate to target workspace
      if (targetWorkspace.isPersonal) {
        navigate("/agents");
      } else {
        navigate(`/${targetWorkspace.slug}/agents`);
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Error copying agent:", error);
      trackEvent("agent_copy_workspace", {
        success: false,
        error,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy Agent to Workspace</DialogTitle>
          <DialogDescription>
            Choose where to copy "{agent.name}". The agent and its configuration will be duplicated to the selected workspace.
          </DialogDescription>
        </DialogHeader>

        {workspaceOptions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Icon name="info" className="mx-auto mb-2" size={24} />
            <p>No other workspaces available.</p>
            <p className="text-sm">You need access to multiple teams to copy agents between workspaces.</p>
          </div>
        ) : (
          <RadioGroup
            value={selectedWorkspace}
            onValueChange={setSelectedWorkspace}
            className="gap-3"
          >
            {workspaceOptions.map((workspace) => (
              <div key={workspace.id} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value={workspace.id} id={workspace.id} />
                <Label 
                  htmlFor={workspace.id} 
                  className="flex items-center gap-3 cursor-pointer flex-1"
                >
                  <Avatar
                    url={workspace.avatarUrl}
                    fallback={workspace.label}
                    className="w-8 h-8"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{workspace.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {workspace.isPersonal ? "Personal workspace" : "Team workspace"}
                    </span>
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCopy} 
            disabled={!selectedWorkspace || isLoading || workspaceOptions.length === 0}
          >
            {isLoading ? (
              <>
                <Spinner size="xs" />
                <span className="ml-2">Copying...</span>
              </>
            ) : (
              <>
                <Icon name="content_copy" className="mr-2" size={16} />
                Copy Agent
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}