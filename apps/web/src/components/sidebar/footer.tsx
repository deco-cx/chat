import { AUTH_URL, UnauthorizedError } from "@deco/sdk";
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
import { Suspense, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "react-router";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { useUser } from "../../hooks/data/useUser.ts";
import { useGitHubStars } from "../../hooks/useGitHubStars.ts";
import { useUserPreferences } from "../../hooks/useUserPreferences.ts";
import { ModelSelector } from "../chat/ModelSelector.tsx";
import { Avatar } from "../common/Avatar.tsx";
import { ProfileSettings } from "../settings/profile.tsx";

function UserPreferencesModal({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { preferences, setPreferences } = useUserPreferences();
  const form = useForm({
    defaultValues: {
      defaultModel: preferences.defaultModel,
      useOpenRouter: preferences.useOpenRouter,
    },
  });
  const { handleSubmit, formState: { isDirty } } = form;

  function onSubmit(data: { defaultModel: string; useOpenRouter: boolean }) {
    setPreferences(data);
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
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        id="openrouter-switch"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel htmlFor="openrouter-switch">
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
  const { data: stars } = useGitHubStars();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const logoutUrl = useMemo(() => {
    const url = new URL(AUTH_URL);
    url.pathname = "/auth/logout";

    const next = new URL(location.pathname, globalThis.location.origin);
    url.searchParams.set("next", next.href);

    return url.href;
  }, [location.pathname]);

  const userAvatarURL = user?.metadata?.avatar_url ?? undefined;
  const userName = user?.metadata?.full_name || user?.email;
  const formattedStars = stars
    ? (stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars)
    : null;

  return (
    <ResponsiveDropdown>
      <ResponsiveDropdownTrigger asChild>
        <SidebarMenuButton className="cursor-pointer gap-2 group-data-[collapsible=icon]:px-1! group-data-[collapsible=icon]:py-2!">
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
        <ResponsiveDropdownItem className="p-0 md:px-2 md:py-1.5" asChild>
          <a
            href="https://github.com/deco-cx/chat"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-2 leading-relaxed text-sm sm:text-xs"
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
        <ResponsiveDropdownItem className="p-0 md:px-2 md:py-1.5" asChild>
          <button
            type="button"
            className="flex items-center gap-2 leading-relaxed text-sm sm:text-xs w-full"
            onClick={() => setProfileOpen(true)}
          >
            <Icon name="person" />
            Profile
          </button>
        </ResponsiveDropdownItem>
        <ResponsiveDropdownSeparator />
        <ResponsiveDropdownItem className="p-0 md:px-2 md:py-1.5" asChild>
          <button
            type="button"
            className="flex items-center gap-2 leading-relaxed text-sm sm:text-xs w-full"
            onClick={() => setPreferencesOpen(true)}
          >
            <Icon name="settings" />
            Preferences
          </button>
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
        shouldCatch={(error) => error instanceof UnauthorizedError}
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
