import * as React from "react";
import { cn } from "@/lib/utils";

interface MobileSafeAreaProps {
  children: React.ReactNode;
  className?: string;
  top?: boolean;
  bottom?: boolean;
  inset?: boolean;
}

export function MobileSafeArea({ children, className, top, bottom, inset }: MobileSafeAreaProps) {
  return (
    <div
      className={cn(
        top && "safe-area-top",
        bottom && "safe-area-bottom",
        inset && "safe-area-inset",
        className
      )}
    >
      {children}
    </div>
  );
}

