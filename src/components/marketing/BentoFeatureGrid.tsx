/**
 * BentoFeatureGrid - Optimized feature grid
 * Uses CSS transitions instead of Framer Motion for better scroll performance
 */

import { Layers, Workflow, TrendingUp, ShieldCheck, Smartphone, Lock, ArrowUpRight } from "lucide-react";
import { CountdownTimer } from "./CountdownTimer";

const features = [
  {
    title: "Secure Auto-Expiring Catalogs",
    description: "Share live menus that self-destruct. Control access down to the second.",
    icon: ShieldCheck,
    highlight: true,
    className: "md:col-span-2 md:row-span-2",
    visual: (
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--marketing-primary))/0.05] via-transparent to-[hsl(var(--marketing-accent))/0.05]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 z-30">
          <div className="bg-[hsl(var(--marketing-bg))]/60 backdrop-blur-md rounded-lg p-3 border border-[hsl(var(--marketing-border))] flex items-center gap-3 shadow-xl relative overflow-hidden">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] flex items-center justify-center text-white relative z-10">
              <Lock className="w-4 h-4" />
            </div>
            <div className="flex-1 relative z-10">
              <div className="h-2 w-20 bg-[hsl(var(--marketing-text-light))] opacity-30 rounded mb-1" />
              <div className="h-1.5 w-12 bg-[hsl(var(--marketing-text-light))] opacity-20 rounded" />
            </div>
          </div>
          <div className="mt-2">
            <CountdownTimer />
          </div>
        </div>
      </div>
    )
  },
  {
    title: "Real-Time Inventory",
    description: "Sync stock across multiple warehouses and drivers instantly.",
    icon: Layers,
    className: "md:col-span-1 md:row-span-1",
    visual: (
      <div className="absolute inset-0 p-4 flex flex-col gap-2 opacity-50">
        <div className="flex items-center gap-2 p-2 rounded bg-[hsl(var(--marketing-bg))] border border-[hsl(var(--marketing-border))]">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <div className="h-1.5 w-16 bg-[hsl(var(--marketing-text-light))] opacity-30 rounded" />
        </div>
        <div className="flex items-center gap-2 p-2 rounded bg-[hsl(var(--marketing-bg))] border border-[hsl(var(--marketing-border))]">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <div className="h-1.5 w-12 bg-[hsl(var(--marketing-text-light))] opacity-30 rounded" />
        </div>
        <div className="flex items-center gap-2 p-2 rounded bg-[hsl(var(--marketing-bg))] border border-[hsl(var(--marketing-border))]">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <div className="h-1.5 w-20 bg-[hsl(var(--marketing-text-light))] opacity-30 rounded" />
        </div>
      </div>
    )
  },
  {
    title: "Customer Portal",
    description: "White-label ordering for your clients. 24/7 self-service.",
    icon: Smartphone,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    title: "End-to-End Encryption",
    description: "Your data is yours. We can never see it.",
    icon: Lock,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    title: "Smart Logistics",
    description: "Cut delivery times with automated routing.",
    icon: Workflow,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    title: "Live Analytics",
    description: "Visualize profit margins and driver performance in real-time.",
    icon: TrendingUp,
    className: "md:col-span-1 md:row-span-1",
    visual: (
      <div className="absolute inset-0 flex items-end justify-around p-4 pb-0 opacity-50">
        <div className="w-4 h-12 bg-[hsl(var(--marketing-primary))] rounded-t opacity-40" />
        <div className="w-4 h-20 bg-[hsl(var(--marketing-primary))] rounded-t opacity-60" />
        <div className="w-4 h-16 bg-[hsl(var(--marketing-primary))] rounded-t opacity-50" />
        <div className="w-4 h-24 bg-[hsl(var(--marketing-primary))] rounded-t opacity-80" />
        <div className="w-4 h-10 bg-[hsl(var(--marketing-primary))] rounded-t opacity-30" />
      </div>
    )
  },
];

export function BentoFeatureGrid() {
  return (
    <section className="py-20 bg-gradient-to-b from-[hsl(var(--marketing-bg))] via-[hsl(var(--marketing-bg-subtle))] to-[hsl(var(--marketing-bg))] relative">
      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-[hsl(var(--marketing-primary))] via-[hsl(var(--marketing-accent))] to-[hsl(var(--marketing-primary))] bg-clip-text text-transparent">
              Everything You Need.
            </span>
            <br />
            <span className="text-[hsl(var(--marketing-text-light))]">Purpose-Built.</span>
          </h2>
          <p className="text-lg text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto">
            Built specifically for the unique security and operational needs of the cannabis industry.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(200px,auto)]">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`
                group relative overflow-hidden rounded-3xl p-8 
                bg-[hsl(var(--marketing-bg))]/60 border border-[hsl(var(--marketing-border))]
                hover:border-[hsl(var(--marketing-primary))/0.5] 
                hover:shadow-lg hover:-translate-y-1
                transition-all duration-200 cursor-pointer
                ${feature.className}
              `}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Background Glow on Hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-[hsl(var(--marketing-primary))/0.05] via-transparent to-[hsl(var(--marketing-accent))/0.03]" />

              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className={`
                    p-3 rounded-xl 
                    ${feature.highlight
                      ? 'bg-[hsl(var(--marketing-primary))] text-white'
                      : 'bg-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-primary))] border border-[hsl(var(--marketing-border))]'}
                  `}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  {feature.highlight && (
                    <div className="px-3 py-1 rounded-full bg-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-primary))] text-xs font-bold border border-[hsl(var(--marketing-primary))]">
                      Flagship Feature
                    </div>
                  )}
                </div>

                <h3 className="text-xl font-bold text-[hsl(var(--marketing-text))] mb-2">
                  {feature.title}
                </h3>
                <p className="text-[hsl(var(--marketing-text-light))] leading-relaxed mb-4 flex-grow">
                  {feature.description}
                </p>

                {feature.visual && (
                  <div className="mt-4 rounded-xl overflow-hidden border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg))] aspect-video relative">
                    {feature.visual}
                  </div>
                )}

                <div className="mt-auto pt-4 flex items-center text-sm text-[hsl(var(--marketing-primary))] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Learn more <ArrowUpRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
