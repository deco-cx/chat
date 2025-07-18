import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState } from "react";

interface PasswordInputProps extends React.ComponentProps<typeof Input> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  className,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = async () => {
    if (value) {
      try {
        await navigator.clipboard.writeText(value);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error("Failed to copy text: ", err);
      }
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="relative">
      <Input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn("pr-20", className)}
        {...props}
      />
      <div className="absolute right-1 top-1 flex items-center gap-1 h-8">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={togglePasswordVisibility}
          title={showPassword ? "Hide password" : "Show password"}
        >
          <Icon
            name={showPassword ? "visibility_off" : "visibility"}
            size={16}
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleCopy}
          disabled={!value}
          title={copySuccess ? "Copied!" : "Copy token"}
        >
          <Icon name={copySuccess ? "check" : "content_copy"} size={16} />
        </Button>
      </div>
    </div>
  );
}

export { PasswordInput };
