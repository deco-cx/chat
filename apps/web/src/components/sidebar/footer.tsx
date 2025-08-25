import {
  DECO_CHAT_API,
  UnauthorizedError,
  useInvites,
  useWorkspaceWalletBalance,
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
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { useUser } from "../../hooks/use-user.ts";
import { ModelSelector } from "../chat/model-selector.tsx";
import { UserAvatar } from "../common/avatar/user.tsx";
import { ProfileSettings } from "../settings/profile.tsx";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";

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
      smoothStream: preferences.smoothStream,
      sendReasoning: preferences.sendReasoning,
      pdfSummarization: preferences.pdfSummarization,
      enableDecopilot: preferences.enableDecopilot,
    },
  });
  const {
    handleSubmit,
    formState: { isDirty },
  } = form;

  function onSubmit(data: {
    defaultModel: string;
    useOpenRouter: boolean;
    sendReasoning: boolean;
    smoothStream: boolean;
    pdfSummarization: boolean;
    enableDecopilot: boolean;
  }) {
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
            <FormField
              name="useOpenRouter"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-center items-start gap-2">
                  <div className="flex items-center gap-2 cursor-pointer">
                    <FormControl>
                      <Switch
                        id="openrouter-switch"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel
                      htmlFor="openrouter-switch"
                      className="cursor-pointer"
                    >
                      Use OpenRouter
                    </FormLabel>
                  </div>
                  <FormDescription>
                    Improve availability of AI responses.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="smoothStream"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-center items-start gap-2">
                  <div className="flex items-center gap-2 cursor-pointer">
                    <FormControl>
                      <Switch
                        id="smoothStream"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel
                      htmlFor="smoothStream"
                      className="cursor-pointer"
                    >
                      Smooth Stream
                    </FormLabel>
                  </div>
                  <FormDescription>
                    Smooth out the stream of AI responses.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="sendReasoning"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-center items-start gap-2">
                  <div className="flex items-center gap-2 cursor-pointer">
                    <FormControl>
                      <Switch
                        id="sendReasoning"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel
                      htmlFor="sendReasoning"
                      className="cursor-pointer"
                    >
                      Reasoning
                    </FormLabel>
                  </div>
                  <FormDescription>
                    Display AI reasoning tokens in the chat.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="pdfSummarization"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-center items-start gap-2">
                  <div className="flex items-center gap-2 cursor-pointer">
                    <FormControl>
                      <Switch
                        id="pdfSummarization"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel
                      htmlFor="pdfSummarization"
                      className="cursor-pointer"
                    >
                      Summarize PDFs
                    </FormLabel>
                  </div>
                  <FormDescription>
                    Summarize large PDFs to reduce token usage and enable larger
                    PDF support.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="enableDecopilot"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-center items-start gap-2">
                  <div className="flex items-center gap-2 cursor-pointer">
                    <FormControl>
                      <Switch
                        id="enableDecopilot"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel
                      htmlFor="enableDecopilot"
                      className="cursor-pointer"
                    >
                      Enable Decopilot
                    </FormLabel>
                  </div>
                  <FormDescription>
                    Show the Decopilot toggle button in the chat interface.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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

function LoggedUser() {
  const user = useUser();
  const location = useLocation();
  const href = "/invites";
  const match = useMatch(href);
  const { data: stars } = useGitHubStars();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const logoutUrl = useMemo(() => {
    const url = new URL(DECO_CHAT_API);
    url.pathname = "/auth/logout";

    const next = new URL(location.pathname, globalThis.location.origin);
    url.searchParams.set("next", next.href);

    return url.href;
  }, [location.pathname]);

  const userAvatarURL = user?.metadata?.avatar_url ?? undefined;
  const userName = user?.metadata?.full_name || user?.email;
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
        <SidebarMenuButton className="cursor-pointer gap-3 group-data-[collapsible=icon]:px-1! group-data-[collapsible=icon]:py-2!">
          <UserAvatar url={userAvatarURL} fallback={userName} size="xs" />
          <span className="text-sm grow">{user.metadata?.full_name}</span>

          <Suspense fallback={null}>
            <div className="size-3 flex items-center">
              <NotificationDot className="justify-end" />
            </div>
          </Suspense>
        </SidebarMenuButton>
      </ResponsiveDropdownTrigger>
      <ResponsiveDropdownContent
        side="top"
        align="start"
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
            href="/about"
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

/**
 * Very small team balance label to be shown above the user menu in the sidebar footer.
 */
function TeamBalanceLabel() {
  const account = useWorkspaceWalletBalance();
  const withWorkspaceLink = useWorkspaceLink();

  if (!account?.balance) return null;

  return (
    <Link
      to={withWorkspaceLink("/monitor/billing")}
      className="bg-sidebar-accent flex flex-col gap-1 px-4 py-3 rounded-xl w-full transition-colors hover:bg-sidebar-accent"
    >
      <div className="text-xs text-muted-foreground">
        FREE PLAN
      </div>
      <div className="flex items-center justify-between w-full text-sm">
        <span className="text-sidebar-foreground">Team Balance</span>
        <span className="text-muted-foreground">{account.balance}</span>
      </div>
    </Link>
  );
}

function TeamBalance() {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <TeamBalanceLabel />
      </ErrorBoundary>
    </Suspense>
  );
}

function AnonymouseUser() {
  const to = `/login?next=${globalThis?.location?.href}`;

  return (
    <SidebarMenuButton>
      <Link to={to}>
        <Icon name="person" size={18} />
        Sign in
      </Link>
    </SidebarMenuButton>
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

export function SidebarFooter() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ErrorBoundary
        shouldCatch={(error) => error instanceof UnauthorizedError}
        fallback={<AnonymouseUser />}
      >
        <SidebarFooterInner>
          <SidebarMenu>
            <SidebarMenuItem>
              <TeamBalance />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <LoggedUser />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooterInner>
      </ErrorBoundary>
    </Suspense>
  );
}
