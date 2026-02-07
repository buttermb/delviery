/**
 * PlatformCapabilities - Flowhub style
 * Alternating side-by-side layout with clean visuals
 */

import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";

export function PlatformCapabilities() {
  const capabilities = [
    {
      title: "Automated Compliance",
      description: "State reporting happens automatically in the background. We sync with Metrc every 5 minutes so your manifests are always audit-ready.",
      features: ["Real-time Metrc sync", "Automated manifest generation", "Discrepancy alerts"],
      imageAlign: "right"
    },
    {
      title: "Smart Logistics",
      description: "Maximize driver efficiency with algorithmic route planning. Reduce fuel costs and increase stops per hour with our intelligent dispatch engine.",
      features: ["Multi-stop optimization", "Driver mobile app", "Proof of delivery (e-signature)"],
      imageAlign: "left"
    },
    {
      title: "B2B E-Commerce",
      description: "Give your retailers a modern ordering experience. Your live menu is always up to date with warehouse inventory, preventing overselling.",
      features: ["Live inventory feed", "Custom price tiers", "One-click reordering"],
      imageAlign: "right"
    }
  ];

  return (
    <section className="py-24 bg-[hsl(var(--marketing-bg))] overflow-x-hidden">
      <div className="container mx-auto px-4">

        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-text))] mb-6">
            Built for scale, <br /> designed for compliance
          </h2>
        </div>

        <div className="space-y-32">
          {capabilities.map((cap, index) => (
            <div
              key={index}
              className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-24 ${cap.imageAlign === "left" ? "lg:flex-row-reverse" : ""
                }`}
            >
              {/* Text Side */}
              <div className="flex-1 text-left">
                <h3 className="text-3xl md:text-4xl font-bold text-[hsl(var(--marketing-text))] mb-6">
                  {cap.title}
                </h3>
                <p className="text-xl text-[hsl(var(--marketing-text-light))] mb-8 leading-relaxed">
                  {cap.description}
                </p>

                <ul className="space-y-4 mb-8">
                  {cap.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[hsl(var(--marketing-accent))]/20 flex items-center justify-center text-[hsl(var(--marketing-text))]">
                        <Check className="w-4 h-4" />
                      </div>
                      <span className="text-lg font-medium text-[hsl(var(--marketing-text))]">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button variant="link" className="p-0 h-auto text-[hsl(var(--marketing-primary))] font-bold text-lg hover:no-underline hover:text-[hsl(var(--marketing-accent))] transition-colors">
                  Learn more about {cap.title} <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>

              {/* Visual Side */}
              <div className="flex-1 w-full relative group perspective-[1000px]">
                {/* Decorative blob behind */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[hsl(var(--marketing-primary))]/5 rounded-full blur-3xl -z-10 group-hover:bg-[hsl(var(--marketing-primary))]/10 transition-colors duration-500`} />

                <div className="relative bg-white rounded-lg border border-[hsl(var(--marketing-border))] shadow-2xl overflow-hidden aspect-[4/3] transform transition-transform duration-500 hover:scale-[1.02] hover:rotate-y-2">
                  {/* Browser Chrome */}
                  <div className="h-8 border-b border-gray-100 flex items-center px-4 gap-2 bg-gray-50">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400/50" />
                    </div>
                  </div>

                  {/* Placeholder Content */}
                  <div className="absolute inset-0 top-8 flex items-center justify-center bg-[hsl(var(--marketing-bg-subtle))]">
                    {/* Purple Tint Overlay */}
                    <div className="absolute inset-0 bg-[hsl(var(--marketing-primary))]/5 mix-blend-multiply pointer-events-none z-10" />

                    <div className="text-center p-8 z-20">
                      <div className="text-[hsl(var(--marketing-text-light))] font-mono text-sm uppercase tracking-widest mb-2">Screenshot</div>
                      <div className="text-[hsl(var(--marketing-text))] font-bold text-xl">{cap.title} Interface</div>
                    </div>

                    {/* Grid overlay for tech feel */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
