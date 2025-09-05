import { useLocalStorage } from "../../hooks/use-local-storage";
import { useState } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarInset,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenuButton,
} from "@deco/ui/components/sidebar.tsx";
import { LoggedUser } from "../sidebar/footer";
import { DecoQueryClientProvider } from "@deco/sdk";
import { Link, Outlet } from "react-router";
import { Icon } from "@deco/ui/components/icon.tsx";

export function HomeLayout() {
  const { value: defaultOpen, update: setDefaultOpen } = useLocalStorage({
    key: "deco-chat-sidebar",
    defaultValue: true,
  });
  const [open, setOpen] = useState(defaultOpen);

  return (
    <DecoQueryClientProvider>
      <SidebarProvider
        open={open}
        onOpenChange={(open) => {
          setDefaultOpen(open);
          setOpen(open);
        }}
        className="h-full bg-sidebar"
        style={
          {
            "--sidebar-width": "16rem",
            "--sidebar-width-mobile": "14rem",
          } as Record<string, string>
        }
      >
        <Sidebar variant="sidebar">
          <SidebarContent className="flex flex-col h-full overflow-x-hidden">
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-none">
                <SidebarGroup className="font-medium">
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0">
                      <SidebarMenuItem>
                        <SidebarMenuButton className="cursor-pointer" asChild>
                          <Link to="/">
                            <Icon
                              name="home"
                              size={18}
                              className="text-muted-foreground/75"
                            />
                            <span className="truncate">Home</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </div>
            </div>

            <SidebarFooter className="mt-auto">
              <SidebarMenu>
                <SidebarMenuItem>
                  <LoggedUser />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="h-full flex-col bg-sidebar">
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </DecoQueryClientProvider>
  );
}
