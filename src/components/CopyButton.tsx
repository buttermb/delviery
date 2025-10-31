import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type CopyButtonSize = "sm" | "md" | "lg" | "icon";
type CopyButtonVariant = "default" | "secondary" | "outline" | "ghost";

interface CopyButtonProps {
  text: string;
  label?: string;
  size?: CopyButtonSize;
  variant?: CopyButtonVariant;
  showLabel?: boolean;
  className?: string;
}

export default function CopyButton({
  text,
  label = "Copy",
  size = "sm",
  variant = "outline",
  showLabel = true,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const iconSize = size === "lg" ? 18 : size === "icon" ? 18 : 16;

  return (
    <Button
      type="button"
      onClick={handleCopy}
      size={size === "md" ? "default" : (size as any)}
      variant={variant as any}
      className={className}
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check className="h-4 w-4" style={{ width: iconSize, height: iconSize }} />
      ) : (
        <Copy className="h-4 w-4" style={{ width: iconSize, height: iconSize }} />
      )}
      {showLabel && <span className="ml-2">{label}</span>}
    </Button>
  );
}
