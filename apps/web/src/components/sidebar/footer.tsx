import {
  DECO_CMS_API_URL,
  useInvites,
  usePlan,
  User,
  useWorkspaceWalletBalance,
  WELL_KNOWN_PLANS,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  ResponsiveDropdown,
  ResponsiveDropdownContent,
  ResponsiveDropdownItem,
  ResponsiveDropdownSeparator,
  ResponsiveDropdownTrigger,
} from "@deco/ui/components/responsive-dropdown.tsx";
import {
  SidebarFooter as SidebarFooterInner,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@deco/ui/components/sidebar.tsx";
import { Switch } from "@deco/ui/components/switch.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Suspense, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useMatch } from "react-router";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { trackEvent } from "../../hooks/analytics.ts";
import { useGitHubStars } from "../../hooks/use-github-stars.ts";
import {
  UserPreferences,
  userPreferencesLabels,
  useUserPreferences,
} from "../../hooks/use-user-preferences.ts";
import { useUser } from "../../hooks/use-user.ts";
import { ModelSelector } from "../chat/model-selector.tsx";
import { UserAvatar } from "../common/avatar/user.tsx";
import { ProfileSettings } from "../settings/profile.tsx";
import { useOrgLink } from "../../hooks/use-navigate-workspace.ts";
import { PlanIcons } from "../../utils/plan-icons.tsx";

/** Wrapped component to be suspended */
function NotificationDot({ className }: { className?: string }) {
  const { data: invites = [] } = useInvites();

  if (!invites.length) return null;

  return (
    <span className={cn("relative flex size-2", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-destructive" />
    </span>
  );
}

/** Wrapped component to be suspended */
function InvitesCount() {
  const { data: invites = [] } = useInvites();

  if (!invites.length) return null;

  return (
    <span className="absolute right-2 top-1/2 -mt-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
      {invites.length}
    </span>
  );
}

function UserPreferencesModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { preferences, setPreferences } = useUserPreferences();
  const form = useForm({
    defaultValues: {
      defaultModel: preferences.defaultModel,
      useOpenRouter: preferences.useOpenRouter,
      sendReasoning: preferences.sendReasoning,
      pdfSummarization: preferences.pdfSummarization,
    },
  });
  const {
    handleSubmit,
    formState: { isDirty },
  } = form;

  function onSubmit(data: Omit<UserPreferences, "showDecopilot">) {
    setPreferences({
      ...preferences,
      ...data,
    });
    form.reset(data);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>User Preferences</DialogTitle>
          <DialogDescription>
            These will only apply to your user.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-6 py-2"
          >
            {/* Outside of project context, this throws because ModelSelector depends on the SDK context. */}
            <ErrorBoundary fallback={null}>
              <FormField
                name="defaultModel"
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-center items-start gap-2">
                    <div className="flex items-center gap-2">
                      <FormLabel>Default Model</FormLabel>
                      <FormControl>
                        <ModelSelector
                          model={field.value}
                          onModelChange={field.onChange}
                        />
                      </FormControl>
                    </div>
                    <FormDescription>
                      Choose the default AI model for new chats.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </ErrorBoundary>
            {Object.entries(userPreferencesLabels).map(([key, value]) => (
              <FormField
                name={key}
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-center items-start gap-2">
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Switch
                          id={key}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>{value.label}</FormLabel>
                    </div>
                    <FormDescription>{value.description}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={!isDirty}>
                Save Preferences
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function LoggedUserSidebarTrigger({ user }: { user: User }) {
  const userAvatarURL = user?.metadata?.avatar_url ?? undefined;
  const userName = user?.metadata?.full_name || user?.email;

  return (
    <SidebarMenuButton className="cursor-pointer gap-3 group-data-[collapsible=icon]:px-1! group-data-[collapsible=icon]:py-2!">
      <UserAvatar url={userAvatarURL} fallback={userName} size="xs" />
      <span className="text-sm grow">{user.metadata?.full_name}</span>

      <Suspense fallback={null}>
        <div className="size-3 flex items-center">
          <NotificationDot className="justify-end" />
        </div>
      </Suspense>
    </SidebarMenuButton>
  );
}

export function LoggedUserAvatarTrigger({ user }: { user: User }) {
  return (
    <UserAvatar
      url={user?.metadata?.avatar_url}
      fallback={user?.metadata?.full_name || user?.email}
      size="sm"
      className="cursor-pointer hover:ring-2 ring-muted-foreground transition-all"
    />
  );
}

export function LoggedUser({
  trigger,
  align = "start",
}: {
  trigger: (user: User) => React.ReactNode;
  align?: "start" | "end";
}) {
  const user = useUser();
  const location = useLocation();
  const href = "/invites";
  const match = useMatch(href);
  const { data: stars } = useGitHubStars();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const logoutUrl = useMemo(() => {
    const url = new URL(DECO_CMS_API_URL);
    url.pathname = "/auth/logout";

    const next = new URL(location.pathname, globalThis.location.origin);
    url.searchParams.set("next", next.href);

    return url.href;
  }, [location.pathname]);

  const formattedStars = stars
    ? stars >= 1000
      ? `${(stars / 1000).toFixed(1)}k`
      : stars
    : null;

  const handleClickInvite = () => {
    trackEvent("sidebar_navigation_click", {
      item: "Invites",
    });
  };

  return (
    <ResponsiveDropdown>
      <ResponsiveDropdownTrigger asChild>
        <div>{trigger(user)}</div>
      </ResponsiveDropdownTrigger>
      <ResponsiveDropdownContent
        side="top"
        align={align}
        className="md:w-[240px]"
      >
        <ResponsiveDropdownItem asChild>
          <button
            type="button"
            className="flex items-center gap-2 text-sm w-full cursor-pointer"
            onClick={() => setProfileOpen(true)}
          >
            <Icon name="account_circle" className="text-muted-foreground" />
            Profile
          </button>
        </ResponsiveDropdownItem>
        <ResponsiveDropdownItem asChild>
          <button
            type="button"
            className="flex items-center gap-2 text-sm w-full cursor-pointer"
            onClick={() => setPreferencesOpen(true)}
          >
            <Icon name="tune" className="text-muted-foreground" />
            Preferences
          </button>
        </ResponsiveDropdownItem>
        <ResponsiveDropdownItem asChild>
          <Link
            to={href}
            onClick={handleClickInvite}
            className="flex items-center gap-2 text-sm w-full cursor-pointer"
          >
            <Icon
              name="mail"
              filled={!!match}
              className="text-muted-foreground"
            />
            <span className="truncate">Invites</span>

            <Suspense fallback={null}>
              <InvitesCount />
            </Suspense>
          </Link>
        </ResponsiveDropdownItem>

        <ResponsiveDropdownSeparator />

        <ResponsiveDropdownItem asChild>
          <a
            href="https://github.com/deco-cx/chat"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-2 text-sm cursor-pointer"
          >
            <img
              src="/img/github.svg"
              alt="GitHub"
              className="w-4 h-4 text-muted-foreground"
            />
            deco-cx/chat
            {formattedStars && (
              <span className="text-xs ml-auto text-muted-foreground">
                {formattedStars} stars
              </span>
            )}
            <Icon
              name="arrow_outward"
              size={18}
              className="text-muted-foreground"
            />
          </a>
        </ResponsiveDropdownItem>
        <ResponsiveDropdownItem asChild>
          <a
            href="https://decocms.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-2 text-sm cursor-pointer"
          >
            <Icon name="language" className="text-muted-foreground" />
            Homepage
            <Icon
              name="arrow_outward"
              size={18}
              className="ml-auto text-muted-foreground"
            />
          </a>
        </ResponsiveDropdownItem>

        <ResponsiveDropdownSeparator />

        <ResponsiveDropdownItem asChild>
          <a
            href={logoutUrl}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <Icon name="logout" size={18} className="text-muted-foreground" />
            Log out
          </a>
        </ResponsiveDropdownItem>
      </ResponsiveDropdownContent>
      {profileOpen && (
        <ProfileSettings open={profileOpen} onOpenChange={setProfileOpen} />
      )}
      {preferencesOpen && (
        <UserPreferencesModal
          open={preferencesOpen}
          onOpenChange={setPreferencesOpen}
        />
      )}
    </ResponsiveDropdown>
  );
}

const PlanColors = {
  [WELL_KNOWN_PLANS.FREE]: {
    background:
      "bg-primary-light/30 hover:bg-primary-light/50 text-primary-dark",
    sprite: "text-primary-light",
  },
  [WELL_KNOWN_PLANS.STARTER]: {
    background:
      "bg-primary-light/30 hover:bg-primary-light/50 text-primary-dark",
    sprite: "text-primary-light",
  },
  [WELL_KNOWN_PLANS.GROWTH]: {
    background: "bg-yellow-light/30 hover:bg-yellow-light/50 text-yellow-dark",
    sprite: "text-yellow-light",
  },
  [WELL_KNOWN_PLANS.SCALE]: {
    background: "bg-purple-light/30 hover:bg-purple-light/50 text-purple-dark",
    sprite: "text-purple-light",
  },
};

/**
 * Very small team balance label to be shown above the user menu in the sidebar footer.
 */
function TeamPlanAndBalance() {
  const plan = usePlan();
  const account = useWorkspaceWalletBalance();
  const orgLink = useOrgLink();

  if (!account?.balance) return null;

  const planColor = PlanColors[plan.id] ?? PlanColors[WELL_KNOWN_PLANS.SCALE];
  const PlanIcon = PlanIcons[plan.id] ?? PlanIcons[WELL_KNOWN_PLANS.SCALE];

  return (
    <Link
      to={orgLink("/billing")}
      className={cn(
        "relative flex flex-col gap-1 p-0.5 rounded-xl w-full transition-colors overflow-hidden",
        planColor.background,
      )}
    >
      <svg
        width="192"
        height="64"
        viewBox="0 0 192 64"
        className={cn("absolute top-0 left-0 z-10", planColor.sprite)}
      >
        <use href="/img/galaxy-sprite.svg" />
      </svg>
      <div className="z-20 text-xs flex items-center gap-1 uppercase px-2 py-1">
        <PlanIcon />
        {plan.title} PLAN
      </div>
      <div className="z-20 flex items-center justify-between px-2 h-9 rounded-xl w-full text-sm bg-sidebar-accent">
        <span className="text-sidebar-foreground">Team Balance</span>
        <span className="text-muted-foreground">{account.balance}</span>
      </div>
    </Link>
  );
}

function Skeleton() {
  return (
    <SidebarMenuButton>
      <div className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-muted hover:text-foreground h-8 px-4 py-2 gap-2">
        <span className="w-24 h-8"></span>
      </div>
    </SidebarMenuButton>
  );
}

export function SidebarFooter({ className }: { className?: string }) {
  return (
    <SidebarFooterInner className={cn("bg-sidebar pt-4", className)}>
      <SidebarMenu>
        <SidebarMenuItem>
          <Suspense fallback={<Skeleton />}>
            <ErrorBoundary fallback={null}>
              <TeamPlanAndBalance />
            </ErrorBoundary>
          </Suspense>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooterInner>
  );
}
