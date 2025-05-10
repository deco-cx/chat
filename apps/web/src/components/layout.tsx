import { SDKProvider, Workspace } from "@deco/sdk";
import { SidebarInset, SidebarProvider } from "@deco/ui/components/sidebar.tsx";
import { PropsWithChildren, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Toaster } from "@deco/ui/components/sonner.tsx";
import { Outlet, useParams } from "react-router";
import { lazy, Suspense } from "react";
import { useUser } from "../hooks/data/useUser.ts";
import { AppSidebar } from "./sidebar/index.tsx";
import { SettingsSidebar } from "./sidebar/settings.tsx";
const RegisterActivity = lazy(() => import("./common/RegisterActivity.tsx"));

export const WorkspaceSettingsLayout = () => (
  <Layout sidebar={<SettingsSidebar />} />
);

export function HeaderSlot(
  { position, children }: PropsWithChildren<{ position: "start" | "end" }>,
) {
  const targetElement = document.getElementById(`chat-header-${position}-slot`);

  if (!targetElement) {
    return null;
  }

  return createPortal(
    children,
    targetElement,
  );
}

export function Header() {
  return (
    <div className="bg-slate-50 flex items-center justify-between">
      <div id="chat-header-start-slot" className="pt-1 pb-3 empty:p-0" />
      <div id="chat-header-end-slot" className="pt-1 pb-3 empty:p-0" />
    </div>
  );
}

export function Layout(
  { sidebar, header }: { sidebar?: ReactNode; header?: ReactNode },
) {
  const { teamSlug } = useParams();
  const user = useUser();

  const rootContext: Workspace = teamSlug
    ? `shared/${teamSlug}`
    : `users/${user?.id}`;

  return (
    <SidebarProvider
      className="h-full bg-slate-50"
      style={{
        "--sidebar-width": "16rem",
        "--sidebar-width-mobile": "14rem",
      } as Record<string, string>}
    >
      <SDKProvider workspace={rootContext}>
        {sidebar ?? <AppSidebar />}
        <SidebarInset className="h-full flex-col p-2 bg-slate-50">
          {header ?? <Header />}
          <div className="h-full bg-background rounded-xl shadow-md overflow-hidden">
            <Outlet />
          </div>
        </SidebarInset>
        <Suspense fallback={null}>
          <RegisterActivity teamSlug={teamSlug} />
        </Suspense>
        <Toaster />
      </SDKProvider>
    </SidebarProvider>
  );
}
