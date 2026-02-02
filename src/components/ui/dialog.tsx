import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import X from "lucide-react/dist/esm/icons/x";

import { cn } from "@/lib/utils";
import { getFocusableElements } from "@/hooks/useKeyboardNavigation";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Auto-focus the first focusable element when dialog opens */
  autoFocus?: boolean;
  /** Selector for element to focus on open (e.g., "[data-autofocus]" or "#email-input") */
  initialFocusSelector?: string;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, autoFocus = true, initialFocusSelector, ...props }, ref) => {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElement = React.useRef<Element | null>(null);

  // Handle focus management when dialog opens
  const handleOpenAutoFocus = React.useCallback((event: Event) => {
    // Store the currently focused element for restoration
    previousActiveElement.current = document.activeElement;

    if (!autoFocus) {
      event.preventDefault();
      return;
    }

    // Small delay to ensure content is rendered
    requestAnimationFrame(() => {
      if (!contentRef.current) return;

      // Try to focus the specified element first
      if (initialFocusSelector) {
        const targetElement = contentRef.current.querySelector<HTMLElement>(initialFocusSelector);
        if (targetElement && !targetElement.hasAttribute('disabled')) {
          targetElement.focus();
          event.preventDefault();
          return;
        }
      }

      // Try to focus element with data-autofocus attribute
      const autoFocusElement = contentRef.current.querySelector<HTMLElement>('[data-autofocus]');
      if (autoFocusElement && !autoFocusElement.hasAttribute('disabled')) {
        autoFocusElement.focus();
        event.preventDefault();
        return;
      }

      // Otherwise focus the first focusable element
      const focusableElements = getFocusableElements(contentRef.current);
      // Skip the close button (first focusable) and focus the first content element
      const firstContentElement = focusableElements.find(
        (el) => !el.closest('[data-radix-dialog-close]') && el.tagName !== 'BUTTON'
      ) || focusableElements[0];

      if (firstContentElement) {
        firstContentElement.focus();
        event.preventDefault();
      }
    });
  }, [autoFocus, initialFocusSelector]);

  // Handle focus restoration when dialog closes
  const handleCloseAutoFocus = React.useCallback((event: Event) => {
    // Restore focus to the previously focused element
    if (previousActiveElement.current instanceof HTMLElement) {
      event.preventDefault();
      previousActiveElement.current.focus();
    }
  }, []);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={(node) => {
          // Handle both refs
          (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className={cn(
          "fixed left-[50%] top-[50%] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-4 sm:p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          "max-h-[90vh] overflow-y-auto",
          "[-webkit-overflow-scrolling:touch] overscroll-contain",
          "w-[calc(100vw-2rem)] sm:w-full",
          // Mobile optimizations
          "mobile-input-container",
          className,
        )}
        style={{ zIndex: 60 }}
        onOpenAutoFocus={handleOpenAutoFocus}
        onCloseAutoFocus={handleCloseAutoFocus}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-full p-2 bg-background border-2 border-border shadow-md opacity-90 ring-offset-background transition-all hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-10 min-h-[44px] min-w-[44px] touch-manipulation">
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
