import { useRuntime } from "@deco/sdk/hooks";
import { createStore } from "@deco/store";
import { type ReactNode, useEffect } from "react";

export interface User {
  id: string;
  email: string;
  app_metadata: {
    provider: string;
  };
  isAdmin: boolean;
  is_anonymous: boolean;
  last_sign_in_at: string;
  walletHead: {
    total: string;
  };
  metadata: {
    avatar_url: string;
    full_name: string;
    username: string;
  };
}

export interface NavItem {
  // Label of the item
  title: string;
  // Icon of the item
  icon: string;
  // Link to the item
  url: string;
}

export interface SidebarStorage {
  // For each context, a list of items
  [context: string]: NavItem[];
}

export interface State {
  user?: User;
  context?: {
    root: string;
    type: string;
  };
  sidebarState?: SidebarStorage;
}

const { Provider, useStore } = createStore<State>({
  // middlewares: {
  //   sidebarState: (nextState) => {

  //   },
  // },
  initializer: (props) => props,
});

function StoreEffects() {
  const { dispatch } = useGlobalState();
  const { state: { user } } = useRuntime() as any;

  useEffect(() => {
    if (!user) {
      return;
    }

    dispatch({ type: "update-user", payload: user });
  }, [user]);

  return null;
}

export function GlobalStateProvider(
  { children }: { children: ReactNode },
) {
  return (
    <Provider>
      <StoreEffects />
      {children}
    </Provider>
  );
}

export const useGlobalState = useStore;
