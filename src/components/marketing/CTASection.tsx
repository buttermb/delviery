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
    <div className="container mx-auto px-4">
      <div className={`relative max-w-5xl mx-auto text-center p-12 md:p-20 rounded-[40px] md:rounded-[60px] ${variant === "minimal"
        ? "bg-[hsl(var(--marketing-bg-subtle))] border border-[hsl(var(--marketing-border))]"
        : "bg-[hsl(var(--marketing-primary))] text-white shadow-2xl overflow-hidden relative"
        }`}>

        {/* Abstract Background for Default Variant - Subtler Flowhub Style */}
        {variant === "default" && (
          <div className="absolute inset-0 z-0">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-black/10 blur-[120px] rounded-full pointer-events-none" />
          </div>
        )}

        <div className="relative z-10">
          <h2 className={`text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-8 ${variant === 'minimal' ? 'text-[hsl(var(--marketing-text))]' : 'text-white'}`}>
            {title}
          </h2>
          <p className={`text-lg md:text-xl font-medium mb-12 max-w-2xl mx-auto ${variant === 'minimal' ? 'text-slate-600' : 'text-white/80'}`}>
            {description}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to={primaryCta.link} className="w-full sm:w-auto">
              <Button
                size="lg"
                className={`w-full sm:w-auto h-16 px-10 text-base uppercase tracking-wide font-bold rounded-lg shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-200 ${variant === 'minimal'
                  ? 'bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary)/0.9)] text-white'
                  : 'bg-white text-[hsl(var(--marketing-primary))] hover:bg-gray-50'
                  }`}
              >
                {primaryCta.text.replace(' →', '')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>

            {secondaryCta && (
              <Link to={secondaryCta.link} className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className={`w-full sm:w-auto h-16 px-10 text-base uppercase tracking-wide font-bold rounded-lg border-2 transition-all duration-200 ${variant === 'minimal'
                    ? 'border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text))] hover:bg-white hover:border-[hsl(var(--marketing-primary)/0.3)] hover:text-[hsl(var(--marketing-primary))]'
                    : 'border-white/20 text-white hover:bg-white/10 hover:border-white/40'
                    }`}
                >
                  {secondaryCta.text}
                </Button>
              </Link>
            )}
          </div>

          <p className={`text-sm mt-8 font-medium opacity-80 ${variant === 'minimal' ? 'text-slate-500' : 'text-white/60'}`}>
            No credit card required. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
