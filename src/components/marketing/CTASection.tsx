import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";

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
  variant?: "default" | "minimal" | "dark";
}

export function CTASection({
  title,
  description,
  primaryCta,
  secondaryCta,
  variant = "default",
}: CTASectionProps) {
  const isDark = variant === "dark";

  return (
    <section className={isDark ? "bg-slate-900 py-20" : "container mx-auto px-4 py-20"}>
      <div className={`relative max-w-3xl mx-auto text-center p-12 rounded-xl ${
        isDark
          ? ""
          : variant === "minimal"
            ? "bg-[hsl(var(--marketing-bg-subtle))]"
            : "bg-[hsl(var(--marketing-bg))] border border-[hsl(var(--marketing-border))]"
      }`}>
        <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${isDark ? "text-white" : "text-[hsl(var(--marketing-text))]"}`}>
          {title}
        </h2>
        <p className={`text-lg mb-8 max-w-xl mx-auto ${isDark ? "text-slate-300" : "text-[hsl(var(--marketing-text-light))]"}`}>
          {description}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link to={primaryCta.link}>
            <Button
              size="lg"
              className={`h-12 px-8 font-semibold rounded-lg ${
                isDark
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white"
              }`}
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
                className={`h-12 px-8 rounded-lg ${
                  isDark
                    ? "border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                    : "border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text))] hover:bg-[hsl(var(--marketing-bg-subtle))]"
                }`}
              >
                {secondaryCta.text}
              </Button>
            </Link>
          )}
        </div>

        <p className={`text-sm mt-6 ${isDark ? "text-slate-400" : "text-[hsl(var(--marketing-text-light))]"}`}>
          No credit card required. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
