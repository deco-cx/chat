import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  type AddPanelOptions,
  type DockviewApi,
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
} from "dockview-react";
import {
  type ComponentProps,
  type ComponentType,
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  Suspense,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ViewsButton } from "./views-button.tsx";

const Context = createContext<{
  tabs: Record<string, Tab>;
  totalTabs: number;
  openPanels: Set<string>;
  setOpenPanels: Dispatch<SetStateAction<Set<string>>>;
} | null>(null);

const NO_DROP_TARGET = "no-drop-target";

export const useDock = () => {
  const ctx = use(Context);

  if (!ctx) {
    throw new Error("Dock context not found");
  }

  return ctx;
};

const adapter =
  <T extends object>(Component: ComponentType<T>) =>
  (props: IDockviewPanelProps<T>) => {
    return (
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <Spinner />
          </div>
        }
      >
        <Component {...props.params} />
      </Suspense>
    );
  };

const TAB_COMPONENTS = {
  default: (props: IDockviewPanelHeaderProps) => {
    const { openPanels } = useDock();

    if (openPanels.size <= 1) {
      return null;
    }

    return (
      <div className="w-min">
        <div
          data-active
          className="flex items-center justify-between gap-1 p-2 px-3 group"
        >
          <p className="text-sm whitespace-nowrap">{props.api.title}</p>
          <Button
            className="p-1 h-6 w-6"
            variant="ghost"
            size="icon"
            onClick={() => props.api.close()}
          >
            <Icon name="close" size={12} />
          </Button>
        </div>
      </div>
    );
  },
};

const channel = new EventTarget();

type Message = {
  type: "toggle" | "open" | "update";
  payload: AddPanelOptions<object>;
};

export const togglePanel = <T extends object>(detail: AddPanelOptions<T>) => {
  channel.dispatchEvent(
    new CustomEvent("message", { detail: { type: "toggle", payload: detail } }),
  );
};

export const openPanel = <T extends object>(detail: AddPanelOptions<T>) => {
  channel.dispatchEvent(
    new CustomEvent("message", { detail: { type: "open", payload: detail } }),
  );
};

type initialOpen = "right" | "within" | "below" | "above" | "left";
export const initialOpenDirections: initialOpen[] = [
  "right",
  "within",
  "below",
  "above",
  "left",
];

interface TabMetadata {
  isSavedView?: boolean;
}

export interface Tab {
  Component: ComponentType;
  title: string;
  initialOpen?: boolean | initialOpen;
  initialHeight?: number;
  initialWidth?: number;
  maximumHeight?: number;
  maximumWidth?: number;
  hideFromViews?: boolean;
  active?: boolean;
  metadata?: TabMetadata;
}

type Props = Partial<
  Omit<ComponentProps<typeof DockviewReact>, "components">
> & {
  tabs: Record<string, Tab>;
  hideViewsButton?: boolean;
};

const addPanel = (
  options: AddPanelOptions,
  api: DockviewApi,
  isMobile: boolean,
) => {
  const targetGroup = api.groups.findLast(
    (group) => group.locked !== NO_DROP_TARGET,
  );

  const { position, ...otherOptions } = options;

  const panelOptions: AddPanelOptions = {
    position: {
      direction: isMobile ? "within" : position?.direction || "within",
      referenceGroup: targetGroup?.id,
    },
    ...otherOptions,
    floating: false,
  };

  const panel = api.addPanel(panelOptions);

  return panel;
};

const equals = (a: Set<string>, b: Set<string>) => {
  if (a.size !== b.size) {
    return false;
  }

  return a.isSubsetOf(b) && b.isSubsetOf(a);
};

function Docked({ tabs, hideViewsButton, ...props }: Props) {
  const isMobile = useIsMobile();
  const [api, setApi] = useState<DockviewApi | null>(null);
  const { setOpenPanels, totalTabs } = useDock();
  const wrappedTabs = useMemo(() => {
    const entries = Object.entries(tabs).map(([key, value]) => [
      key,
      adapter(value.Component),
    ]);

    return Object.fromEntries(entries);
  }, [tabs]);

  const handleReady = useCallback(
    (event: DockviewReadyEvent) => {
      setApi(event.api);

      const initialPanels = new Set<string>();
      for (const [key, value] of Object.entries(tabs)) {
        if (!value.initialOpen) {
          continue;
        }

        initialPanels.add(key);
        addPanel(
          {
            id: key,
            component: key,
            title: value.title,
            renderer: value.metadata?.isSavedView
              ? "always"
              : "onlyWhenVisible",
            initialHeight: !isMobile ? value.initialHeight : undefined,
            initialWidth: !isMobile ? value.initialWidth : undefined,
            maximumHeight: !isMobile ? value.maximumHeight : undefined,
            maximumWidth: !isMobile ? value.maximumWidth : undefined,
            position: initialOpenDirections.includes(
              value.initialOpen as initialOpen,
            )
              ? { direction: value.initialOpen as initialOpen }
              : undefined,
          },
          event.api,
          isMobile,
        );
      }

      const activeTabs = Object.entries(tabs).filter(([, tab]) => tab.active);
      if (activeTabs.length > 0) {
        for (const [id] of activeTabs) {
          event.api.getPanel(id)?.api.setActive();
        }
      }

      setOpenPanels(initialPanels);

      const disposable = event.api.onDidLayoutChange(() => {
        const currentPanels = new Set(
          event.api.panels.map((panel) => panel.id),
        );

        setOpenPanels((prev) =>
          equals(prev, currentPanels) ? prev : currentPanels,
        );
      });

      return () => {
        disposable.dispose();
      };
    },
    [tabs, isMobile],
  );

  useEffect(() => {
    if (!api) {
      return;
    }

    const handleMessage = (event: CustomEvent<Message>) => {
      const { type, payload } = event.detail;
      const panel = api.getPanel(payload.id);

      if (panel) {
        if (type === "toggle") {
          panel.api.close();
        } else if (type === "open") {
          panel.api.updateParameters(payload.params || {});
          panel.api.setActive();
        }
      } else {
        addPanel(payload, api, isMobile);
      }
    };

    // @ts-expect-error - I don't really know how to properly type this
    channel.addEventListener("message", handleMessage);

    return () => {
      // @ts-expect-error - I don't really know how to properly type this
      channel.removeEventListener("message", handleMessage);
    };
  }, [isMobile, api, channel]);

  return (
    <div className="h-full w-full">
      <DockviewReact
        components={wrappedTabs}
        defaultTabComponent={TAB_COMPONENTS.default}
        onReady={handleReady}
        className={cn(
          "h-full w-full dockview-theme-abyss deco-dockview-container",
          totalTabs === 1 && "one-tab",
        )}
        singleTabMode="fullwidth"
        disableTabsOverflowList
        disableFloatingGroups
        hideBorders
        {...props}
      />
      {api && !hideViewsButton && (
        <>
          <ViewsButton.Styles />
          <ViewsButton />
        </>
      )}
    </div>
  );
}

Docked.Provider = ({
  children,
  tabs,
}: {
  children: ReactNode;
  tabs: Record<string, Tab>;
}) => {
  const [openPanels, setOpenPanels] = useState(new Set<string>());
  const totalTabs = Object.values(tabs).filter(
    (tab) => !tab.hideFromViews,
  ).length;

  return (
    <Context.Provider
      value={{
        tabs,
        totalTabs,
        openPanels,
        setOpenPanels,
      }}
    >
      {children}
    </Context.Provider>
  );
};

export default Docked;
