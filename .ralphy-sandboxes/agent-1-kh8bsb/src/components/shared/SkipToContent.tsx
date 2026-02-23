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
        "sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50",
        "focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground",
        "focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring",
        className
      )}
      aria-label={label}
    >
      {label}
    </Link>
  );
}

