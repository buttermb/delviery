import { motion } from 'framer-motion';
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Clock from "lucide-react/dist/esm/icons/clock";
import Zap from "lucide-react/dist/esm/icons/zap";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";

const steps = [
  { label: 'Order Received', icon: Clock, status: 'complete' },
  { label: 'Auto-Confirm', icon: CheckCircle, status: 'complete' },
  { label: 'Notify Customer', icon: Zap, status: 'active' },
  { label: 'Prepare Shipment', icon: Clock, status: 'pending' },
];

export function WorkflowDiagram() {
  return (
    <div className="w-full h-full bg-[hsl(var(--marketing-bg-subtle))] rounded-lg p-6 border border-[hsl(var(--marketing-border))]">
      <div className="flex items-center gap-2 mb-6">
        <Zap className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-[hsl(var(--marketing-text))]">Automated Workflow</h4>
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={index}
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 20,
                delay: index * 0.1,
              }}
            >
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${step.status === 'complete' ? 'bg-green-500' :
                    step.status === 'active' ? 'bg-[hsl(var(--marketing-primary))]' : 'bg-[hsl(var(--marketing-bg))]'
                  }`}
                animate={step.status === 'active' ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Icon className="h-5 w-5 text-white" />
              </motion.div>

              <div className="flex-grow">
                <div className="font-medium text-[hsl(var(--marketing-text))]">{step.label}</div>
                <div className="text-xs text-[hsl(var(--marketing-text-light))]">
                  {step.status === 'complete' ? 'Completed' :
                    step.status === 'active' ? 'In Progress...' : 'Pending'}
                </div>
              </div>

              {index < steps.length - 1 && (
                <svg className="w-16 h-4" viewBox="0 0 64 16">
                  <motion.path
                    d="M0 8 L64 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    className="text-[hsl(var(--marketing-text-light))]/30"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: step.status === 'complete' ? 1 : 0 }}
                    transition={{ duration: 0.5, delay: index * 0.2 + 0.3 }}
                  />
                </svg>
              )}
            </motion.div>
          );
        })}
      </div>

      <motion.div
        className="mt-6 p-4 bg-[hsl(var(--marketing-accent))]/10 rounded-lg border border-[hsl(var(--marketing-accent))]/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <div>
            <div className="text-sm text-[hsl(var(--marketing-text))] font-medium">75% Faster Processing</div>
            <div className="text-xs text-[hsl(var(--marketing-text-light))]">Automated workflows save 15hrs/week</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
