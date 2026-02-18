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
      <div className={`relative max-w-4xl mx-auto text-center p-12 md:p-16 rounded-2xl ${variant === "minimal"
        ? "bg-gray-50 border border-gray-100"
        : "bg-emerald-900 text-white shadow-2xl overflow-hidden relative"
        }`}>

        {/* Abstract Background for Default Variant */}
        {variant === "default" && (
          <div className="absolute inset-0 z-0">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/20 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-800/20 blur-[100px] rounded-full pointer-events-none" />
          </div>
        )}

        <div className="relative z-10">
          <h2 className={`text-3xl md:text-5xl font-bold mb-6 ${variant === 'minimal' ? 'text-slate-900' : 'text-white'}`}>
            {title}
          </h2>
          <p className={`text-lg md:text-xl mb-10 max-w-2xl mx-auto ${variant === 'minimal' ? 'text-slate-600' : 'text-emerald-100'}`}>
            {description}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to={primaryCta.link} className="w-full sm:w-auto">
              <Button
                size="lg"
                className={`w-full sm:w-auto h-14 px-8 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 ${variant === 'minimal'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-white text-emerald-900 hover:bg-emerald-50'
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
                  className={`w-full sm:w-auto h-14 px-8 text-lg font-bold rounded-xl border-2 transition-all duration-200 ${variant === 'minimal'
                      ? 'border-gray-200 text-slate-700 hover:bg-gray-50 hover:border-emerald-200 hover:text-emerald-700'
                      : 'border-emerald-700 text-emerald-100 hover:bg-emerald-800 hover:text-white hover:border-emerald-600'
                    }`}
                >
                  {secondaryCta.text}
                </Button>
              </Link>
            )}
          </div>

          <p className={`text-sm mt-8 font-medium opacity-80 ${variant === 'minimal' ? 'text-slate-500' : 'text-emerald-200'}`}>
            No credit card required. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
