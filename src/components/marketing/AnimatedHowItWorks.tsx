import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ArrowRight } from '@phosphor-icons/react';
import { AnimatedIcon } from './AnimatedIcon';

interface Step {
  id: number;
  title: string;
  description: string;
  time: string;
  icon: string;
  details: string[];
}

const steps: Step[] = [
  {
    id: 1,
    title: 'Sign Up',
    description: 'Create your free account in 60 seconds',
    time: '1 min',
    icon: '✏️',
    details: [
      'No credit card required',
      'Instant access',
      '14-day free trial',
    ],
  },
  {
    id: 2,
    title: 'Import Data',
    description: 'Import your products & customers (or add them manually)',
    time: '5 min',
    icon: '📥',
    details: [
      'CSV/Excel import support',
      'Manual entry option',
      'Bulk product upload',
    ],
  },
  {
    id: 3,
    title: 'Go Live',
    description: 'Start taking orders and managing your business',
    time: '10 min',
    icon: '🚀',
    details: [
      'Create your first menu',
      'Invite customers',
      'Start receiving orders',
    ],
  },
];

export function AnimatedHowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              How DevPanel Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Get started in minutes, not months
            </p>
          </motion.div>

          {/* Animated Progress Bar */}
          <div className="relative mb-12">
            <div className="absolute top-1/2 left-0 right-0 h-2 bg-muted rounded-full transform -translate-y-1/2" />
            <motion.div 
              className="absolute top-1/2 left-0 h-2 rounded-full transform -translate-y-1/2 overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-[hsl(var(--marketing-primary))] via-[hsl(var(--marketing-accent))] to-[hsl(var(--marketing-primary))]"
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                style={{
                  backgroundSize: '200% 100%',
                }}
              />
            </motion.div>
            
            {/* Progress dots */}
            <div className="relative flex justify-between">
              {steps.map((_, index) => (
                <motion.div
                  key={index}
                  className={`w-4 h-4 rounded-full border-2 ${
                    index <= activeStep
                      ? 'bg-[hsl(var(--marketing-primary))] border-[hsl(var(--marketing-primary))]'
                      : 'bg-background border-muted'
                  }`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.1, type: 'spring', stiffness: 200 }}
                  whileHover={{ scale: 1.3 }}
                />
              ))}
            </div>
          </div>

          {/* Steps */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                className="text-center cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                onClick={() => setActiveStep(index)}
              >
                <motion.div
                  className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl transition-all ${
                    activeStep === index
                      ? 'bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] scale-110 shadow-lg'
                      : 'bg-muted'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {step.icon}
                </motion.div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-foreground">{step.title}</h3>
                  {activeStep === index && (
                    <AnimatedIcon animation="glow" size={20} color="hsl(var(--marketing-primary))">
                      <CheckCircle weight="fill" className="h-5 w-5 text-[hsl(var(--marketing-primary))]" />
                    </AnimatedIcon>
                  )}
                </div>
                <p className="text-muted-foreground mb-2">{step.description}</p>
                <span className="inline-block px-3 py-1 rounded-full bg-muted text-sm font-medium text-foreground">
                  {step.time}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Active Step Details */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              className="glass-card p-8 rounded-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {steps[activeStep].title}
                  </h3>
                  <p className="text-muted-foreground">{steps[activeStep].description}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Estimated Time</div>
                  <div className="text-2xl font-bold text-[hsl(var(--marketing-primary))]">
                    {steps[activeStep].time}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {steps[activeStep].details.map((detail, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center gap-3"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <AnimatedIcon animation="glow" hover size={20} color="hsl(var(--marketing-primary))">
                      <CheckCircle weight="fill" className="h-5 w-5 text-[hsl(var(--marketing-primary))]" />
                    </AnimatedIcon>
                    <span className="text-foreground">{detail}</span>
                  </motion.div>
                ))}
              </div>

              {activeStep < steps.length - 1 && (
                <div className="mt-6 pt-6 border-t border-border">
                  <button
                    onClick={() => setActiveStep(activeStep + 1)}
                    className="flex items-center gap-2 text-[hsl(var(--marketing-primary))] hover:gap-3 transition-all font-medium"
                  >
                    Next Step
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

