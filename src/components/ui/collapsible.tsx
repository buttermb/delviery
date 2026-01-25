import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { motion, AnimatePresence } from "framer-motion";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ children, className, ...props }, ref) => (
  <CollapsiblePrimitive.Content ref={ref} className={className} {...props} asChild>
    <AnimatePresence initial={false}>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{
          height: { duration: 0.2, ease: "easeInOut" },
          opacity: { duration: 0.15, ease: "easeInOut" },
        }}
        style={{ overflow: "hidden" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  </CollapsiblePrimitive.Content>
));
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
