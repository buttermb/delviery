import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SaveButtonProps extends Omit<ButtonProps, "loading"> {
  isPending: boolean;
  isSuccess?: boolean;
  /** Duration in ms to show the checkmark flash (default: 2000) */
  flashDuration?: number;
}

export function SaveButton({
  isPending,
  isSuccess,
  flashDuration = 2000,
  children,
  className,
  disabled,
  ...props
}: SaveButtonProps) {
  const [showCheck, setShowCheck] = useState(false);
  const prevPendingRef = useRef(false);

  useEffect(() => {
    // Detect transition from isPending=true → isPending=false with isSuccess=true
    if (prevPendingRef.current && !isPending && isSuccess) {
      setShowCheck(true);
      const timer = setTimeout(() => setShowCheck(false), flashDuration);
      return () => clearTimeout(timer);
    }
    prevPendingRef.current = isPending;
  }, [isPending, isSuccess, flashDuration]);

  return (
    <Button
      className={cn(
        "transition-all",
        showCheck && "border-green-500 dark:border-green-400",
        className
      )}
      disabled={disabled || isPending}
      {...props}
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : showCheck ? (
        <Check className="mr-2 h-4 w-4 text-green-500 dark:text-green-400 animate-scale-in" />
      ) : null}
      {children}
    </Button>
  );
}
