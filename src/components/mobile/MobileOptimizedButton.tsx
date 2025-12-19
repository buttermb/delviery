import * as React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button, ButtonProps } from "@/components/ui/button";

export interface MobileOptimizedButtonProps extends ButtonProps {
  mobileFullWidth?: boolean;
}

const MobileOptimizedButton = React.forwardRef<HTMLButtonElement, MobileOptimizedButtonProps>(
  ({ className, mobileFullWidth = true, ...props }, ref) => {
    const isMobile = useIsMobile();
    
    return (
      <Button
        ref={ref}
        className={cn(
          isMobile && mobileFullWidth && "w-full",
          className
        )}
        {...props}
      />
    );
  }
);

MobileOptimizedButton.displayName = "MobileOptimizedButton";

export { MobileOptimizedButton };

