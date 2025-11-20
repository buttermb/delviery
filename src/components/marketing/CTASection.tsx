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
    <section className={`container mx-auto px-4 py-20`}>
      <div className={`max-w-4xl mx-auto text-center p-12 rounded-3xl ${containerClass}`}>
        <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${textColorClass || "text-[hsl(var(--marketing-text))]"}`}>
          {title}
        </h2>
        <p className={`text-xl mb-8 ${textColorClass ? "text-white/90" : "text-[hsl(var(--marketing-text-light))]"}`}>
          {description}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to={primaryCta.link}>
            <Button
              size="lg"
              className={`h-14 px-10 text-lg ${
                variant === "gradient"
                  ? "bg-background text-[hsl(var(--marketing-primary))] hover:bg-background/90"
                  : "bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white"
              }`}
            >
              {primaryCta.text.replace(' →', '')}
              <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </Link>
          {secondaryCta && (
            <Link to={secondaryCta.link}>
              <Button size="lg" variant="outline" className="h-14 px-10 text-lg">
                {secondaryCta.text}
              </Button>
            </Link>
          )}
        </div>
        {variant !== "gradient" && (
          <p className="text-sm text-[hsl(var(--marketing-text-light))] mt-4">
            No credit card required • Cancel anytime
          </p>
        )}
      </div>
    </section>
  );
}

