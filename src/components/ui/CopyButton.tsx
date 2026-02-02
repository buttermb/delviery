import { useState } from "react";
import { Button } from "@/components/ui/button";
import Check from "lucide-react/dist/esm/icons/check";
import Copy from "lucide-react/dist/esm/icons/copy";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  showToast?: boolean;
  toastMessage?: string;
}

export function CopyButton({
  value,
  label,
  className,
  size = "icon",
  variant = "ghost",
  showToast = true,
  toastMessage,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      
      if (showToast) {
        toast.success(toastMessage || "Copied to clipboard");
      }
      
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        "transition-all",
        size === "icon" && "h-8 w-8",
        className
      )}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500 dark:text-green-400" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {label && <span className="ml-2">{label}</span>}
    </Button>
  );
}

// Inline copy text with button
interface CopyTextProps {
  value: string;
  displayValue?: string;
  className?: string;
  truncate?: boolean;
  maxWidth?: string;
}

export function CopyText({
  value,
  displayValue,
  className,
  truncate = true,
  maxWidth = "150px",
}: CopyTextProps) {
  return (
    <div className={cn("flex items-center gap-1 group", className)}>
      <span
        className={cn(
          "font-mono text-sm",
          truncate && "truncate"
        )}
        style={truncate ? { maxWidth } : undefined}
        title={value}
      >
        {displayValue || value}
      </span>
      <CopyButton
        value={value}
        size="icon"
        variant="ghost"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        showToast={true}
      />
    </div>
  );
}