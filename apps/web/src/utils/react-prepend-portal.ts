import { type ReactNode, type ReactPortal, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

/**
 * Same thing as React.createPortal, but prepends
 * the container instead of appending it.
 */
export const createPrependPortal = (
  component: ReactNode,
  container: Element,
): ReactPortal => {
  const portalContainer = useMemo(() => document.createElement("div"), []);

  useEffect(() => {
    // @ts-expect-error - Works fine
    container.prepend(portalContainer);
    return () => {
      if (container.contains(portalContainer)) {
        container.removeChild(portalContainer);
      }
    };
  }, [container, portalContainer]);

  return createPortal(component, portalContainer);
};
