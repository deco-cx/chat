import { Button } from "@deco/ui/components/button.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useFocusChat } from "../../agents/hooks.ts";
import { AgentAvatar } from "../../common/avatar/agent.tsx";

interface AgentCardProps {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  onEdit?: () => void;
  displayLink?: boolean;
}

export function AgentCard({
  id,
  name,
  description,
  avatar,
  onEdit,
  displayLink = true,
}: AgentCardProps) {
  const focusChat = useFocusChat();

  if (!avatar || !name || !description) {
    return null;
  }

  return (
    <Card className="w-full max-w-64 bg-gradient-to-b from-white to-muted/50 border-border shadow-sm rounded-2xl my-4">
      <CardHeader className="flex flex-col items-center space-y-4 px-4 pt-6 pb-0 relative">
        {onEdit && (
          <Button
            variant="secondary"
            size="icon"
            onClick={onEdit}
            className="absolute right-4 top-4 bg-muted hover:bg-muted/90"
          >
            <Icon name="edit" />
          </Button>
        )}
        <AgentAvatar
          url={avatar}
          fallback={name}
          className="bg-foreground p-1 border"
          size="3xl"
        />
        <div className="flex flex-col items-center justify-center gap-1">
          <CardTitle className="text-xl font-medium leading-relaxed text-foreground text-center">
            {name}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-6 pt-2 flex flex-col gap-2 items-center">
        <p className="text-sm leading-relaxed text-muted-foreground text-center">
          {description}
        </p>
        {displayLink && (
          <Button
            onClick={() => {
              focusChat(id, crypto.randomUUID(), { history: false });
            }}
            size="sm"
            className="text-sm"
          >
            View Agent
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
