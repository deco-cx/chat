import { useSearchParams } from "react-router";
import { z } from "zod/v3";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { SplitScreenLayout } from "../login/layout.tsx";
import { DecoQueryClientProvider } from "@deco/sdk";

export const OAuthSearchParamsSchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string(),
  state: z.string().optional(),
  workspace_hint: z.string().optional(),
});

export type OAuthSearchParams = z.infer<typeof OAuthSearchParamsSchema>;

const ErrorPanel = () => (
  <div className="flex flex-col items-center justify-center h-full">
    <div className="text-center space-y-6 max-w-md">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
          <Icon name="error" size={32} className="text-destructive" />
        </div>
      </div>
      <h1 className="text-xl font-semibold">Authentication Error</h1>
      <p className="text-muted-foreground text-sm w-2/3 mx-auto">
        Something went wrong when authenticating your access to that app. Please
        try again or contact us if the problem persists.
      </p>
      <Button
        variant="outline"
        onClick={() => globalThis.history.back()}
        className="gap-2"
      >
        <Icon name="arrow_left_alt" size={16} />
        Go back
      </Button>
    </div>
  </div>
);

type AppsAuthLayoutProps = {
  children: (props: OAuthSearchParams) => React.ReactNode;
};

export function AppsAuthLayout({ children }: AppsAuthLayoutProps) {
  const [searchParams] = useSearchParams();
  const result = OAuthSearchParamsSchema.safeParse(
    Object.fromEntries(searchParams),
  );

  if (!result.success) {
    return (
      <DecoQueryClientProvider>
        <SplitScreenLayout>
          <ErrorPanel />
        </SplitScreenLayout>
      </DecoQueryClientProvider>
    );
  }

  return (
    <DecoQueryClientProvider>
      <SplitScreenLayout>{children(result.data)}</SplitScreenLayout>
    </DecoQueryClientProvider>
  );
}
