import { useRuntime } from "@deco/sdk";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@deco/ui/components/sidebar.tsx";
import { useGlobalState } from "../../stores/global.tsx";
import { Avatar } from "../common/Avatar.tsx";

const TeamSwitcher = () => {
  const { state: { user } } = useGlobalState();
  const { state: { context } } = useRuntime();

  const userAvatarURL = user?.metadata?.avatar_url ?? undefined;
  const userName = user?.metadata?.full_name || user?.email;

  const currentAvatarURL = context?.type === "team" ? undefined : userAvatarURL;
  const currentName = context?.type === "team" ? context?.slug : userName;

  if (!context) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="gap-0">
          <Avatar
            url={currentAvatarURL}
            fallback={currentName}
            className="w-6 h-6"
          />

          <span className="text-xs truncate ml-2">
            {currentName}
          </span>
          <Icon name="unfold_more" className="text-xs ml-1" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {context.type === "team" && (
          <DropdownMenuItem className="gap-3">
            <Avatar fallback={context.slug} />
            <span className="text-xs">{context.slug}</span>
            {context.type === "team" && (
              <Icon name="check" className="text-xs" />
            )}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="gap-3"
          // TODO (@gimenes): use navigate instead of globalThis.location.href
          // Some bugs are happening when using navigate
          onClick={() => globalThis.location.href = "/~"}
        >
          <Avatar
            className="rounded-full"
            url={userAvatarURL}
            fallback={userName}
          />
          <span className="text-xs">{userName}</span>
          {context.type === "user" && <Icon name="check" className="text-xs" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export function Header() {
  const { state: { user } } = useGlobalState();

  const userAvatarURL = user?.metadata?.avatar_url ?? undefined;
  const userName = user?.metadata?.full_name || user?.email;

  return (
    <SidebarHeader className="h-14 py-2 flex flex-row items-center">
      {
        /* <div
        className={cn(
          "flex items-center h-14 py-2 gap-2 max-w-full bg-slate-100 relative group",
          showSidebar ? "justify-between px-2" : "justify-center px-1",
        )}
      >
        {showSidebar ? <TeamSwitcher /> : (
          <Avatar
            className="rounded-full"
            url={userAvatarURL}
            fallback={userName}
            size="xs"
          />
        )}
      </div> */
      }

      <SidebarMenu>
        <SidebarMenuItem className="flex flex-row items-center gap-2">
          <TeamSwitcher />
          <SidebarTrigger />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}
