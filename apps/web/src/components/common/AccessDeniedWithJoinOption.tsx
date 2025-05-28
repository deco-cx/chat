import { useState } from "react";
import { useLocation, useParams } from "react-router";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { ComponentProps, ReactNode } from "react";
import { useUser } from "../../hooks/data/useUser.ts";
import { useAutoJoinTeam } from "@deco/sdk";

export function AccessDeniedWithJoinOption({
  icon,
  title,
  description,
  buttonProps,
}: {
  icon: string;
  title: string;
  description: string | ReactNode;
  buttonProps: ComponentProps<typeof Button>;
}) {
  const { teamSlug } = useParams<{ teamSlug?: string }>();
  const location = useLocation();
  const user = useUser();
  const autoJoinMutation = useAutoJoinTeam();
  const [isJoining, setIsJoining] = useState(false);

  // Check if user has @deco.cx email and we're in a team context
  const isDecoUser = user?.email?.endsWith("@deco.cx");
  const isTeamContext = teamSlug && location.pathname.includes(`/${teamSlug}/`);
  const showJoinButton = isDecoUser && isTeamContext;

  const handleJoinTeam = async () => {
    if (!teamSlug) return;
    
    setIsJoining(true);
    try {
      await autoJoinMutation.mutateAsync(teamSlug);
      toast.success("Successfully joined team! Refreshing page...");
      
      // Refresh the page to grant access
      setTimeout(() => {
        globalThis.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Failed to join team:", error);
      toast.error("Failed to join team. Please try again or contact support.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 relative">
      <div className="absolute flex items-center justify-center mb-80">
        <div className="p-6 rounded-full border border-slate-50">
          <div className="p-4 rounded-full border border-slate-100">
            <div className="p-3.5 rounded-full border border-slate-100">
              <div className="p-3 rounded-full border border-slate-100">
                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center p-4">
                  <Icon name={icon} className="text-slate-300" size={36} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 max-w-md z-10">
        <h3 className="text-2xl font-semibold text-foreground text-center">
          {title}
        </h3>
        <div className="text-sm text-muted-foreground text-center flex flex-col gap-1">
          {description}
        </div>
      </div>

      <div className="flex flex-col gap-2 z-10">
        {showJoinButton && (
          <Button
            onClick={handleJoinTeam}
            disabled={isJoining}
            variant="default"
            size="default"
            className="gap-2"
          >
            {isJoining ? (
              <>
                <Icon name="loader-2" className="animate-spin" size={16} />
                Joining Team...
              </>
            ) : (
              <>
                <Icon name="users" size={16} />
                Join Team
              </>
            )}
          </Button>
        )}
        <Button
          variant="outline"
          size="default"
          className={cn("gap-2", buttonProps?.className)}
          {...buttonProps}
        />
      </div>
    </div>
  );
}