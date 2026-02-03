import { motion } from 'framer-motion';
import type { LucideIcon } from "lucide-react";

interface Integration {
  name: string;
  logo: LucideIcon;
}

interface StreamlinedIntegrationHubProps {
  integrations: Integration[];
}

export function StreamlinedIntegrationHub({ integrations }: StreamlinedIntegrationHubProps) {
  return (
    <div className="relative w-full py-8 overflow-hidden">
      {/* Horizontal scrolling container */}
      <div className="flex gap-4 justify-center items-center flex-wrap max-w-4xl mx-auto">
        {integrations.map((integration, index) => (
          <motion.div
            key={integration.name}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{
              delay: index * 0.1,
              duration: 0.4,
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
            className="relative group"
          >
            {/* Connection line to center */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full h-8 w-px bg-gradient-to-b from-[hsl(var(--marketing-primary))]/30 to-transparent" />
            
            {/* Integration card */}
            <div className="w-20 h-20 rounded-xl bg-[hsl(var(--marketing-bg-subtle))]/80 border border-[hsl(var(--marketing-border))] flex items-center justify-center group-hover:border-[hsl(var(--marketing-primary))]/50 transition-all duration-300 group-hover:scale-110">
              <integration.logo className="h-8 w-8 text-[hsl(var(--marketing-primary))]" />
            </div>
            
            {/* Label */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="text-xs font-medium text-[hsl(var(--marketing-text-light))] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {integration.name}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Center hub */}
      <motion.div
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
        className="w-16 h-16 rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] flex items-center justify-center mx-auto mt-12 shadow-lg"
      >
        <span className="text-white font-bold text-xs">Hub</span>
      </motion.div>
    </div>
  );
}
