import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useAgenticChat } from "../chat/provider.tsx";
import ThreadList from "../threads/index.tsx";

function Threads() {
  const { metadata } = useAgenticChat();
  const { agentId } = metadata;

  return (
    <ScrollArea className="h-full w-full">
      <ThreadList agentId={agentId} />
    </ScrollArea>
  );
}

export default Threads;
