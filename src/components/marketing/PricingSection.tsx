import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function PricingSection() {
  return (
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900">
          Simple, Transparent Pricing
        </h2>
        <p className="text-lg text-slate-600">
          Start free, upgrade as you grow
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {/* FREE TIER - With Premium Glow Animation */}
        <div className="p-6 rounded-[24px] border-2 border-[hsl(var(--marketing-primary))] bg-white relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">

          <div className="absolute top-0 right-0 px-4 py-1.5 bg-[hsl(var(--marketing-primary))] text-white text-[10px] font-bold rounded-bl-xl shadow-sm tracking-wider uppercase">
            NO CC REQUIRED
          </div>

          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-2 text-center text-[hsl(var(--marketing-primary))] tracking-wide">FREE FOREVER</h3>
            <div className="text-center mb-4">
              <span className="text-5xl font-extrabold text-[hsl(var(--marketing-primary))]">$0</span>
              <span className="text-lg text-slate-500 font-medium">/mo</span>
            </div>
            <p className="text-sm text-center text-slate-500 mb-6 font-medium">Perfect for getting started</p>
            <div className="text-center mb-6 py-2 px-4 bg-[hsl(var(--marketing-bg-subtle))] rounded-full inline-flex items-center gap-2 mx-auto w-full justify-center border border-[hsl(var(--marketing-border))]">
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--marketing-primary))]" />
              <span className="text-xs font-bold text-[hsl(var(--marketing-primary))] uppercase tracking-wide">500 FREE credits/month</span>
            </div>
            <ul className="space-y-4 mb-8">
              {["All core features", "50 customers", "3 menus", "1 location", "No credit card ever"].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                  <div className="w-5 h-5 rounded-full bg-[hsl(var(--marketing-primary)/0.1)] flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-3 w-3 text-[hsl(var(--marketing-primary))]" />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
            <Link to="/signup?plan=free">
              <Button className="w-full bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary)/0.9)] text-white font-bold h-14 rounded-lg shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 uppercase tracking-wide">
                Start Free Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        {[
          {
            id: "starter",
            name: "STARTER",
            price: "$79",
            period: "/mo",
            description: "Unlimited for small teams",
            features: ["Unlimited usage", "Unlimited menus", "2 locations", "3 team members", "Email support"],
            cta: "Start 14-Day Trial"
          },
          {
            id: "professional",
            name: "PROFESSIONAL",
            price: "$150",
            period: "/mo",
            popular: true,
            description: "Most popular choice",
            features: ["55 Total Features", "500 customers", "5 locations", "Advanced CRM", "Priority support"],
            cta: "Start 14-Day Trial"
          },
          {
            id: "enterprise",
            name: "ENTERPRISE",
            price: "$499",
            period: "/mo",
            description: "For large-scale operations",
            features: ["All 87 Features", "Unlimited everything", "Fleet management", "API & webhooks", "White-label"],
            cta: "Contact Sales"
          },
        ].map((plan, index) => (
          <div
            key={index}
            className={`p-6 rounded-[24px] border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl relative overflow-hidden bg-white ${plan.popular
              ? "border-[hsl(var(--marketing-primary))] shadow-md md:scale-105"
              : "border-gray-100"
              }`}
          >
            {plan.popular && (
              <div className="absolute top-0 inset-x-0 h-1 bg-[hsl(var(--marketing-primary))]" />
            )}

            {plan.popular && (
              <div className="text-center mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[hsl(var(--marketing-bg-subtle))] text-[hsl(var(--marketing-primary))] text-[10px] font-bold tracking-wider uppercase border border-[hsl(var(--marketing-primary)/0.2)]">
                  MOST POPULAR
                </span>
              </div>
            )}
            <h3 className="text-lg font-bold mb-2 text-center text-[hsl(var(--marketing-text))] tracking-wide uppercase">{plan.name}</h3>
            <div className="text-center mb-4">
              <span className="text-5xl font-extrabold text-[hsl(var(--marketing-text))]">{plan.price}</span>
              <span className="text-lg text-slate-500 font-medium">{plan.period}</span>
            </div>
            <p className="text-sm text-center text-slate-500 mb-6 font-medium">{plan.description}</p>
            <ul className="space-y-4 mb-8">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${plan.popular ? 'bg-[hsl(var(--marketing-primary)/0.1)]' : 'bg-gray-100'}`}>
                    <CheckCircle className={`h-3 w-3 ${plan.popular ? 'text-[hsl(var(--marketing-primary))]' : 'text-slate-400'}`} />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
            <Link to={plan.id === "enterprise" ? "/contact?reason=enterprise" : `/signup?plan=${plan.id}`}>
              <Button
                variant={plan.popular ? "default" : "outline"}
                size="lg"
                className={`w-full rounded-lg h-14 font-bold uppercase tracking-wide text-sm transition-all duration-200 ${plan.popular
                  ? "bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary)/0.9)] text-white shadow-md hover:shadow-lg"
                  : "border-gray-200 text-slate-700 hover:bg-gray-50 hover:border-[hsl(var(--marketing-border))] hover:text-[hsl(var(--marketing-primary))]"
                  }`}
              >
                {plan.cta}
              </Button>
            </Link>
            {plan.name !== "ENTERPRISE" && (
              <div className="text-[10px] text-center mt-3 text-slate-400 font-medium flex justify-center gap-1">
                <AlertTriangle className="w-3 h-3 inline-block" aria-hidden="true" /> Credit card required for trial
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-center mt-12">
        <div className="mt-12 p-8 bg-[hsl(var(--marketing-bg-subtle))] border border-[hsl(var(--marketing-border))] rounded-[32px] max-w-lg mx-auto text-left">
          <h4 className="font-bold text-[hsl(var(--marketing-text))] mb-4 flex items-center gap-2 text-lg">
            <HelpCircle className="w-5 h-5" />
            When is a credit card required?
          </h4>
          <div className="space-y-4 text-sm font-medium">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-[hsl(var(--marketing-primary))] mt-0.5 shrink-0" />
              <span className="text-slate-600">
                <strong className="block text-[hsl(var(--marketing-text))]">FREE tier</strong>
                No credit card ever. Just sign up and start.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-slate-600">
                <strong className="block text-[hsl(var(--marketing-text))]">Paid plan trials</strong>
                Credit card required at signup to verify identity. <br />You won't be charged during the 14-day trial.
              </span>
            </div>
          </div>
        </div>
        <Link to="/pricing">
          <Button variant="ghost" className="mt-8 group text-slate-600 hover:text-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary)/0.05)] transition-colors uppercase tracking-wide font-bold">
            See Full Pricing Details
            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>

    </div>
  );
}
