/**
 * Optimistic Button Component
 * Button with built-in optimistic update state management
 */

import { ReactNode, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Check from "lucide-react/dist/esm/icons/check";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import { cn } from '@/lib/utils';
import { haptics } from '@/utils/haptics';

interface OptimisticButtonProps {
  onClick?: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  isOptimistic?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  successIcon?: ReactNode;
  loadingIcon?: ReactNode;
  errorIcon?: ReactNode;
}

export function OptimisticButton({
  onClick,
  children,
  className,
  variant = 'default',
  size = 'default',
  disabled = false,
  type = 'button',
  isOptimistic = false,
  isLoading = false,
  hasError = false,
  successIcon = <Check className="h-4 w-4" />,
  loadingIcon = <Loader2 className="h-4 w-4 animate-spin" />,
  errorIcon = <AlertCircle className="h-4 w-4" />,
}: OptimisticButtonProps) {
  const showSuccess = isOptimistic && !isLoading && !hasError;
  const showLoading = isLoading;
  const showError = hasError;
  const prevSuccessRef = useRef(false);
  const prevErrorRef = useRef(false);

  // Haptic feedback on state changes
  useEffect(() => {
    if (showSuccess && !prevSuccessRef.current) {
      haptics.success();
      prevSuccessRef.current = true;
    } else if (!showSuccess) {
      prevSuccessRef.current = false;
    }
  }, [showSuccess]);

  useEffect(() => {
    if (showError && !prevErrorRef.current) {
      haptics.error();
      prevErrorRef.current = true;
    } else if (!showError) {
      prevErrorRef.current = false;
    }
  }, [showError]);

  const handleClick = () => {
    haptics.light(); // Light haptic on click
    onClick?.();
  };

  return (
    <Button
      onClick={handleClick}
      type={type}
      className={cn(
        'transition-all duration-200',
        showSuccess && 'bg-green-500 hover:bg-green-600',
        showError && 'bg-red-500 hover:bg-red-600',
        className
      )}
      variant={variant}
      size={size}
      disabled={disabled || isLoading}
    >
      {showLoading && (
        <span className="mr-2">{loadingIcon}</span>
      )}
      {showSuccess && (
        <span className="mr-2">{successIcon}</span>
      )}
      {showError && (
        <span className="mr-2">{errorIcon}</span>
      )}
      {children}
    </Button>
  );
}
