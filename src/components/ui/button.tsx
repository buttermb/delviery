import * as React from "react";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-strong hover:shadow-elegant hover:scale-105 hover:brightness-110 font-semibold relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700 dark:shadow-md dark:hover:shadow-lg",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:scale-105 hover:shadow-lg transition-all dark:bg-destructive dark:text-destructive-foreground dark:hover:bg-destructive/80",
        outline: "border-2 border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary hover:shadow-md font-medium hover:scale-105 dark:border-border dark:text-foreground dark:hover:bg-accent dark:hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-md hover:scale-105 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/70",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground hover:scale-105 dark:text-foreground dark:hover:bg-accent dark:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline hover:brightness-110 dark:text-primary",
        hero: "bg-gradient-to-r from-primary via-primary to-primary bg-[length:200%_100%] text-primary-foreground hover:bg-[position:100%_0] shadow-strong hover:shadow-elegant hover:scale-105 hover:brightness-110 font-semibold relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700 dark:shadow-md dark:hover:shadow-lg",
        mobile: "w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-lg active:scale-95 md:w-auto md:shadow-none md:active:scale-100 dark:bg-primary dark:text-primary-foreground", // Mobile-optimized variant
      },
      size: {
        default: "h-11 px-4 py-2 rounded-lg", // Use rounded-lg for button shape
        sm: "h-10 px-3 rounded-lg",
        lg: "h-12 px-8 rounded-lg",
        icon: "h-11 w-11 rounded-lg", // Square buttons with rounded corners
        mobile: "h-12 px-6 rounded-lg text-base", // Extra large for mobile
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    // When using asChild (Slot), we must pass exactly one child element.
    // We cannot inject the Loader2 icon alongside children because Slot enforces a single child.
    // So we skip the loading icon injection when asChild is true.
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {props.children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {props.children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
