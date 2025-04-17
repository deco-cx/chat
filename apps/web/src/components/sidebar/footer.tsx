import { AUTH_URL } from "@deco/sdk";
import {
  ResponsiveDropdown,
  ResponsiveDropdownContent,
  ResponsiveDropdownItem,
  ResponsiveDropdownSeparator,
  ResponsiveDropdownTrigger,
} from "@deco/ui/components/responsive-dropdown.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  SidebarFooter as SidebarFooterInner,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@deco/ui/components/sidebar.tsx";
import { Suspense, useMemo } from "react";
import { Link, useLocation } from "react-router";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { NotLoggedInError, useUser } from "../../hooks/data/useUser.ts";
import { useGitHubStars } from "../../hooks/useGitHubStars.ts";
import { Avatar } from "../common/Avatar.tsx";
import { trackEvent } from "../../hooks/analytics.ts";

function LoggedUser() {
  const user = useUser();
  const location = useLocation();
  const { data: stars } = useGitHubStars();

  const logoutUrl = useMemo(() => {
    const url = new URL(AUTH_URL);
    url.pathname = "/auth/logout";

    const next = new URL(location.pathname, globalThis.location.origin);
    url.searchParams.set("next", next.href);

    return url.href;
  }, [location.pathname]);

  const handleWalletClick = () => {
    trackEvent("sidebar_wallet_click", {
      userId: user?.id,
    });
  };

  const userAvatarURL = user?.metadata?.avatar_url ?? undefined;
  const userName = user?.metadata?.full_name || user?.email;
  const formattedStars = stars
    ? (stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars)
    : null;

  return (
    <ResponsiveDropdown>
      <ResponsiveDropdownTrigger asChild>
        <SidebarMenuButton className="cursor-pointer gap-2">
          <Avatar
            url={userAvatarURL}
            fallback={userName}
            className="w-6 h-6"
          />
          <span className="text-xs">{user.metadata?.full_name}</span>
        </SidebarMenuButton>
      </ResponsiveDropdownTrigger>
      <ResponsiveDropdownContent
        side="top"
        align="start"
        className="md:w-[200px] text-slate-700"
      >
        <ResponsiveDropdownItem asChild>
          <Link
            to="/wallet"
            className="flex items-center gap-2 leading-7 text-sm sm:text-xs"
            onClick={handleWalletClick}
          >
            <Icon name="wallet" />
            Wallet
          </Link>
        </ResponsiveDropdownItem>
        <ResponsiveDropdownSeparator />
        <ResponsiveDropdownItem asChild>
          <a
            href="https://github.com/deco-cx/chat"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 leading-relaxed text-sm sm:text-xs"
          >
            <img src="/img/github.svg" alt="GitHub" className="w-4 h-4" />
            deco-cx/chat
            {formattedStars && (
              <span className="ml-auto text-slate-400">
                {formattedStars} stars
              </span>
            )}
          </a>
        </ResponsiveDropdownItem>

        <ResponsiveDropdownSeparator />

        <ResponsiveDropdownItem asChild>
          <a
            href={logoutUrl}
            className="flex items-center gap-2 leading-relaxed text-sm sm:text-xs"
          >
            <Icon name="logout" size={16} />
            Log out
          </a>
        </ResponsiveDropdownItem>
      </ResponsiveDropdownContent>
    </ResponsiveDropdown>
  );
}

function AnonymouseUser() {
  const to = `/login?next=${globalThis?.location?.href}`;

  return (
    <SidebarMenuButton>
      <Link to={to}>
        <Icon name="person" size={16} />
        Sign in
      </Link>
    </SidebarMenuButton>
  );
}

function Skeleton() {
  return (
    <SidebarMenuButton>
      <div className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-slate-100 hover:text-slate-900 h-8 px-4 py-2 gap-2">
        <span className="w-24 h-8"></span>
      </div>
    </SidebarMenuButton>
  );
}

export function SidebarFooter() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ErrorBoundary
        shouldCatch={(error) => error instanceof NotLoggedInError}
        fallback={<AnonymouseUser />}
      >
        <SidebarFooterInner>
          <SidebarMenu>
            <SidebarMenuItem>
              <LoggedUser />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooterInner>
      </ErrorBoundary>
    </Suspense>
  );
}
