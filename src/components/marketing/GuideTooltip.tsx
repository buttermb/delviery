import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface GuideTooltipProps {
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
  onNext: () => void;
  onSkip: () => void;
  className?: string;
}

export function GuideTooltip({
  step,
  totalSteps,
  title,
  description,
  position = "bottom",
  onNext,
  onSkip,
  className = "",
}: GuideTooltipProps) {
  const positionClasses = {
    top: "bottom-full mb-2",
    bottom: "top-full mt-2",
    left: "right-full mr-2",
    right: "left-full ml-2",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: position === "top" ? 10 : -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`absolute ${positionClasses[position]} ${className} z-50`}
    >
      <div className="bg-card border-2 border-primary rounded-lg shadow-xl p-4 max-w-xs">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              {step}
            </div>
            <span className="text-xs text-muted-foreground">
              Step {step} of {totalSteps}
            </span>
          </div>
          <button
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <h4 className="font-semibold text-foreground mb-1">{title}</h4>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={onNext}
            size="sm"
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            {step === totalSteps ? "Finish" : "Next"}
          </Button>
          <Button
            onClick={onSkip}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            Skip Tour
          </Button>
        </div>

        {/* Arrow pointer */}
        <div
          className={`absolute w-3 h-3 bg-card border-primary rotate-45 ${
            position === "top"
              ? "top-full -mt-[7px] border-b-2 border-r-2"
              : position === "bottom"
              ? "bottom-full -mb-[7px] border-t-2 border-l-2"
              : position === "left"
              ? "left-full -ml-[7px] border-t-2 border-r-2"
              : "right-full -mr-[7px] border-b-2 border-l-2"
          } left-1/2 -translate-x-1/2`}
        />
      </div>
    </motion.div>
  );
}
