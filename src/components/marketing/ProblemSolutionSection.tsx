import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';

interface Problem {
  icon: string;
  text: string;
}

interface Solution {
  icon: string;
  text: string;
}

const problems: Problem[] = [
  { icon: '📊', text: 'Multiple spreadsheets to manage' },
  { icon: '⏰', text: 'Hours wasted on manual data entry' },
  { icon: '❌', text: 'No real-time inventory tracking' },
  { icon: '📧', text: 'Order management via email chaos' },
  { icon: '🔒', text: 'Security concerns with shared files' },
  { icon: '📈', text: 'No insights into business performance' },
];

const solutions: Solution[] = [
  { icon: '✅', text: 'Single unified dashboard' },
  { icon: '⚡', text: 'Automation saves 15hrs/week' },
  { icon: '📱', text: 'Real-time updates across devices' },
  { icon: '🎯', text: 'Streamlined order processing' },
  { icon: '🛡️', text: 'Bank-level encryption & security' },
  { icon: '📊', text: 'Powerful analytics & insights' },
];

export function ProblemSolutionSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              From Chaos to Control
            </h2>
            <p className="text-xl text-muted-foreground">
              See how DevPanel transforms your wholesale operations
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Problems */}
            <motion.div
              className="glass-card p-8 rounded-xl border-2 border-red-200 dark:border-red-900/30"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <X className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Before DevPanel</h3>
              </div>
              <ul className="space-y-4">
                {problems.map((problem, index) => (
                  <motion.li
                    key={index}
                    className="flex items-center gap-3 text-muted-foreground"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <span className="text-2xl">{problem.icon}</span>
                    <span>{problem.text}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Solutions */}
            <motion.div
              className="glass-card p-8 rounded-xl border-2 border-emerald-200 dark:border-emerald-900/30"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                  <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">With DevPanel</h3>
              </div>
              <ul className="space-y-4">
                {solutions.map((solution, index) => (
                  <motion.li
                    key={index}
                    className="flex items-center gap-3 text-foreground font-medium"
                    initial={{ opacity: 0, x: 10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <span className="text-2xl">{solution.icon}</span>
                    <span>{solution.text}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* CTA */}
          <motion.div
            className="text-center mt-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-lg text-muted-foreground mb-6">
              Join 400+ distributors who've transformed their operations
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

