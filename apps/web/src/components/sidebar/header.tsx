import { Button } from "@deco/ui/components/button.tsx";
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
    <SidebarHeader className="md:h-14 h-12 py-0 flex flex-row items-center px-4 md:px-3">
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center justify-between">
          <TeamSelector />

          <SidebarMenuButton asChild>
            <Button
              data-open={open}
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="size-8"
            >
              <Icon
                name={isMobile ? "menu" : "dock_to_right"}
                size={16}
                className="text-muted-foreground"
              />
            </Button>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}
