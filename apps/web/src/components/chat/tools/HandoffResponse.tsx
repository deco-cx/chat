import { useAgent } from "@deco/sdk";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@deco/ui/components/avatar.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@deco/ui/components/collapsible.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState } from "react";
import { ChatMessages } from "../ChatMessages.tsx";
import { ChatProvider } from "../context.tsx";

interface HandoffResponseProps {
  agentId: string;
  threadId: string;
}

export function HandoffResponse({ agentId, threadId }: HandoffResponseProps) {
  const { data: agent } = useAgent(agentId);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="my-2 relative">
      {/* Visual connector line */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          {/* Agent Header */}
          <CollapsibleTrigger className="cursor-pointer">
            <div className="w-full bg-slate-50 p-4 flex items-center gap-3 border-b border-slate-200 hover:bg-slate-100 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={agent?.avatar}
                  alt={agent?.name || "Agent avatar"}
                />
                <AvatarFallback>{agent?.name?.[0] ?? "A"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <h3 className="font-medium text-sm text-slate-900">
                  {agent?.name || "Agent"}
                </h3>
                <p className="text-xs text-slate-500">
                  {agent?.description || "Delegated response"}
                </p>
              </div>
              <Icon
                name="chevron_right"
                className={cn(
                  "text-slate-500 transition-transform",
                  isOpen && "rotate-90",
                )}
              />
            </div>
          </CollapsibleTrigger>

          {/* Delegated Messages */}
          <CollapsibleContent>
            <div className="bg-white/50 backdrop-blur-sm">
              <ChatProvider agentId={agentId} threadId={threadId}>
                <div className="space-y-4 max-h-96 overflow-y-auto p-4">
                  <ChatMessages />
                </div>
              </ChatProvider>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
