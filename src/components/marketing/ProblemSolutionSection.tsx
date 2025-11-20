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
    <section className="py-12 md:py-20 bg-[hsl(var(--marketing-bg))] relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[hsl(var(--marketing-primary))] opacity-5 blur-[100px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12 md:mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              Stop Managing Spreadsheets, Start Scaling Distribution
            </h2>
            <p className="text-xl text-[hsl(var(--marketing-text-light))]">
              See how FloraIQ transforms your cannabis distribution operations
            </p>
          </motion.div>

          {/* Mobile Tab Switcher */}
          {isMobile && (
            <div className="flex gap-2 mb-6 p-1 bg-[hsl(var(--marketing-bg-subtle))] rounded-lg border border-[hsl(var(--marketing-border))]">
              <button
                onClick={() => setActiveTab('before')}
                className={`flex-1 px-4 py-3 rounded-md font-semibold transition-all ${activeTab === 'before'
                    ? 'bg-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-text))] shadow-sm border border-[hsl(var(--marketing-border))]'
                    : 'text-[hsl(var(--marketing-text-light))]'
                  }`}
              >
                Before FloraIQ
              </button>
              <button
                onClick={() => setActiveTab('after')}
                className={`flex-1 px-4 py-3 rounded-md font-semibold transition-all ${activeTab === 'after'
                    ? 'bg-[hsl(var(--marketing-primary))] text-white shadow-sm'
                    : 'text-[hsl(var(--marketing-text-light))]'
                  }`}
              >
                With FloraIQ
              </button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
            {/* Problems */}
            <motion.div
              className={`glass-card p-8 rounded-xl border border-red-500/20 bg-red-500/5 ${isMobile && activeTab !== 'before' ? 'hidden' : ''
                }`}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                  <X className="h-6 w-6 text-red-400" />
                </div>
                <h3 className="text-2xl font-bold text-[hsl(var(--marketing-text))]">Before FloraIQ</h3>
              </div>
              <ul className="space-y-4">
                {problems.map((problem, index) => {
                  const Icon = problem.icon;
                  return (
                    <motion.li
                      key={index}
                      className="flex items-center gap-3 text-[hsl(var(--marketing-text-light))]"
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-red-400" />
                      </div>
                      <span>{problem.text}</span>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>

            {/* Solutions */}
            <motion.div
              className={`glass-card p-8 rounded-xl border border-[hsl(var(--marketing-primary))/0.3] bg-[hsl(var(--marketing-primary))/0.05] ${isMobile && activeTab !== 'after' ? 'hidden' : ''
                }`}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-[hsl(var(--marketing-primary))/0.1] flex items-center justify-center border border-[hsl(var(--marketing-primary))/0.2]">
                  <Check className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
                </div>
                <h3 className="text-2xl font-bold text-[hsl(var(--marketing-text))]">With FloraIQ</h3>
              </div>
              <ul className="space-y-4">
                {solutions.map((solution, index) => {
                  const Icon = solution.icon;
                  return (
                    <motion.li
                      key={index}
                      className="flex items-center gap-3 text-[hsl(var(--marketing-text))] font-medium"
                      initial={{ opacity: 0, x: 10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[hsl(var(--marketing-primary))/0.1] flex items-center justify-center">
                        <Icon className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
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
            <p className="text-lg font-semibold text-[hsl(var(--marketing-text))] mb-4">
              Join 400+ cannabis distributors who've transformed their operations
            </p>
            <Link to="/signup">
              <Button size="lg" className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-secondary))] text-white h-12 px-8 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all duration-300">
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

