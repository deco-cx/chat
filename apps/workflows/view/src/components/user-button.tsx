import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, LogOut } from "lucide-react";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@deco/ui/components/popover.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@deco/ui/components/collapsible.tsx";
import { useOptionalUser, type User } from "@/lib/hooks";
import { type ToolCall, useToolCalls } from "@/hooks/useToolCalls";
import { toast } from "sonner";

const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  } catch {
    toast.error("Failed to copy to clipboard");
  }
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

function ToolCallItem({ call }: { call: ToolCall }) {
  const hasError = call.output?.error;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-slate-700 rounded-md bg-slate-800/50">
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full px-2 py-1.5 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2 text-left">
          <ChevronRight
            className={`w-3 h-3 text-slate-500 transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
          />
          <span
            className={`text-xs font-mono ${
              hasError ? "text-red-400" : "text-blue-400"
            }`}
          >
            {call.tool}
          </span>
          <span className="text-xs text-slate-500">
            {formatTime(call.timestamp)}
          </span>
        </div>
        {hasError && <span className="text-xs text-red-400 mr-2">Error</span>}
      </button>

      {isExpanded && (
        <div className="px-3 py-2 border-t border-slate-700 space-y-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-400">Input:</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  copyToClipboard(JSON.stringify(call.input, null, 2), "Input")
                }
                className="h-5 px-1.5"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <pre className="text-xs bg-slate-900 rounded p-2 overflow-x-auto">
              <code>{JSON.stringify(call.input, null, 2)}</code>
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-400">
                Output:
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(call.output, null, 2),
                    "Output",
                  )
                }
                className="h-5 px-1.5"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <pre
              className={`text-xs rounded p-2 overflow-x-auto ${
                hasError ? "bg-red-950/30 text-red-300" : "bg-slate-900"
              }`}
            >
              <code>{JSON.stringify(call.output, null, 2)}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolCallsTable() {
  const { calls, clearCalls } = useToolCalls();

  if (calls.length === 0) {
    return (
      <div className="text-xs text-slate-500 text-center py-2">
        No tool calls recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-slate-400">
          {calls.length} call{calls.length !== 1 ? "s" : ""} recorded
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={clearCalls}
          className="h-6 px-2 text-xs text-slate-400 hover:text-red-400"
        >
          Clear
        </Button>
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {calls
          .slice()
          .reverse()
          .map((call) => (
            <ToolCallItem
              key={`call-${call.tool}-${call.timestamp}`}
              call={call}
            />
          ))}
      </div>
    </div>
  );
}

function ProfileCard({ user }: { user: User }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-center text-white">Profile</h3>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Name:</span>
          <span className="text-xs text-white">{user.name || "Not set"}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Email:</span>
          <span className="text-xs text-white">{user.email}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">User ID:</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-white font-mono truncate max-w-[150px]">
              {user.id}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(user.id, "User ID")}
              className="h-5 w-5 p-0"
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginButton() {
  return (
    <Button
      asChild
      size="sm"
      className="bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white border-slate-600"
    >
      {/* Okay to use <a> instead of <Link> here because it's a route handled by the server */}
      <a href="/oauth/start" className="inline-flex items-center gap-2">
        <span>Sign In</span>
        <img src="/d.png" alt="Deco" className="w-4 h-4" />
      </a>
    </Button>
  );
}

export function UserButton() {
  const { data: user } = useOptionalUser();
  const [debugOpen, setDebugOpen] = useState(false);

  if (!user) {
    return <LoginButton />;
  }

  const username = user.name || user.email?.split("@")[0] || "user";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          className="bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white border-slate-600"
        >
          <span>@{username}</span>
          <img src="/d.png" alt="Deco" className="w-4 h-4 ml-2" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 bg-slate-800 border-slate-700 text-white p-4"
        align="end"
      >
        <div className="space-y-4">
          {/* Title */}
          <div className="text-center">
            <span className="text-sm text-slate-300">
              Logged in with{" "}
              <a
                href="https://deco.chat/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                deco
              </a>
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700" />

          {/* Profile Section */}
          <ProfileCard user={user} />

          {/* Divider */}
          <div className="border-t border-slate-700" />

          {/* Logout Button */}
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/30"
          >
            <a href="/oauth/logout" className="inline-flex items-center gap-2">
              <LogOut className="w-3 h-3" />
              <span className="text-xs">Logout</span>
            </a>
          </Button>

          {/* Divider */}
          <div className="border-t border-slate-700" />

          {/* Debug Section */}
          <div>
            <h3 className="text-sm font-medium text-center text-white mb-2">
              Debug
            </h3>

            <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between hover:bg-slate-600 text-slate-300 hover:text-white"
                >
                  <span className="text-xs">Tool Calls</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${
                      debugOpen ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-2">
                <ToolCallsTable />
              </CollapsibleContent>
            </Collapsible>

            {/* Future debug features note */}
            <p className="text-xs text-slate-500 text-center mt-2">
              More debug features coming soon
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
