import { motion, useInView } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { useRef } from "react";

const steps = [
  {
    number: 1,
    emoji: "✏️",
    title: "Sign Up",
    description: "Create your free account in 60 seconds"
  },
  {
    number: 2,
    emoji: "📥",
    title: "Import Data",
    description: "Import your products & customers (or add them manually)"
  },
  {
    number: 3,
    emoji: "🚀",
    title: "Go Live",
    description: "Start taking orders and managing your business"
  }
];

export function AnimatedHowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div ref={ref} className="relative">
      {/* Connecting Lines - Desktop Only */}
      <div className="hidden md:block absolute top-12 left-0 right-0 h-1 pointer-events-none">
        <svg className="w-full h-full" style={{ position: 'absolute', top: 0, left: 0 }}>
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--marketing-primary))" stopOpacity="0.3" />
              <stop offset="50%" stopColor="hsl(var(--marketing-primary))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="hsl(var(--marketing-primary))" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <motion.line
            x1="16.666%"
            y1="50%"
            x2="83.333%"
            y2="50%"
            stroke="url(#lineGradient)"
            strokeWidth="2"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            initial={{ strokeDashoffset: 1000 }}
            animate={isInView ? { strokeDashoffset: 0 } : {}}
            transition={{ duration: 1.5, ease: "easeInOut", delay: 0.3 }}
          />
        </svg>
      </div>

      {/* Steps Grid */}
      <div className="grid md:grid-cols-3 gap-8 relative z-10">
        {steps.map((step, index) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 50 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ 
              duration: 0.6, 
              delay: index * 0.2,
              ease: "easeOut"
            }}
            className="text-center group"
          >
            {/* Animated Step Circle */}
            <motion.div
              className="relative w-24 h-24 mx-auto mb-6"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {/* Pulse Ring */}
              <motion.div
                className="absolute inset-0 rounded-full bg-[hsl(var(--marketing-primary))]/20"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: index * 0.3,
                }}
              />
              
              {/* Main Circle */}
              <motion.div
                className="relative w-full h-full rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))]/20 to-[hsl(var(--marketing-primary))]/5 flex items-center justify-center border-2 border-[hsl(var(--marketing-primary))]/30 backdrop-blur-sm"
                initial={{ scale: 0 }}
                animate={isInView ? { scale: 1 } : {}}
                transition={{ 
                  duration: 0.5, 
                  delay: index * 0.2 + 0.3,
                  type: "spring",
                  stiffness: 200
                }}
              >
                <span className="text-4xl">{step.emoji}</span>
              </motion.div>

              {/* Number Badge */}
              <motion.div
                className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[hsl(var(--marketing-primary))] text-white flex items-center justify-center font-bold text-sm shadow-lg"
                initial={{ scale: 0, rotate: -180 }}
                animate={isInView ? { scale: 1, rotate: 0 } : {}}
                transition={{ 
                  duration: 0.5, 
                  delay: index * 0.2 + 0.5,
                  type: "spring"
                }}
              >
                {step.number}
              </motion.div>

              {/* Checkmark on Hover */}
              <motion.div
                className="absolute -bottom-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                initial={{ scale: 0 }}
                animate={isInView ? { scale: 1 } : {}}
                transition={{ delay: index * 0.2 + 0.7 }}
              >
                <CheckCircle className="w-6 h-6 text-[hsl(var(--marketing-primary))] fill-[hsl(var(--marketing-primary))]/20" />
              </motion.div>
            </motion.div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: index * 0.2 + 0.4 }}
            >
              <h3 className="text-xl font-bold mb-2 text-foreground">
                STEP {step.number}
                <br />
                {step.title}
              </h3>
              <p className="text-muted-foreground">
                {step.description}
              </p>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
