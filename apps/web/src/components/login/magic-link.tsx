import { Button } from "@deco/ui/components/button.tsx";
import { Link, useSearchParams } from "react-router";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { DECO_CHAT_API } from "@deco/sdk";
import type { FormEventHandler } from "react";
import { useEffect, useRef, useState } from "react";
import { SplitScreenLayout } from "./layout.tsx";

const useSendMagicLink = () => {
  const create = useMutation({
    mutationFn: (prop: { email: string; cli: boolean }) =>
      fetch(new URL("/login/magiclink", DECO_CHAT_API), {
        method: "POST",
        body: JSON.stringify(prop),
      })
        .then((res) => res.ok)
        .catch(() => false),
  });

  return create;
};

function MagicLink() {
  const fetcher = useSendMagicLink();
  const [email, setEmail] = useState("");
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const setOnce = useRef(false);

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    fetcher.mutate({ email, cli: searchParams.get("cli") === "true" });
  };

  useEffect(
    function submitedOnce() {
      if (fetcher.data === undefined) return;
      setOnce.current = true;
    },
    [fetcher.data],
  );

  return (
    <SplitScreenLayout>
      <div className="flex flex-col items-center justify-center p-6 h-full">
        <span className="text-muted-foreground text-center inline-flex items-center gap-1 pb-16">
          <Icon name="arrow_back" size={16} />
          <Link
            to={`/login?next=${next}`}
            className="text-sm flex items-center gap-1 hover:underline"
          >
            Back to login options
          </Link>
        </span>
        {fetcher.data === undefined && !setOnce.current ? (
          <form method="post" onSubmit={handleSubmit}>
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <div className="flex flex-col gap-8">
              <div className="text-lg font-semibold leading-none tracking-tight">
                <div className="flex flex-col items-center gap-5">
                  <div className="flex flex-col text-center">
                    <h2 className="text-xl font-bold">Login with email</h2>
                  </div>
                </div>
              </div>
              <div>
                <Input
                  name="email"
                  type="email"
                  required
                  placeholder="Your email address"
                  className="min-w-80"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col items-center gap-2.5">
                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={fetcher.isPending}
                >
                  {fetcher.isPending ? <Spinner size="xs" /> : null}
                  Send magic link
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <form method="post" onSubmit={handleSubmit}>
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-xl font-bold pt-4">Check your email</h2>
              <p className="text-muted-foreground font-medium">{email}</p>
              <p className="text-sm text-muted-foreground text-center pt-2">
                Click on the link sent to your email to complete your signup.
                <br />
                If you don't see it, you may need to
                <span className="text-sm text-muted-foreground font-bold px-1">
                  check your spam
                </span>
                folder.
              </p>
              <p className="text-sm text-muted-foreground pt-4 pb-4">
                Still can't find the email? No problem.
              </p>
              <Button
                type="submit"
                className="w-full gap-2"
                disabled={fetcher.isPending}
              >
                {fetcher.isPending ? <Spinner size="xs" /> : null}
                Resend verification email
              </Button>
            </div>
          </form>
        )}
      </div>
    </SplitScreenLayout>
  );
}

const client = new QueryClient({});

export default function MagicLinkWrapper() {
  return (
    <QueryClientProvider client={client}>
      <MagicLink />
    </QueryClientProvider>
  );
}
