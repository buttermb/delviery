import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';

interface Integration {
  name: string;
  logo: LucideIcon;
}

interface SimplifiedIntegrationHubProps {
  integrations: Integration[];
}

export function SimplifiedIntegrationHub({ integrations }: SimplifiedIntegrationHubProps) {
  // Memoize positions to avoid recalculation on every render
  const integrationPositions = useMemo(() => {
    return integrations.map((integration, index) => {
      const angle = (index * (360 / integrations.length) - 90) * (Math.PI / 180);
      const radius = 45; // percentage
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;
      return { integration, x, y, index };
    });
  }, [integrations]);

  return (
    <div className="relative w-full max-w-[600px] mx-auto py-12">
      {/* Center Hub */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
        initial={{ scale: 0, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, type: 'spring' }}
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] flex items-center justify-center shadow-lg relative">
          {/* CSS Pulse Effect for better performance */}
          <div className="absolute inset-0 rounded-full bg-[hsl(var(--marketing-primary))] opacity-20 animate-ping" />
          <span className="text-white font-bold text-lg relative z-10">FloraIQ</span>
        </div>
      </motion.div>

      {/* Integration Nodes in Circle */}
      <div className="relative w-full aspect-square">
        {integrationPositions.map(({ integration, x, y, index }) => (
          <div
            key={integration.name}
            className="absolute"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{
                delay: index * 0.1,
                duration: 0.5,
                type: 'spring',
                stiffness: 200
              }}
              className="relative group"
            >
              {/* Connection Line - SVG for better performance than div rotation */}
              <svg
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none overflow-visible"
                style={{
                  width: '200px',
                  height: '200px',
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -50%) rotate(${Math.atan2(50 - y, 50 - x) * (180 / Math.PI) + 180}deg)`,
                  transformOrigin: 'center center'
                }}
              >
                <motion.line
                  x1="0" y1="100" x2="100" y2="100"
                  stroke="url(#gradient-line)"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 + 0.3, duration: 0.6 }}
                />
                <defs>
                  <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(var(--marketing-primary))" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Integration Node */}
              <div className="w-16 h-16 rounded-full bg-[hsl(var(--marketing-bg-subtle))] border-2 border-[hsl(var(--marketing-border))] flex items-center justify-center shadow-lg group-hover:border-[hsl(var(--marketing-primary))]/50 transition-colors duration-300 z-20 relative">
                <integration.logo className="h-7 w-7 text-[hsl(var(--marketing-primary))]" />
              </div>

              {/* Label */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-xs font-medium text-[hsl(var(--marketing-text))]">{integration.name}</span>
              </div>
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}
