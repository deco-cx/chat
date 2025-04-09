import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { togglePanel } from "../../agent/index.tsx";

interface PreviewProps {
  type: "url" | "html";
  title?: string;
  content: string;
  className?: string;
}

const toIframeProps = (content: string) => {
  try {
    const url = new URL(content);

    return {
      src: url.href,
    };
  } catch {
    const html = new DOMParser().parseFromString(content, "text/html")
      .documentElement.outerHTML;

    return {
      srcDoc: html,
    };
  }
};

const IMAGE_REGEXP = /\.png|\.jpg|\.jpeg|\.gif|\.webp/;

export function Preview({ content, title, className }: PreviewProps) {
  const iframeProps = toIframeProps(content);
  const isImageLike = iframeProps.src && IMAGE_REGEXP.test(iframeProps.src);

  const handleExpand = () => {
    togglePanel({
      id: `preview-${title?.toLowerCase().replace(/\s+/g, "-")}`,
      component: "preview",
      title: title || "Preview",
      params: iframeProps,
      position: { direction: "right" },
      initialWidth: 400,
    });
  };

  return (
    <div
      className={cn(
        "relative w-max flex flex-col rounded-lg mb-4 p-1",
        className,
      )}
    >
      <div className="flex items-center justify-between p-2 pr-0">
        <div className="flex items-center gap-2">
          <Icon name="draft" className="text-sm text-muted-foreground" />
          <p className="text-sm font-medium tracking-tight">
            {title || "Preview"}
          </p>
        </div>
        <Button
          onClick={handleExpand}
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-muted"
          aria-label="Expand preview"
        >
          <Icon
            name="expand_content"
            className="text-sm text-muted-foreground"
          />
        </Button>
      </div>

      <div className="w-max relative h-[420px] min-h-0 aspect-[4/5]">
        {isImageLike
          ? (
            <img
              src={iframeProps.src}
              alt={title || "Preview"}
              className="absolute inset-0 w-full h-full rounded-2xl shadow-lg"
            />
          )
          : (
            <iframe
              {...iframeProps}
              className="absolute inset-0 w-full h-full rounded-2xl shadow-lg"
              sandbox="allow-scripts"
              title={title || "Preview content"}
            />
          )}
      </div>
    </div>
  );
}
