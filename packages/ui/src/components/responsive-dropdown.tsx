import * as dropdown from "./dropdown-menu.tsx";
import * as drawer from "./drawer.tsx";
import { useIsMobile } from "../hooks/use-mobile.ts";
import { createContext, useContext } from "react";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { Button } from "./button.tsx";
import { cn } from "../lib/utils.ts";

const ResponsiveDropdownContext = createContext<{
  isMobile: boolean;
  setOpen: (open: boolean) => void;
}>({
  isMobile: false,
  setOpen: () => {},
});
const useResponsiveDropdownContext = () =>
  useContext(ResponsiveDropdownContext);

const ResponsiveDropdown = ({
  children,
  defaultOpen,
  open: openProp,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof dropdown.DropdownMenu>) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
  });

  return (
    <ResponsiveDropdownContext.Provider value={{ isMobile, setOpen }}>
      <dropdown.DropdownMenu open={open} onOpenChange={setOpen} {...props}>
        <drawer.Drawer open={open} onOpenChange={setOpen} {...props}>
          {children}
        </drawer.Drawer>
      </dropdown.DropdownMenu>
    </ResponsiveDropdownContext.Provider>
  );
};

const ResponsiveDropdownContent = ({
  children,
  title,
  ...props
}: React.ComponentProps<typeof dropdown.DropdownMenuContent>) => {
  const { isMobile } = useResponsiveDropdownContext();
  const { className, ...restProps } = props;

  return isMobile
    ? (
      <drawer.DrawerContent {...restProps}>
        <drawer.DrawerHeader className="hidden">
          <drawer.DrawerTitle>
            {title}
          </drawer.DrawerTitle>
        </drawer.DrawerHeader>
        <div className={cn("flex flex-col gap-2 p-2 py-4", className)}>
          {children}
        </div>
      </drawer.DrawerContent>
    )
    : (
      <dropdown.DropdownMenuContent {...props}>
        {children}
      </dropdown.DropdownMenuContent>
    );
};

const ResponsiveDropdownItem = ({
  children,
  ...props
}: React.ComponentProps<typeof dropdown.DropdownMenuItem>) => {
  const { isMobile, setOpen } = useResponsiveDropdownContext();
  const { className, ...restProps } = props;

  return isMobile
    ? (
      <div
        {...restProps as React.HTMLAttributes<HTMLDivElement>}
        onClick={() => setOpen(false)}
        className={cn(className)}
      >
        {children}
      </div>
    )
    : (
      <dropdown.DropdownMenuItem {...props}>
        {children}
      </dropdown.DropdownMenuItem>
    );
};

const ResponsiveDropdownTrigger = ({
  children,
  ...props
}: React.ComponentProps<typeof dropdown.DropdownMenuTrigger>) => {
  const { isMobile } = useResponsiveDropdownContext();

  return isMobile
    ? (
      <drawer.DrawerTrigger asChild>
        <Button variant="ghost" {...props}>{children}</Button>
      </drawer.DrawerTrigger>
    )
    : (
      <dropdown.DropdownMenuTrigger {...props}>
        {children}
      </dropdown.DropdownMenuTrigger>
    );
};

const ResponsiveDropdownSeparator = ({
  className,
  ...props
}: React.ComponentProps<typeof dropdown.DropdownMenuSeparator>) => {
  const { isMobile } = useResponsiveDropdownContext();

  return isMobile
    ? <dropdown.DropdownMenuSeparator className={cn(className)} {...props} />
    : <dropdown.DropdownMenuSeparator className={cn(className)} {...props} />;
};

export {
  ResponsiveDropdown,
  ResponsiveDropdownContent,
  ResponsiveDropdownItem,
  ResponsiveDropdownSeparator,
  ResponsiveDropdownTrigger,
};
