import { SidebarInset } from "@deco/ui/components/sidebar.tsx";
import { Outlet } from "react-router";
import { AppSidebar } from "./sidebar/index.tsx";
import { Topbar } from "./topbar/index.tsx";

export function Layout() {
  return (
    <>
      <AppSidebar />
      <SidebarInset className="px-4 py-2 h-full flex flex-col gap-4">
        <Topbar />
        <Outlet />
      </SidebarInset>
    </>
  );
}
