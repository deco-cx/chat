import * as select from "./select.tsx";
import * as drawer from "./drawer.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { createContext, useContext } from "react";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { Button } from "./button.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

const ResponsiveSelectContext = createContext<{
  isMobile: boolean;
  setValue: (value: string) => void;
}>({
  isMobile: false,
  setValue: () => {},
});
const useResponsiveSelectContext = () => useContext(ResponsiveSelectContext);

const ResponsiveSelect = ({
  children,
  defaultOpen,
  open: openProp,
  onOpenChange,
  defaultValue,
  value: valueProp,
  onValueChange,
  ...props
}: React.ComponentProps<typeof select.Select>) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
  });
  const [value, _setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });

  const setValue = (val: string) => {
    if (val) {
      _setValue(val);
    }
  };

  return (
    <ResponsiveSelectContext.Provider value={{ isMobile, setValue }}>
      <select.Select
        open={open}
        onOpenChange={setOpen}
        value={value}
        onValueChange={setValue}
        {...props}
      >
        <drawer.Drawer open={open} onOpenChange={setOpen} {...props}>
          {children}
        </drawer.Drawer>
      </select.Select>
    </ResponsiveSelectContext.Provider>
  );
};

const ResponsiveSelectContent = ({
  children,
  title,
  ...props
}: React.ComponentProps<typeof select.SelectContent>) => {
  const { isMobile } = useResponsiveSelectContext();
  const { className, ...restProps } = props;

  return isMobile ? (
    <drawer.DrawerContent {...restProps}>
      <drawer.DrawerHeader className="hidden">
        <drawer.DrawerTitle>{title}</drawer.DrawerTitle>
      </drawer.DrawerHeader>
      <div className={cn("flex flex-col gap-2 p-2 py-4", className)}>
        {children}
      </div>
    </drawer.DrawerContent>
  ) : (
    <select.SelectContent {...props}>{children}</select.SelectContent>
  );
};

const ResponsiveSelectItem = ({
  children,
  ...props
}: React.ComponentProps<typeof select.SelectItem>) => {
  const { isMobile, setValue } = useResponsiveSelectContext();
  const { className, ...restProps } = props;

  return isMobile ? (
    <div
      {...restProps}
      onClick={() => setValue(props.value)}
      className={cn(className)}
    >
      {children}
    </div>
  ) : (
    <select.SelectItem {...props}>{children}</select.SelectItem>
  );
};

const ResponsiveSelectTrigger = ({
  children,
  ...props
}: React.ComponentProps<typeof select.SelectTrigger>) => {
  const { isMobile } = useResponsiveSelectContext();

  return isMobile ? (
    <drawer.DrawerTrigger asChild>
      <Button variant="outline" {...props}>
        {children}
      </Button>
    </drawer.DrawerTrigger>
  ) : (
    <select.SelectTrigger {...props}>{children}</select.SelectTrigger>
  );
};

const ResponsiveSelectValue = ({
  children,
  ...props
}: React.ComponentProps<typeof select.SelectValue>) => {
  const { isMobile } = useResponsiveSelectContext();

  return isMobile ? (
    <span {...props}>{children}</span>
  ) : (
    <select.SelectValue {...props}>{children}</select.SelectValue>
  );
};

export {
  ResponsiveSelect,
  ResponsiveSelectContent,
  ResponsiveSelectItem,
  ResponsiveSelectTrigger,
  ResponsiveSelectValue,
};
