/**
 * Skip to Content Link
 * Provides keyboard users with quick access to main content
 * WCAG 2.1 AA compliant
 */

import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SkipToContentProps {
  targetId?: string;
  label?: string;
  className?: string;
}

export function SkipToContent({ 
  targetId = "main-content", 
  label = "Skip to main content",
  className 
}: SkipToContentProps) {
  return (
    <Link
      to={`#${targetId}`}
      onClick={(e) => {
        e.preventDefault();
        const element = document.getElementById(targetId);
        if (element) {
          element.focus();
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }}
      className={cn(
        "sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-50",
        "focus-visible:px-4 focus-visible:py-2 focus-visible:bg-primary focus-visible:text-primary-foreground",
        "focus-visible:rounded-md focus-visible:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      aria-label={label}
    >
      {label}
    </Link>
  );
}

