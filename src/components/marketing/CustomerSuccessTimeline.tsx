import { motion } from 'framer-motion';
import { CheckCircle } from '@phosphor-icons/react';

interface TimelineEvent {
  id: number;
  title: string;
  description: string;
  metric: string;
  month: string;
}

const events: TimelineEvent[] = [
  {
    id: 1,
    title: 'Onboarding Complete',
    description: 'Customer fully onboarded and trained',
    metric: '40% faster',
    month: 'Month 1',
  },
  {
    id: 2,
    title: 'First Major Order',
    description: 'Processed first large cannabis order',
    metric: '$50K+',
    month: 'Month 2',
  },
  {
    id: 3,
    title: 'Inventory Optimized',
    description: 'Reduced stockouts by implementing smart alerts',
    metric: '30% reduction',
    month: 'Month 3',
  },
  {
    id: 4,
    title: 'Full Automation',
    description: 'All workflows automated, team saves 15hrs/week',
    metric: '15hrs/week',
    month: 'Month 4',
  },
];

export function CustomerSuccessTimeline() {
  return (
    <div className="py-12 max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <h3 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
          Customer Success Journey
        </h3>
        <p className="text-muted-foreground text-lg">
          See how businesses grow with FloraIQ
        </p>
      </div>
      
      <div className="relative">
        {/* Timeline line - positioned to align with center of dots */}
        <div className="absolute left-8 md:left-10 top-0 bottom-0 w-1 bg-gradient-to-b from-[hsl(var(--marketing-primary))] via-[hsl(var(--marketing-accent))] to-[hsl(var(--marketing-secondary))] opacity-30" />

        <div className="space-y-12">
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              className="relative flex items-center gap-6 md:gap-8"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ 
                delay: index * 0.2,
                type: 'spring',
                stiffness: 100,
                damping: 20
              }}
            >
              {/* Timeline dot */}
              <motion.div 
                className="relative z-10 flex-shrink-0"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ 
                  delay: index * 0.2 + 0.1,
                  type: 'spring',
                  stiffness: 200,
                  damping: 15
                }}
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] flex items-center justify-center shadow-lg">
                  <CheckCircle weight="fill" className="h-8 w-8 md:h-10 md:w-10 text-white" />
                </div>
              </motion.div>

              {/* Content */}
              <motion.div 
                className="flex-1 glass-card p-6 md:p-8 rounded-xl hover:shadow-xl transition-shadow"
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-bold text-xl text-foreground">{event.title}</h4>
                      <span className="text-xs font-semibold text-[hsl(var(--marketing-accent))] bg-[hsl(var(--marketing-accent))]/10 px-3 py-1 rounded-full">
                        {event.month}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{event.description}</p>
                  </div>
                  <div className="flex-shrink-0 text-center md:text-right">
                    <div className="text-3xl md:text-4xl font-bold text-[hsl(var(--marketing-primary))]">
                      {event.metric}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Impact</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

