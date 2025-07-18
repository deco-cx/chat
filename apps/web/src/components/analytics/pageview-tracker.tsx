import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";

export default function PageviewTrackerLayout() {
  const location = useLocation();

  useEffect(() => {
    const url = new URL(
      `${location.pathname}${location.search}`,
      globalThis.location.origin,
    );

    trackEvent("$pageview", {
      $current_url: url.href,
    });
  }, [location.pathname, location.search]);

  return <Outlet />;
}
