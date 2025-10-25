import { Button } from "@deco/ui/components/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@deco/ui/components/alert.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

export function ThemePreview() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Buttons
        </h4>
        <div className="flex gap-2 flex-col">
          <Button size="sm" className="w-full">
            Primary
          </Button>
          <Button size="sm" variant="secondary" className="w-full">
            Secondary
          </Button>
          <Button size="sm" variant="destructive" className="w-full">
            Destructive
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Badges
        </h4>
        <div className="flex gap-2 flex-wrap">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Card
        </h4>
        <Card className="shadow-sm">
          <CardHeader className="pt-4 pb-0">
            <CardTitle className="text-md">Card Title</CardTitle>
            <CardDescription className="text-xs">
              Card description
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <p className="text-xs">Card content</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Alerts
        </h4>
        <div className="space-y-2">
          <Alert className="py-2 px-3">
            <Icon name="info" className="h-3 w-3" />
            <AlertTitle className="text-xs leading-none">Info</AlertTitle>
            <AlertDescription className="text-xs">Info alert</AlertDescription>
          </Alert>

          <Alert variant="destructive" className="py-2 px-3">
            <Icon name="error" className="h-3 w-3" />
            <AlertTitle className="text-xs leading-none">Error</AlertTitle>
            <AlertDescription className="text-xs">Error alert</AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
