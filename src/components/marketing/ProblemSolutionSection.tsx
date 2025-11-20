import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { 
  X, 
  Check,
  FileSpreadsheet,
  Clock,
  AlertCircle,
  Mail,
  ShieldAlert,
  TrendingDown,
  LayoutDashboard,
  Sparkles,
  RefreshCw,
  Target,
  ShieldCheck,
  BarChart3,
  type LucideIcon
} from 'lucide-react';

interface Problem {
  icon: LucideIcon;
  text: string;
}

interface Solution {
  icon: LucideIcon;
  text: string;
}

const problems: Problem[] = [
  { icon: FileSpreadsheet, text: 'Multiple spreadsheets to manage' },
  { icon: Clock, text: 'Hours wasted on manual data entry' },
  { icon: AlertCircle, text: 'No real-time inventory tracking' },
  { icon: Mail, text: 'Order management via email chaos' },
  { icon: ShieldAlert, text: 'Security concerns with shared files' },
  { icon: TrendingDown, text: 'No insights into business performance' },
];

const solutions: Solution[] = [
  { icon: LayoutDashboard, text: 'Single unified dashboard' },
  { icon: Sparkles, text: 'Automation saves 15hrs/week' },
  { icon: RefreshCw, text: 'Real-time updates across devices' },
  { icon: Target, text: 'Streamlined order processing' },
  { icon: ShieldCheck, text: 'Full regulatory compliance & data security' },
  { icon: BarChart3, text: 'Powerful analytics & insights' },
];

export function ProblemSolutionSection() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'before' | 'after'>('before');

  return (
    <section className="py-12 md:py-20 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12 md:mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Stop Managing Spreadsheets, Start Scaling Distribution
            </h2>
            <p className="text-xl text-muted-foreground">
              See how FloraIQ transforms your cannabis distribution operations
            </p>
          </motion.div>

          {/* Mobile Tab Switcher */}
          {isMobile && (
            <div className="flex gap-2 mb-6 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setActiveTab('before')}
                className={`flex-1 px-4 py-3 rounded-md font-semibold transition-all ${
                  activeTab === 'before'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                Before FloraIQ
              </button>
              <button
                onClick={() => setActiveTab('after')}
                className={`flex-1 px-4 py-3 rounded-md font-semibold transition-all ${
                  activeTab === 'after'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                With FloraIQ
              </button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
            {/* Problems */}
            <motion.div
              className={`glass-card p-8 rounded-xl border-2 border-red-200 dark:border-red-900/30 ${
                isMobile && activeTab !== 'before' ? 'hidden' : ''
              }`}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <X className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Before FloraIQ</h3>
              </div>
              <ul className="space-y-4">
                {problems.map((problem, index) => {
                  const Icon = problem.icon;
                  return (
                    <motion.li
                      key={index}
                      className="flex items-center gap-3 text-muted-foreground"
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      <span>{problem.text}</span>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>

            {/* Solutions */}
            <motion.div
              className={`glass-card p-8 rounded-xl border-2 border-emerald-200 dark:border-emerald-900/30 ${
                isMobile && activeTab !== 'after' ? 'hidden' : ''
              }`}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                  <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">With FloraIQ</h3>
              </div>
              <ul className="space-y-4">
                {solutions.map((solution, index) => {
                  const Icon = solution.icon;
                  return (
                    <motion.li
                      key={index}
                      className="flex items-center gap-3 text-foreground font-medium"
                      initial={{ opacity: 0, x: 10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span>{solution.text}</span>
                    </motion.li>
                  );
                })}
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
            <p className="text-lg font-semibold text-foreground mb-4">
              Join 400+ cannabis distributors who've transformed their operations
            </p>
            <Link to="/signup">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Start Automating Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

