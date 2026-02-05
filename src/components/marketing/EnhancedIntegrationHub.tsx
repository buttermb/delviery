import { motion, useAnimation } from 'framer-motion';
import type LucideIcon from "lucide-react/dist/esm/icons/type lucide-icon";
import { useEffect, useMemo } from 'react';

interface Integration {
    name: string;
    logo: LucideIcon;
}

interface EnhancedIntegrationHubProps {
    integrations: Integration[];
}

export function EnhancedIntegrationHub({ integrations }: EnhancedIntegrationHubProps) {
    // Memoize positions for the circular layout
    const integrationPositions = useMemo(() => {
        return integrations.map((integration, index) => {
            const angle = (index * (360 / integrations.length) - 90) * (Math.PI / 180);
            const radius = 42; // Percentage from center
            const x = 50 + Math.cos(angle) * radius;
            const y = 50 + Math.sin(angle) * radius;
            return { integration, x, y, index, angle };
        });
    }, [integrations]);

    return (
        <div className="relative w-full max-w-[600px] mx-auto py-12 aspect-square flex items-center justify-center">
            {/* Center Hub */}
            <motion.div
                className="relative z-20"
                initial={{ scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, type: 'spring' }}
            >
                <div className="w-24 h-24 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg relative z-20">
                    <div className="absolute inset-0 rounded-full bg-indigo-600 opacity-20 animate-ping" />
                    <span className="text-white font-bold text-lg relative z-30">FloraIQ</span>
                </div>

                {/* Hub Rings */}
                <div className="absolute inset-0 -m-4 border border-indigo-200 dark:border-indigo-800 rounded-full animate-[spin_10s_linear_infinite]" />
                <div className="absolute inset-0 -m-8 border border-indigo-100 dark:border-indigo-900 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
            </motion.div>

            {/* Orbiting Integrations */}
            <div className="absolute inset-0 animate-[spin_60s_linear_infinite]">
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
                        {/* Counter-rotate the nodes so icons stay upright */}
                        <div className="animate-[spin_60s_linear_infinite_reverse]">
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
                                {/* Connection Line to Center (Visual only, complex to animate perfectly in CSS orbit, using particles instead) */}

                                {/* Integration Node */}
                                <div className="w-16 h-16 rounded-full bg-[hsl(var(--marketing-bg-subtle))] border-2 border-[hsl(var(--marketing-border))] flex items-center justify-center shadow-lg group-hover:border-[hsl(var(--marketing-primary))] group-hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all duration-300 z-20 relative backdrop-blur-sm">
                                    <integration.logo className="h-7 w-7 text-[hsl(var(--marketing-primary))]" />
                                </div>

                                {/* Label */}
                                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[hsl(var(--marketing-bg))] px-2 py-1 rounded text-xs border border-[hsl(var(--marketing-border))] shadow-sm z-30">
                                    <span className="font-medium text-[hsl(var(--marketing-text))]">{integration.name}</span>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Data Particles System (Separate from orbit to flow correctly) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <defs>
                    <radialGradient id="particle-gradient">
                        <stop offset="0%" stopColor="hsl(var(--marketing-primary))" stopOpacity="1" />
                        <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                    </radialGradient>
                </defs>
                {integrationPositions.map((pos, i) => (
                    <ParticleStream key={i} angle={pos.angle} delay={i * 1.2} />
                ))}
            </svg>
        </div>
    );
}

function ParticleStream({ angle, delay }: { angle: number; delay: number }) {
    // Calculate start (center) and end (orbit) points
    // Center is 50%, 50%
    // We need to animate a circle moving from center outwards

    return (
        <motion.circle
            r="2"
            fill="hsl(var(--marketing-primary))"
            initial={{ opacity: 0 }}
            animate={{
                opacity: [0, 1, 0],
                cx: ["50%", `${50 + Math.cos(angle) * 42}%`],
                cy: ["50%", `${50 + Math.sin(angle) * 42}%`],
            }}
            transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
                delay: delay,
                repeatDelay: 0.5
            }}
        />
    );
}
