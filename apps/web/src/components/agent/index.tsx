import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  AddPanelOptions,
  type DockviewApi,
  DockviewReact,
  type DockviewReadyEvent,
  IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
} from "dockview-react";
import {
  ComponentType,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useParams } from "react-router";

interface Props {
  agentId?: string;
  threadId?: string;
}

const AgentChat = lazy(
  () => import("../chat/index.tsx"),
);

const AgentSettings = lazy(
  () => import("../settings/index.tsx"),
);

const AgentPreview = lazy(
  () => import("./preview.tsx"),
);

const AgentThreads = lazy(
  () => import("../threads/index.tsx"),
);

const adapter =
  <T extends object>(Component: ComponentType<T>) =>
  (props: IDockviewPanelProps<T>) => {
    return (
      <div className="h-full w-full overflow-y-auto">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          }
        >
          <Component {...props.params} />
        </Suspense>
      </div>
    );
  };

const COMPONENTS = {
  chat: adapter(AgentChat),
  settings: adapter(AgentSettings),
  preview: adapter(AgentPreview),
  threads: adapter(AgentThreads),
};

const TAB_COMPONENTS = {
  default: (props: IDockviewPanelHeaderProps) => {
    if (props.api.component === "chat") {
      return null;
    }

    return (
      <div className="flex items-center justify-between px-4 py-2">
        <div className="font-medium">
          {props.api.title}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              props.api.close();
            }}
          >
            <Icon name="close" />
          </Button>
        </div>
      </div>
    );
  },
};

const channel = new EventTarget();

export const togglePanel = <T extends object>(detail: AddPanelOptions<T>) => {
  channel.dispatchEvent(
    new CustomEvent("message", { detail }),
  );
};

function Agent(props: Props) {
  const [api, setApi] = useState<DockviewApi | null>(null);
  const params = useParams();

  const agentId = props.agentId || params.id || crypto.randomUUID();
  const threadId = props.threadId || params.threadId || agentId === "teamAgent"
    ? `${Math.floor(Math.random() * 1e6)}`
    : undefined;

  const handleReady = useCallback((event: DockviewReadyEvent) => {
    setApi(event.api);

    event.api.addPanel({
      id: "chat",
      component: "chat",
      title: "Chat View",
      params: { agentId, threadId },
    });
  }, [agentId, threadId]);

  useEffect(() => {
    const handleMessage = (
      event: CustomEvent<AddPanelOptions<object>>,
    ) => {
      const { detail } = event;

      const panel = api?.getPanel(detail.id);

      if (panel) {
        panel.api.close();
      } else {
        api?.addPanel(detail);
      }
    };

    // @ts-expect-error - I don't really know how to properly type this
    channel.addEventListener("message", handleMessage);

    return () => {
      // @ts-expect-error - I don't really know how to properly type this
      channel.removeEventListener("message", handleMessage);
    };
  }, [api, channel]);

  return (
    <DockviewReact
      key={agentId}
      gap={6}
      components={COMPONENTS}
      tabComponents={TAB_COMPONENTS}
      defaultTabComponent={TAB_COMPONENTS.default}
      onReady={handleReady}
      className="h-full w-full dockview-theme-abyss"
      singleTabMode="fullwidth"
      disableDnd
    />
  );
}

export default Agent;
