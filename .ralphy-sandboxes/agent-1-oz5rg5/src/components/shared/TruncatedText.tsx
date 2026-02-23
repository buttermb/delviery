import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TruncatedTextProps {
  text: string;
  className?: string;
  /** Max width CSS class, e.g. "max-w-[200px]" */
  maxWidthClass?: string;
  as?: "span" | "p" | "div";
}

/**
 * Renders text with CSS truncation (ellipsis) and shows full text in a Tooltip on hover.
 * Requires TooltipProvider to be present in parent tree (already in App.tsx).
 */
export function TruncatedText({
  text,
  className,
  maxWidthClass,
  as: Tag = "span",
}: TruncatedTextProps) {
  if (!text) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Tag className={cn("truncate block", maxWidthClass, className)}>
          {text}
        </Tag>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="break-words">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}
