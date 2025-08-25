import { Icon } from "@deco/ui/components/icon.tsx";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { TeamSelector } from "./team-selector.tsx";

export function Header() {
  const { toggleSidebar, open, isMobile } = useSidebar();

  return (
    <SidebarHeader className="py-0 flex flex-row items-center px-2">
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center justify-between">
          <TeamSelector />

          <SidebarMenuButton
            data-open={open}
            onClick={toggleSidebar}
            className="size-8 p-1.5 flex items-center justify-center"
          >
            <Icon
              name={isMobile ? "menu" : "dock_to_right"}
              size={18}
              className="text-muted-foreground/75"
            />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}
