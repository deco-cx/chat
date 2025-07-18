import { Button } from "@deco/ui/components/button.tsx";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { SplitScreenLayout } from "./layout.tsx";
import { providers } from "./providers.tsx";

function Login() {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const cli = searchParams.has("cli");

  // State for last used login method
  const [lastLoginMethod, setLastLoginMethod] = useState<string | null>(null);

  useEffect(() => {
    setLastLoginMethod(localStorage.getItem("lastLoginMethod"));
  }, []);

  const handleProviderClick = (providerName: string) => {
    localStorage.setItem("lastLoginMethod", providerName);
    trackEvent("deco_chat_login_provider_click", {
      provider: providerName,
    });
  };

  const filteredProviders = providers.filter((provider) => {
    // Disable email provider when &cli=true is present
    // Note: CLI login with email redirects incorrectly to admin.deco.cx instead of the deco.chat
    // TODO: A better solution
    if (cli && provider.name === "Email") {
      return false;
    }
    return true;
  });

  return (
    <SplitScreenLayout>
      <div className="flex flex-col justify-center gap-7 p-6 h-full">
        <div className="text-lg font-semibold leading-none tracking-tight">
          <div className="flex flex-col items-center gap-5">
            <div className="flex flex-col text-center items-center">
              <h2 className="text-xl font-bold max-w-64">Welcome to Deco</h2>
            </div>
            <p className="text-sm text-muted-foreground font-normal">
              Choose an option to get started
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2.5">
          {filteredProviders.map((provider) => {
            const isLastUsed = provider.name === lastLoginMethod;
            return (
              <div
                key={provider.name}
                className={
                  isLastUsed
                    ? "relative w-full min-w-80 border-2 border-primary rounded-lg bg-primary/5"
                    : "w-full min-w-80"
                }
              >
                <Button
                  variant="outline"
                  className="p-5 min-w-80 hover:text-foreground w-full"
                  asChild
                >
                  <Link
                    to={provider.authURL({
                      next: next || globalThis.location.origin,
                      cli,
                    })}
                    className="flex items-center gap-2.5 h-6"
                    onClick={() => handleProviderClick(provider.name)}
                  >
                    <img
                      className={provider.iconClassName}
                      loading="lazy"
                      src={provider.iconURL}
                      alt={provider.name}
                      width={20}
                      height={20}
                    />
                    <span className="text-sm font-semibold">
                      Continue with {provider.name}
                    </span>
                    {isLastUsed && (
                      <span className="ml-3 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                        Last used
                      </span>
                    )}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </SplitScreenLayout>
  );
}

export default Login;
