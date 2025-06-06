import { type Binder, type Integration, useBindings } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { cn } from "@deco/ui/lib/utils.ts";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";

interface BindingSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIntegrationSelected: (integrationId: string) => void;
  initialSelectedIntegration?: string | null;
  binder: Binder;
}

function IntegrationListItem({
  integration,
  selectedIntegration,
  onSelect,
  selectedItemRef,
}: {
  integration: Integration;
  selectedIntegration: string | null;
  onSelect: (id: string) => void;
  selectedItemRef?: React.RefObject<HTMLDivElement | null>;
  binder: Binder;
}) {
  return (
    <div
      key={integration.id}
      ref={selectedIntegration === integration.id ? selectedItemRef : undefined}
      onClick={() => onSelect(integration.id)}
      className={cn(
        "w-full flex flex-col gap-2 p-4 lg:px-3 lg:py-2 rounded-xl transition-colors cursor-pointer border relative",
        "hover:bg-muted/50",
        selectedIntegration === integration.id && "bg-muted",
      )}
    >
      <div className="flex items-center gap-3">
        <IntegrationIcon
          icon={integration.icon}
          name={integration.name}
          className="h-16 w-16"
        />
        <div className="flex flex-col items-start gap-1 min-w-0">
          <span className="font-medium text-left truncate">
            {integration.name}
          </span>
        </div>
      </div>
    </div>
  );
}

export function BindingSelector({
  open,
  onOpenChange,
  onIntegrationSelected,
  initialSelectedIntegration,
  binder,
}: BindingSelectorProps) {
  const [_search, setSearch] = useState("");
  const search = useDeferredValue(_search);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(
    null,
  );
  const { data: installedIntegrations = [], isLoading } = useBindings(binder);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) {
      setSelectedIntegration(null);
      setSearch("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialSelectedIntegration) {
      setSelectedIntegration(initialSelectedIntegration);
      setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({ block: "center" });
      }, 100);
    } else if (!isMobile && installedIntegrations.length > 0) {
      setSelectedIntegration(installedIntegrations[0].id);
    } else {
      setSelectedIntegration(null);
    }
  }, [open, initialSelectedIntegration, installedIntegrations, isMobile]);

  function handleUpdate() {
    if (selectedIntegration) {
      onOpenChange(true);
      onIntegrationSelected(selectedIntegration);
      onOpenChange(false);
    }
  }

  const filtered = installedIntegrations.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-full max-w-full md:h-auto md:max-w-[900px] w-full p-0 gap-0 flex flex-col border-none rounded-none md:rounded-lg [&>button]:hidden">
        <DialogTitle className="hidden">Bindings List</DialogTitle>
        <div className="flex flex-col">
          {isLoading
            ? (
              <div className="p-4 text-muted-foreground flex items-center gap-2">
                <Spinner size="xs" /> Loading integrations...
              </div>
            )
            : (
              <>
                <div
                  className={cn(
                    "flex flex-col md:hidden",
                    selectedIntegration ? "hidden" : "block",
                  )}
                >
                  <div className="border-b border-border">
                    <div className="flex items-center h-14 px-4 gap-2">
                      <Icon
                        name="search"
                        size={20}
                        className="text-muted-foreground"
                      />
                      <Input
                        placeholder="Search integrations..."
                        value={_search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 h-full border-none focus-visible:ring-0 placeholder:text-muted-foreground bg-transparent px-2"
                      />
                    </div>
                  </div>
                  <ScrollArea className="h-[calc(100vh-10rem)]">
                    <div className="p-4">
                      <div className="space-y-2">
                        {filtered.map((integration) => (
                          <ErrorBoundary key={integration.id} fallback={null}>
                            <IntegrationListItem
                              key={integration.id}
                              integration={integration}
                              selectedIntegration={selectedIntegration}
                              onSelect={setSelectedIntegration}
                              selectedItemRef={selectedItemRef}
                              binder={binder}
                            />
                          </ErrorBoundary>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </div>
                <div
                  className={cn(
                    "flex flex-col md:hidden",
                    selectedIntegration ? "block" : "hidden",
                  )}
                >
                  <div className="flex items-center gap-2 px-4 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedIntegration(null)}
                    >
                      <Icon name="arrow_back" size={20} />
                    </Button>
                    <span className="text-muted-foreground">Back</span>
                  </div>
                </div>
                <div className="hidden md:block border-b border-border">
                  <Input
                    placeholder="Search integrations..."
                    value={_search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-none border-none focus-visible:ring-0 placeholder:text-muted-foreground"
                  />
                </div>
                <div className="hidden md:flex gap-6 p-4 h-[400px] overflow-hidden">
                  <div className="w-[365px] flex-shrink-0 truncate h-full">
                    <ScrollArea className="h-full">
                      <div className="space-y-2">
                        {filtered.map((integration) => (
                          <IntegrationListItem
                            key={integration.id}
                            integration={integration}
                            selectedIntegration={selectedIntegration}
                            onSelect={setSelectedIntegration}
                            selectedItemRef={selectedItemRef}
                            binder={binder}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </>
            )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t mt-auto">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            className="bg-primary hover:bg-primary/90 rounded-lg font-normal"
            disabled={selectedIntegration === null || isLoading}
          >
            Select Integration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
