import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { ALLOWANCES } from "../../../constants.ts";
import {
  IMAGE_REGEXP,
  openPreviewPanel,
  toIframeProps,
} from "../utils/preview.ts";
import { Dialog, DialogContent } from "@deco/ui/components/dialog.tsx";
import { useState } from "react";

interface PreviewProps {
  title?: string;
  content: string;
  className?: string;
}

const BUTTON_STYLES = {
  base:
    "h-8 w-8 rounded-full bg-slate-900/10 hover:bg-slate-900/20 duration-200",
  icon: "text-sm text-white",
} as const;

interface ImageActionButtonProps {
  icon: string;
  label: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  href?: string;
  download?: string;
}

function ImageActionButton({
  icon,
  label,
  onClick,
  href,
  download,
}: ImageActionButtonProps) {
  const button = (
    <Button
      variant="ghost"
      size="icon"
      className={BUTTON_STYLES.base}
      onClick={onClick}
      aria-label={label}
      {...(href ? { asChild: true } : {})}
    >
      {href
        ? (
          <a
            href={href}
            download={download}
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name={icon} className={BUTTON_STYLES.icon} />
          </a>
        )
        : <Icon name={icon} className={BUTTON_STYLES.icon} />}
    </Button>
  );

  return button;
}

interface ImagePreviewProps {
  src: string;
  title?: string;
  onExpand: () => void;
  onOpenDialog: () => void;
  className?: string;
}

function ImagePreview({
  src,
  title,
  onExpand,
  onOpenDialog,
  className,
}: ImagePreviewProps) {
  return (
    <div
      className={cn(
        "relative w-max rounded-lg my-4 overflow-hidden group/image",
        className,
      )}
      onClick={onOpenDialog}
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover/image:opacity-100 transition-opacity z-10 flex gap-2">
        <ImageActionButton
          icon="expand_content"
          label="Open in panel"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onExpand();
          }}
        />
        <ImageActionButton
          icon="download"
          label="Download image"
          href={src}
          download={title || "image"}
        />
      </div>
      <div className="w-max max-w-[420px]">
        <img
          src={src}
          alt={title || "Preview"}
          className="w-full h-auto rounded-2xl shadow-lg cursor-pointer"
        />
      </div>
    </div>
  );
}

interface ImageDialogProps {
  src: string;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
  onExpand: () => void;
}

function ImageDialog({
  src,
  title,
  isOpen,
  onClose,
}: ImageDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] sm:max-w-2xl sm:max-h-2xl p-0 border-none shadow-xl rounded-2xl">
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <ImageActionButton
            icon="download"
            label="Download image"
            href={src}
            download={title || "image"}
          />
          <ImageActionButton
            icon="close"
            label="Close dialog"
            onClick={onClose}
          />
        </div>
        <div className="w-full h-full flex items-center justify-center">
          <img
            src={src}
            alt={title || "Preview"}
            className="max-w-full max-h-full object-contain rounded-2xl"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface HtmlPreviewProps {
  title?: string;
  iframeProps: ReturnType<typeof toIframeProps>;
  onExpand: () => void;
  className?: string;
}

function HtmlPreview({
  title,
  iframeProps,
  onExpand,
  className,
}: HtmlPreviewProps) {
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
          onClick={onExpand}
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
        <iframe
          {...iframeProps}
          className="absolute inset-0 w-full h-full rounded-2xl shadow-lg"
          title={title || "Preview content"}
          allow={ALLOWANCES}
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  );
}

export function Preview({ content, title, className }: PreviewProps) {
  const iframeProps = toIframeProps(content);
  const isImageLike = iframeProps.src && IMAGE_REGEXP.test(iframeProps.src);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleExpand = () => {
    openPreviewPanel(
      `preview-${title?.toLowerCase().replace(/\s+/g, "-")}`,
      content,
      title || "Preview",
    );
  };

  if (isImageLike) {
    return (
      <>
        <ImagePreview
          src={iframeProps.src}
          title={title}
          onExpand={handleExpand}
          onOpenDialog={() => setIsDialogOpen(true)}
          className={className}
        />
        <ImageDialog
          src={iframeProps.src}
          title={title}
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onExpand={handleExpand}
        />
      </>
    );
  }

  return (
    <HtmlPreview
      title={title}
      iframeProps={iframeProps}
      onExpand={handleExpand}
      className={className}
    />
  );
}
