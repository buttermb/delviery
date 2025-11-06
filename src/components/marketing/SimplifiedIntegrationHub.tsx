import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';

interface Integration {
  name: string;
  logo: LucideIcon;
}

interface SimplifiedIntegrationHubProps {
  integrations: Integration[];
}

export function SimplifiedIntegrationHub({ integrations }: SimplifiedIntegrationHubProps) {
  return (
    <div className="relative w-full max-w-[600px] mx-auto py-12">
      {/* Center Hub */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, type: 'spring' }}
      >
        <motion.div
          className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg"
          animate={{ 
            boxShadow: [
              '0 0 20px rgba(var(--marketing-primary-rgb, 99, 102, 241), 0.3)',
              '0 0 40px rgba(var(--marketing-primary-rgb, 99, 102, 241), 0.5)',
              '0 0 20px rgba(var(--marketing-primary-rgb, 99, 102, 241), 0.3)',
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-white font-bold text-lg">DevPanel</span>
        </motion.div>
      </motion.div>

      {/* Integration Nodes in Circle */}
      <div className="relative w-full aspect-square">
        {integrations.map((integration, index) => {
          const angle = (index * (360 / integrations.length) - 90) * (Math.PI / 180);
          const radius = 45; // percentage
          const x = 50 + Math.cos(angle) * radius;
          const y = 50 + Math.sin(angle) * radius;

          return (
            <motion.div
              key={integration.name}
              className="absolute"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                delay: index * 0.1,
                duration: 0.5,
                type: 'spring',
                stiffness: 200
              }}
            >
              <motion.div
                className="relative"
                whileHover={{ scale: 1.2, zIndex: 20 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                {/* Connection Line */}
                <motion.div
                  className="absolute left-1/2 top-1/2 origin-left h-0.5 bg-gradient-to-r from-primary/30 to-transparent"
                  style={{
                    width: `${Math.sqrt(Math.pow((50 - x), 2) + Math.pow((50 - y), 2))}%`,
                    transform: `rotate(${Math.atan2(50 - y, 50 - x) * (180 / Math.PI)}deg)`,
                  }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: index * 0.1 + 0.3, duration: 0.6 }}
                />

                {/* Data Particle Animation */}
                <motion.div
                  className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full bg-accent"
                  style={{
                    x: '-50%',
                    y: '-50%',
                  }}
                  animate={{
                    scale: [0, 1, 0],
                    x: [
                      '-50%',
                      `${(50 - x) * 8}px`,
                    ],
                    y: [
                      '-50%',
                      `${(50 - y) * 8}px`,
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: index * 0.3,
                    ease: 'linear',
                  }}
                />

                {/* Integration Node */}
                <div className="w-16 h-16 rounded-full bg-card border-2 border-border flex items-center justify-center shadow-lg hover:border-primary/50 transition-colors">
                  <integration.logo className="h-7 w-7 text-primary" />
                </div>
                
                {/* Label */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-xs font-medium text-foreground">{integration.name}</span>
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
