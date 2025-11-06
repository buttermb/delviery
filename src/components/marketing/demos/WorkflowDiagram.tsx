import { motion } from 'framer-motion';
import { CheckCircle, Clock, Zap } from 'lucide-react';

const steps = [
  { label: 'Order Received', icon: Clock, status: 'complete' },
  { label: 'Auto-Confirm', icon: CheckCircle, status: 'complete' },
  { label: 'Notify Customer', icon: Zap, status: 'active' },
  { label: 'Prepare Shipment', icon: Clock, status: 'pending' },
];

export function WorkflowDiagram() {
  return (
    <div className="w-full h-full bg-card/50 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Zap className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-foreground">Automated Workflow</h4>
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
              transition={{ delay: index * 0.2 }}
            >
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step.status === 'complete' ? 'bg-green-500' :
                  step.status === 'active' ? 'bg-primary' : 'bg-muted'
                }`}
                animate={step.status === 'active' ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Icon className="h-5 w-5 text-white" />
              </motion.div>
              
              <div className="flex-grow">
                <div className="font-medium text-foreground">{step.label}</div>
                <div className="text-xs text-muted-foreground">
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
                    className="text-muted-foreground/30"
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
        className="mt-6 p-4 bg-accent/10 rounded-lg border border-accent/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <div className="text-sm text-foreground font-medium">⚡ 75% Faster Processing</div>
        <div className="text-xs text-muted-foreground mt-1">Automated workflows save 15hrs/week</div>
      </motion.div>
    </div>
  );
}
