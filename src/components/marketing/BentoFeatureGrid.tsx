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
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 z-30">
          <div className="bg-zinc-900/80 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center gap-4 shadow-2xl relative overflow-hidden group-hover:border-emerald-500/20 transition-colors duration-300">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white relative z-10 shadow-lg shadow-emerald-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <div className="flex-1 relative z-10 space-y-2">
              <div className="h-2 w-24 bg-white/20 rounded-full" />
              <div className="h-1.5 w-16 bg-white/10 rounded-full" />
            </div>
          </div>
          <div className="mt-4 transform scale-90 opacity-80">
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
      <div className="absolute inset-0 p-6 flex flex-col gap-3 opacity-60">
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <div className="h-1.5 w-16 bg-white/20 rounded-full" />
        </div>
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5 ml-4">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <div className="h-1.5 w-12 bg-white/20 rounded-full" />
        </div>
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <div className="h-1.5 w-20 bg-white/20 rounded-full" />
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
      <div className="absolute inset-0 flex items-end justify-around p-6 pb-0 opacity-40 gap-1">
        <div className="w-full bg-emerald-500/20 rounded-t-sm h-[40%]" />
        <div className="w-full bg-emerald-500/40 rounded-t-sm h-[65%]" />
        <div className="w-full bg-emerald-500/30 rounded-t-sm h-[50%]" />
        <div className="w-full bg-emerald-500/60 rounded-t-sm h-[80%]" />
        <div className="w-full bg-emerald-500/20 rounded-t-sm h-[35%]" />
      </div>
    )
  },
];


export function BentoFeatureGrid() {
  return (
    <section className="py-24 bg-[#0a0a0a] relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-emerald-900/10 to-transparent" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-3xl opacity-20" />
      </div>

      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        <div className="text-center mb-20 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Mission Critical
          </div>

          <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight text-white leading-[1.1]">
            Everything You Need.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Purpose-Built.
            </span>
          </h2>
          <p className="text-lg md:text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto font-light">
            Built from the ground up for the unique compliance, security, and operational needs of the modern cannabis industry.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 auto-rows-[minmax(240px,auto)]">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`
                group relative overflow-hidden rounded-3xl p-6 md:p-8 
                bg-zinc-900/40 border border-white/5 backdrop-blur-sm
                hover:border-emerald-500/30 hover:bg-zinc-900/60
                transition-all duration-300 cursor-pointer
                ${feature.className}
              `}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Premium Hover Gradient */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5 pointer-events-none" />

              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-start justify-between mb-6">
                  <div className={`
                    p-3.5 rounded-2xl transition-transform duration-300 group-hover:scale-110
                    ${feature.highlight
                      ? 'bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-white/5 text-emerald-400 border border-white/5 group-hover:bg-white/10 group-hover:text-emerald-300'}
                  `}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  {feature.highlight && (
                    <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 uppercase tracking-wider backdrop-blur-sm">
                      Flagship
                    </div>
                  )}
                </div>

                <div className="relative">
                  <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed mb-6 font-light group-hover:text-zinc-300 transition-colors duration-300">
                    {feature.description}
                  </p>
                </div>

                {feature.visual && (
                  <div className="mt-auto pt-4 rounded-xl overflow-hidden border border-white/5 bg-black/20 aspect-video relative group-hover:border-white/10 transition-colors duration-300">
                    {feature.visual}
                  </div>
                )}

                {/* Visual arrow appearing on hover */}
                {!feature.visual && (
                  <div className="mt-auto flex items-center text-sm font-medium text-emerald-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    Learn more <ArrowUpRight className="w-4 h-4 ml-2" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
