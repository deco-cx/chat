import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Link } from "react-router";
import { useGlobalState } from "../../stores/global.tsx";
import { UserMenu } from "./user.tsx";

function LoginButton() {
  const to = `/login?next=${globalThis?.location?.href}`;

  return (
    <Button variant="outline" className="gap-2 h-8" asChild data-sign-in-button>
      <Link to={to}>
        <Icon name="person" size={16} />
        Sign in
      </Link>
    </Button>
  );
}

export function Topbar() {
  const { state: { user } } = useGlobalState();
  const isAnonymous = user?.is_anonymous !== false;

  return (
    <header className={cn("w-full h-10 min-h-10", "grid grid-cols-2 items-center")}>
      <div />

      <div className="justify-self-end flex items-center">
        {isAnonymous ? <LoginButton /> : <UserMenu />}
      </div>
    </header>
  );
}
