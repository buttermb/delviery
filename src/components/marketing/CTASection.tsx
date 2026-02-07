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
  variant?: "default" | "minimal";
}

export function CTASection({
  title,
  description,
  primaryCta,
  secondaryCta,
  variant = "default",
}: CTASectionProps) {
  return (
    <section className="container mx-auto px-4 py-20">
      <div className={`relative max-w-3xl mx-auto text-center p-12 rounded-xl ${variant === "minimal"
          ? "bg-[hsl(var(--marketing-bg-subtle))]"
          : "bg-[hsl(var(--marketing-bg))] border border-[hsl(var(--marketing-border))]"
        }`}>
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
          {title}
        </h2>
        <p className="text-lg mb-8 text-[hsl(var(--marketing-text-light))] max-w-xl mx-auto">
          {description}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link to={primaryCta.link}>
            <Button
              size="lg"
              className="h-12 px-8 font-semibold bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white rounded-lg"
            >
              {primaryCta.text.replace(' →', '')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>

          {secondaryCta && (
            <Link to={secondaryCta.link}>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text))] hover:bg-[hsl(var(--marketing-bg-subtle))] rounded-lg"
              >
                {secondaryCta.text}
              </Button>
            </Link>
          )}
        </div>

        <p className="text-sm text-[hsl(var(--marketing-text-light))] mt-6">
          No credit card required. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
