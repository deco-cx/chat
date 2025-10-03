import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@deco/ui/components/accordion.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { useMemo, useState } from "react";
import { Preview } from "./render-preview.tsx";

interface FileArg {
  path: string;
  content: string;
}

export interface HostingAppToolLike {
  toolCallId: string;
  toolName: string;
  state: "call" | "result" | "error" | "partial-call";
  args?: {
    force?: boolean | null;
    appSlug?: string | null;
    files?: FileArg[] | null;
    envVars?: Record<string, string> | null;
    bundle?: boolean | null;
    unlisted?: boolean | null;
    [key: string]: unknown;
  } | null;
  result?: unknown;
  error?: unknown;
}

interface IssueDetail {
  code?: string;
  expected?: string;
  received?: string;
  path?: string[];
  message?: string;
}

function tryParseIssuesFromError(errorText: string): IssueDetail[] {
  const start = errorText.indexOf("[");
  const end = errorText.lastIndexOf("]");

  const hasJSONString = start !== -1;

  if (!hasJSONString) return [];

  const slicedErrorText = errorText.slice(start, end + 1);
  try {
    const json = JSON.parse(slicedErrorText) as IssueDetail;
    const arrayied = Array.isArray(json) ? json : [];

    return arrayied;
  } catch {
    return [];
  }
}

function KeyValueRow({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {typeof value === "boolean" ? (
          <Badge variant={value ? "default" : "secondary"}>
            {String(value)}
          </Badge>
        ) : value === null || value === undefined || value === "" ? (
          <Badge variant="secondary">none</Badge>
        ) : (
          <span className="font-medium">{String(value)}</span>
        )}
      </div>
    </div>
  );
}

function FileViewer({ files }: { files: FileArg[] }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <Accordion
      type="single"
      collapsible
      value={active ?? undefined}
      onValueChange={setActive}
      className="w-full"
    >
      {files.map((file) => (
        <AccordionItem
          key={file.path}
          value={file.path}
          className="border-border"
        >
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Icon name="description" className="text-muted-foreground" />
              <span>{file.path}</span>
              <Badge variant="secondary" className="ml-2">
                {new Blob([file.content]).size} bytes
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="rounded-md border bg-muted/30">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  {file.path}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigator.clipboard.writeText(file.content)}
                  className="h-7 w-7 rounded-full"
                  title="Copy file contents"
                >
                  <Icon
                    name="content_copy"
                    className="text-sm text-muted-foreground"
                  />
                </Button>
              </div>
              <Separator />
              <ScrollArea className="max-h-[360px]">
                <pre className="p-3 text-xs overflow-x-auto">
                  {file.content}
                </pre>
              </ScrollArea>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function HostingAppDeploy({ tool }: { tool: HostingAppToolLike }) {
  const errorText = useMemo(
    () => (typeof tool.result === "string" ? tool.result : null),
    [tool],
  );
  const args = (tool.args ?? {}) as Required<
    NonNullable<HostingAppToolLike["args"]>
  >;
  const files: FileArg[] = Array.isArray(args?.files)
    ? (args.files as FileArg[])
    : [];
  const envVars = (args?.envVars ?? null) as Record<string, string> | null;

  const errorIssues = useMemo(
    () =>
      typeof errorText === "string" ? tryParseIssuesFromError(errorText) : null,
    [errorText],
  );

  if (!errorText) {
    // Success/default: keep Preview behavior and provide an expandable details section
    const resultObj = (tool.result ?? {}) as Record<string, unknown>;
    const content = [
      { text: JSON.stringify(resultObj.structuredContent) },
    ] as unknown as string;
    const title = (resultObj?.title as string) ?? "Preview";

    return (
      <div className="space-y-3">
        {content ? <Preview content={content} title={title} /> : null}
        <Card className="border-border">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="details">
              <AccordionTrigger className="p-4">
                <div className="flex items-center gap-2">
                  <Icon name="settings" className="text-muted-foreground" />
                  <span className="font-medium">Deployment details</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <KeyValueRow label="Force" value={args?.force ?? null} />
                    <KeyValueRow
                      label="App slug"
                      value={args?.appSlug ?? null}
                    />
                    <KeyValueRow label="Bundle" value={args?.bundle ?? null} />
                    <KeyValueRow
                      label="Unlisted"
                      value={args?.unlisted ?? null}
                    />
                    <KeyValueRow label="Files" value={files.length} />
                    <KeyValueRow
                      label="Env vars"
                      value={envVars ? Object.keys(envVars).length : 0}
                    />
                  </div>

                  {envVars && Object.keys(envVars).length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">
                        Environment variables
                      </div>
                      <div className="rounded-md border">
                        <div className="divide-y">
                          {Object.entries(envVars).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between px-3 py-2 text-sm"
                            >
                              <span className="text-muted-foreground">
                                {key}
                              </span>
                              <span className="font-mono">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {files.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Files</div>
                      <FileViewer files={files} />
                    </div>
                  )}
                </CardContent>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </div>
    );
  }

  // Error UI: match styling with deployment details
  return (
    <Card className="border-destructive">
      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue="error-root"
      >
        <AccordionItem value="error-root">
          <AccordionTrigger className="p-4">
            <div className="flex items-center gap-2">
              <Icon name="error" className="text-destructive" />
              <span className="font-medium">Deployment failed</span>
            </div>
          </AccordionTrigger>

          <AccordionContent className="px-4">
            <CardContent>
              <Accordion type="multiple" defaultValue={["error-details"]}>
                <AccordionItem value="error-details">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Icon name="error" className="text-muted-foreground" />
                      <span className="font-medium">Error details</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="rounded-md border border-destructive/40 bg-destructive/5">
                      <ScrollArea className="h-[220px]">
                        <pre className="p-3 text-xs whitespace-pre-wrap break-words text-destructive">
                          {errorText}
                        </pre>
                      </ScrollArea>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {errorIssues && errorIssues.length > 0 && (
                  <AccordionItem value="validation-issues">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Icon name="list" className="text-muted-foreground" />
                        <span className="font-medium">Validation issues</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="rounded-md border divide-y">
                        {errorIssues.map((issue, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-2 text-sm flex flex-col gap-1"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="uppercase text-[10px] tracking-wide"
                              >
                                {issue.code || "invalid"}
                              </Badge>
                              <span className="font-medium">
                                {issue.message}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                              <div>
                                Path:{" "}
                                <span className="font-mono">
                                  {issue.path?.join(".")}
                                </span>
                              </div>
                              <div>
                                Expected:{" "}
                                <span className="font-mono">
                                  {issue.expected}
                                </span>
                              </div>
                              <div>
                                Received:{" "}
                                <span className="font-mono">
                                  {issue.received}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
