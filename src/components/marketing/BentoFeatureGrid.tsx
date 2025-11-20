import { motion } from "framer-motion";
import { FileKey2, Layers, Workflow, TrendingUp, ShieldCheck, Smartphone, Lock, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  {
    title: "Disposable Menus",
    description: "Create encrypted product catalogs that burn after viewing. The ultimate security for high-value wholesale.",
    icon: FileKey2,
    className: "md:col-span-2 md:row-span-2",
    image: true, // Placeholder for a visual
    highlight: true,
  },
  {
    title: "Real-Time Inventory",
    description: "Sync stock across multiple warehouses and drivers instantly.",
    icon: Layers,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    title: "Customer Portal",
    description: "White-label ordering for your clients. 24/7 self-service.",
    icon: Smartphone,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    title: "End-to-End Encryption",
    description: "Your data is yours. Zero-knowledge architecture.",
    icon: Lock,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    title: "Smart Logistics",
    description: "Automated routing and courier management.",
    icon: Workflow,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    title: "Live Analytics",
    description: "Revenue, margins, and driver performance in real-time.",
    icon: TrendingUp,
    className: "md:col-span-1 md:row-span-1",
  },
];

export function BentoFeatureGrid() {
  return (
    <section className="py-24 bg-[hsl(var(--marketing-bg))] relative">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-[hsl(var(--marketing-text))] mb-6">
            Everything You Need. <br />
            <span className="text-[hsl(var(--marketing-text-light))]">Nothing You Don't.</span>
          </h2>
          <p className="text-lg text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto">
            Built specifically for the unique security and operational needs of the cannabis industry.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(200px,auto)]">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className={`
                group relative overflow-hidden rounded-3xl p-8 
                bg-[hsl(var(--marketing-bg-subtle))] border border-[hsl(var(--marketing-border))]
                hover:border-[hsl(var(--marketing-primary))/0.5] transition-colors duration-300
                ${feature.className}
              `}
            >
              {/* Background Glow on Hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br from-[hsl(var(--marketing-primary))] via-transparent to-transparent" />

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

                {feature.image && (
                  <div className="mt-4 rounded-xl overflow-hidden border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg))] aspect-video relative group-hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-shadow">
                    {/* Simulated Disposable Menu UI */}
                    <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4">
                      <div className="bg-[hsl(var(--marketing-bg-subtle))] rounded-lg p-3 border border-[hsl(var(--marketing-border))] flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-[hsl(var(--marketing-primary))] flex items-center justify-center text-white">
                          <Lock className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="h-2 w-20 bg-[hsl(var(--marketing-text-light))] opacity-30 rounded mb-1" />
                          <div className="h-1.5 w-12 bg-[hsl(var(--marketing-text-light))] opacity-20 rounded" />
                        </div>
                      </div>
                      <div className="mt-2 flex justify-center">
                         <div className="text-[10px] text-[hsl(var(--marketing-primary))] font-mono animate-pulse">
                           Link expires in 00:59:59
                         </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-auto pt-4 flex items-center text-sm text-[hsl(var(--marketing-primary))] font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                  Learn more <ArrowUpRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

