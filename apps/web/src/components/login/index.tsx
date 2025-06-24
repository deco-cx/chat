import { SplitScreenLayout } from "./layout.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { providers } from "./providers.tsx";
import { Link, useSearchParams } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useEffect } from "react";

const LAST_LOGIN_METHOD_KEY = "deco-chat-last-login-method";

function Login() {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const cli = searchParams.has("cli");

  const handleProviderClick = (providerName: string) => {
    trackEvent("deco_chat_login_provider_click", {
      provider: providerName,
    });
    
    // Store the selected login method for next time
    try {
      localStorage.setItem(LAST_LOGIN_METHOD_KEY, providerName);
    } catch (error) {
      // Ignore localStorage errors (e.g., in private/incognito mode)
      console.debug("Could not save last login method:", error);
    }
  };

  // Show toast with last used login method when page loads
  useEffect(() => {
    try {
      const lastMethod = localStorage.getItem(LAST_LOGIN_METHOD_KEY);
      if (lastMethod) {
        const provider = providers.find(p => p.name === lastMethod);
        if (provider) {
          toast(`Last time you used ${provider.name} to sign in`, {
            duration: 5000,
            description: "You can continue with the same method or choose a different one.",
          });
        }
      }
    } catch (error) {
      // Ignore localStorage errors
      console.debug("Could not read last login method:", error);
    }
  }, []);

  return (
    <SplitScreenLayout>
      <div className="flex flex-col justify-center gap-7 p-6 h-full">
        <div className="text-lg font-semibold leading-none tracking-tight">
          <div className="flex flex-col items-center gap-5">
            <div className="flex flex-col text-center items-center">
              <h2 className="text-xl font-bold max-w-64">
                Welcome to Deco
              </h2>
            </div>
            <p className="text-sm text-muted-foreground font-normal">
              Choose an option to get started
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2.5">
          {providers.map((provider) => {
            return (
              <Button
                key={provider.name}
                variant="outline"
                className="p-5 min-w-80 hover:text-foreground"
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
                </Link>
              </Button>
            );
          })}
        </div>
      </div>
    </SplitScreenLayout>
  );
}

export default Login;
