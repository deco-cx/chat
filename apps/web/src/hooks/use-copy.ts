import { useRef, useState } from "react";

export function useCopy() {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    timeoutRef.current && clearTimeout(timeoutRef.current);
    // @ts-ignore - setTimeout returns number in browser
    timeoutRef.current = setTimeout(() => setCopied(false), 1200);
  };

  return {
    handleCopy,
    copied,
  };
}
