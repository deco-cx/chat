import React from "react";
import { Suspense } from "react";
import { Loader } from "lucide-react";
import { useUser } from "@/lib/hooks";
import { ErrorBoundary } from "./error-boundary";

export class FailedToFetchUserError extends Error {
  constructor(
    message: string,
    public next: string,
  ) {
    super(message);
    this.name = "FailedToFetchUserError";
  }
}

function UserFetcher({ children }: { children: React.ReactNode }) {
  useUser();
  return <>{children}</>;
}

function Fallback() {
  return (
    <div className="w-screen h-screen grid place-items-center">
      <Loader className="mx-2 w-4 h-4 animate-spin" />
    </div>
  );
}

/**
 * This component wraps an authenticated route and handles the user login/logout.
 * If the user is not logged in, it will redirect to the login page automatically.
 */
export default function LoggedProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      onError={(error) => {
        if (error instanceof FailedToFetchUserError) {
          globalThis.location.href =
            "/oauth/start?next=" +
            encodeURIComponent(error.next ?? globalThis.location.href);
          return;
        }
        throw error;
      }}
      fallback={<Fallback />}
    >
      <Suspense fallback={<Fallback />}>
        <UserFetcher>{children}</UserFetcher>
      </Suspense>
    </ErrorBoundary>
  );
}
