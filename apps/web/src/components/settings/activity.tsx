import { Suspense } from "react";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Alert, AlertDescription, AlertTitle } from "@deco/ui/components/alert.tsx";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { AuditListContent } from "../audit/list.tsx";

function ActivityErrorFallback() {
  return (
    <Alert variant="destructive" className="my-8">
      <AlertTitle>Error loading activity</AlertTitle>
      <AlertDescription>
        Something went wrong while loading the activity data.
      </AlertDescription>
    </Alert>
  );
}

export default function ActivitySettings() {
  return (
    <div className="h-full text-foreground px-6 py-6 overflow-x-auto w-full">
      <ErrorBoundary fallback={<ActivityErrorFallback />}>
        <Suspense
          fallback={
            <div className="flex justify-center items-center h-64">
              <Spinner />
            </div>
          }
        >
          <AuditListContent />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
} 