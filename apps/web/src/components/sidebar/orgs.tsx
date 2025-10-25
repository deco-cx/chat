import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@deco/ui/components/sidebar.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Suspense } from "react";
import { useNavigateOrg } from "../../hooks/use-navigate-workspace.ts";
import { SidebarFooter } from "./footer.tsx";

function OrgViews() {
  const navigateOrg = useNavigateOrg();

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateOrg("/");
          }}
        >
          <Icon name="folder" size={20} className="text-muted-foreground/75" />
          <span className="truncate">Projects</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateOrg("/members");
          }}
        >
          <Icon name="group" size={20} className="text-muted-foreground/75" />
          <span className="truncate">Members</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateOrg("/billing");
          }}
        >
          <Icon name="wallet" size={20} className="text-muted-foreground/75" />
          <span className="truncate">Billing</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateOrg("/models");
          }}
        >
          <Icon
            name="network_intelligence"
            size={20}
            className="text-muted-foreground/75"
          />
          <span className="truncate">Models</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateOrg("/usage");
          }}
        >
          <Icon
            name="monitoring"
            size={20}
            className="text-muted-foreground/75"
          />
          <span className="truncate">Usage</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateOrg("/theme-editor");
          }}
        >
          <Icon name="palette" size={20} className="text-muted-foreground/75" />
          <span className="truncate">Theme</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateOrg("/settings");
          }}
        >
          <Icon
            name="settings"
            size={20}
            className="text-muted-foreground/75"
          />
          <span className="truncate">Settings</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  );
}

OrgViews.Skeleton = () => (
  <div className="flex flex-col gap-0.5">
    {Array.from({ length: 20 }).map((_, index) => (
      <div key={index} className="w-full h-8">
        <Skeleton className="h-full bg-sidebar-accent rounded-md" />
      </div>
    ))}
  </div>
);

export function OrgsSidebar() {
  return (
    <Sidebar variant="sidebar">
      <SidebarContent className="flex-1 overflow-x-hidden">
        <SidebarGroup className="font-medium">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <Suspense fallback={<OrgViews.Skeleton />}>
                <OrgViews />
              </Suspense>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
