import { motion } from 'framer-motion';
import { useState } from 'react';

interface Integration {
  name: string;
  logo: string;
  category: string;
}

interface NetworkWebProps {
  integrations: Integration[];
  centerLabel?: string;
}

export function NetworkWeb({ integrations, centerLabel = 'DevPanel' }: NetworkWebProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Calculate positions in a circular pattern
  const radius = 180;
  const centerX = 250;
  const centerY = 250;

  return (
    <div className="relative w-full aspect-square max-w-[500px] mx-auto">
      <svg className="w-full h-full" viewBox="0 0 500 500">
        <defs>
          {/* Gradient for connection lines */}
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--marketing-primary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--marketing-accent))" stopOpacity="0.6" />
          </linearGradient>
          
          {/* Glow filter */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines */}
        {integrations.map((_, index) => {
          const angle = (index * (360 / integrations.length) - 90) * (Math.PI / 180);
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;

          return (
            <g key={`connection-${index}`}>
              <motion.line
                x1={centerX}
                y1={centerY}
                x2={x}
                y2={y}
                stroke="url(#lineGradient)"
                strokeWidth={hoveredIndex === index ? "3" : "2"}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ 
                  pathLength: 1, 
                  opacity: hoveredIndex === index ? 1 : 0.4 
                }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
              />
              
              {/* Animated data particle */}
              <motion.circle
                r="4"
                fill="hsl(var(--marketing-accent))"
                filter="url(#glow)"
                animate={{
                  cx: [centerX, x],
                  cy: [centerY, y],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: index * 0.5,
                  ease: "linear",
                }}
              />
            </g>
          );
        })}

        {/* Center hub */}
        <motion.circle
          cx={centerX}
          cy={centerY}
          r="50"
          fill="url(#centerGradient)"
          filter="url(#glow)"
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        <defs>
          <radialGradient id="centerGradient">
            <stop offset="0%" stopColor="hsl(var(--marketing-primary))" />
            <stop offset="100%" stopColor="hsl(var(--marketing-accent))" />
          </radialGradient>
        </defs>

        <text
          x={centerX}
          y={centerY}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-white font-bold text-sm"
        >
          {centerLabel}
        </text>

        {/* Integration nodes */}
        {integrations.map((integration, index) => {
          const angle = (index * (360 / integrations.length) - 90) * (Math.PI / 180);
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;

          return (
            <g
              key={integration.name}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: 'pointer' }}
            >
              <motion.circle
                cx={x}
                cy={y}
                r={hoveredIndex === index ? "35" : "30"}
                className="fill-[hsl(var(--marketing-bg))]"
                stroke="hsl(var(--marketing-border))"
                strokeWidth="2"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ 
                  delay: index * 0.1,
                  type: 'spring',
                  stiffness: 200,
                  damping: 15
                }}
                whileHover={{ scale: 1.2 }}
              />
              
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-2xl pointer-events-none"
              >
                {integration.logo}
              </text>
              
              {hoveredIndex === index && (
                <motion.text
                  x={x}
                  y={y + 50}
                  textAnchor="middle"
                  className="fill-foreground text-xs font-medium pointer-events-none"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {integration.name}
                </motion.text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
