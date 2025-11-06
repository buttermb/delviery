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
    description: 'Processed first large wholesale order',
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
    <div className="py-12">
      <h3 className="text-2xl font-bold mb-8 text-center text-foreground">
        Customer Success Journey
      </h3>
      <div className="relative max-w-4xl mx-auto">
        {/* Timeline line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[hsl(var(--marketing-primary))] via-[hsl(var(--marketing-accent))] to-[hsl(var(--marketing-secondary))]" />

        <div className="space-y-8">
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              className="relative flex items-start gap-6"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
            >
              {/* Timeline dot */}
              <div className="relative z-10 flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] flex items-center justify-center">
                  <CheckCircle weight="fill" className="h-8 w-8 text-white" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 glass-card p-6 rounded-xl">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-lg text-foreground">{event.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[hsl(var(--marketing-primary))]">
                      {event.metric}
                    </div>
                    <div className="text-xs text-muted-foreground">{event.month}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

