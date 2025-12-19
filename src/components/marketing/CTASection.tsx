import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface CTASectionProps {
  title: string;
  description: string;
  primaryCta: {
    text: string;
    link: string;
  };
  secondaryCta?: {
    text: string;
    link: string;
  };
  variant?: "default" | "gradient" | "minimal";
}

export function CTASection({
  title,
  description,
  primaryCta,
  secondaryCta,
  variant = "default",
}: CTASectionProps) {
  const containerClass = {
    default: "bg-gradient-to-r from-[hsl(var(--marketing-primary))]/20 via-[hsl(var(--marketing-primary))]/10 to-[hsl(var(--marketing-primary))]/20",
    gradient: "hero-gradient text-white",
    minimal: "bg-[hsl(var(--marketing-bg-subtle))]",
  }[variant];

  const textColorClass = variant === "gradient" ? "text-white" : "";

  return (
    <section className={`container mx-auto px-4 py-20 relative overflow-hidden`}>
      {/* Background Glow for Gradient Variant */}
      {variant === "gradient" && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[hsl(var(--marketing-primary))] opacity-10 blur-[100px] pointer-events-none" />
      )}

      <div className={`relative max-w-4xl mx-auto text-center p-12 rounded-3xl ${containerClass} overflow-hidden group`}>

        {/* Animated Gradient Border for Default Variant */}
        {variant === "default" && (
          <div className="absolute inset-0 p-[2px] rounded-3xl bg-gradient-to-r from-[hsl(var(--marketing-primary))] via-[hsl(var(--marketing-accent))] to-[hsl(var(--marketing-primary))] opacity-50 group-hover:opacity-100 transition-opacity duration-500 -z-10 bg-[length:200%_100%] animate-shimmer" />
        )}

        <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${textColorClass || "text-[hsl(var(--marketing-text))]"}`}>
          {title}
        </h2>
        <p className={`text-xl mb-8 ${textColorClass ? "text-white/90" : "text-[hsl(var(--marketing-text-light))]"}`}>
          {description}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link to={primaryCta.link}>
            <div className="relative group/btn">
              <div className="absolute -inset-1 bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] rounded-lg blur opacity-25 group-hover/btn:opacity-75 transition duration-200" />
              <Button
                size="lg"
                className={`relative h-16 px-12 text-xl font-bold shadow-xl transform transition-all duration-200 hover:scale-105 ${variant === "gradient"
                    ? "bg-background text-[hsl(var(--marketing-primary))] hover:bg-background/90"
                    : "bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white"
                  }`}
              >
                {primaryCta.text.replace(' →', '')}
                <ArrowRight className="ml-2 h-6 w-6 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
            </div>
          </Link>
          {secondaryCta && (
            <Link to={secondaryCta.link}>
              <Button
                size="lg"
                variant="outline"
                className="h-16 px-10 text-lg border-2 hover:bg-[hsl(var(--marketing-bg-subtle))] hover:text-[hsl(var(--marketing-primary))]"
              >
                {secondaryCta.text}
              </Button>
            </Link>
          )}
        </div>
        {variant !== "gradient" && (
          <p className="text-sm text-[hsl(var(--marketing-text-light))] mt-6 opacity-80">
            No credit card required • Cancel anytime
          </p>
        )}
      </div>
    </section>
  );
}

