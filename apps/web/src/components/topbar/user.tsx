import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { useState } from "react";
import { Link } from "react-router";
import { useGlobalState, User } from "../../stores/global.tsx";
import { UserAvatar } from "../common/Avatar.tsx";
import { Image } from "../common/Image.tsx";

const UserMenuHeader = (
  { user, title: titleProp }: { user: User; title?: React.ComponentType },
) => {
  const Title = titleProp ?? "h4";

  return (
    <DropdownMenuLabel className="flex flex-col items-center py-0 px-0 font-normal">
      <div className="relative w-full">
        <Image
          src="https://webdraw.com/img/profile-background-mobile.svg"
          alt="profile background"
          height={70}
          width={230}
          style={{ height: "68px" }}
          className="w-full object-cover"
        />
        <div
          className="absolute -bottom-6 left-1/2 -translate-x-1/2"
          style={{ height: "48px", width: "48px" }}
        >
          <UserAvatar
            name={user.metadata?.full_name}
            avatar={user.metadata?.avatar_url}
            className="border border-muted"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2 items-center pt-8 pb-2">
        <div className="flex flex-col gap-px items-center">
          <Title className="font-semibold text-xs" data-user-email>
            {user.metadata?.full_name
              ? user.metadata?.full_name.split(" ")[0]
              : user.email}
          </Title>
          <span className="text-muted-foreground text-xs">
            {user.email}
          </span>
        </div>

        <a
          className="hover:underline text-[#157BF4] text-xs"
          href={`/user/${user.metadata?.username}`}
        >
          Show profile
        </a>
      </div>
    </DropdownMenuLabel>
  );
};

export function UserMenu() {
  const { state: { user } } = useGlobalState();
  const isMobile = useIsMobile();

  if (!user) return null;

  if (isMobile) {
    return (
      <Link to="/account">
        <UserAvatar
          name={user.metadata?.full_name}
          avatar={user.metadata?.avatar_url}
          className="border-2 border-muted"
        />
      </Link>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button data-user-menu-button variant="ghost" size="icon">
            <div style={{ height: "30px", width: "30px" }}>
              <UserAvatar
                name={user.metadata?.full_name}
                avatar={user.metadata?.avatar_url}
                className="border-2 border-muted"
              />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          className="w-[230px] rounded-xl text-xs flex flex-col p-0 pb-1"
        >
          <UserMenuHeader user={user} />

          <DropdownMenuSeparator />
          <DropdownMenuGroup className="mx-1">
            <DropdownMenuItem className="cursor-pointer">
              <a
                href="/auth/logout"
                className="flex items-center gap-2 leading-7 text-xs"
              >
                <Icon name="logout" size={16} />
                Log out
              </a>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
