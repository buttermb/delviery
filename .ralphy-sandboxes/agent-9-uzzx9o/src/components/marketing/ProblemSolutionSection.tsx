import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
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
  { icon: Target, text: 'Automated order processing' },
  { icon: ShieldCheck, text: 'Full regulatory compliance & data security' },
  { icon: BarChart3, text: 'Powerful analytics & insights' },
];

export function ProblemSolutionSection() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'before' | 'after'>('before');

  return (
    <div className="container mx-auto px-4 relative z-10">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900">
            Stop Managing Spreadsheets, Start Scaling Distribution
          </h2>
          <p className="text-lg text-slate-600">
            See how FloraIQ transforms your cannabis distribution operations
          </p>
        </motion.div>

        {/* Mobile Tab Switcher */}
        {isMobile && (
          <div className="flex gap-2 mb-8 p-1 bg-white rounded-xl border border-gray-200">
            <button
              onClick={() => setActiveTab('before')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold text-sm transition-all ${activeTab === 'before'
                ? 'bg-gray-100 text-slate-900 shadow-sm border border-gray-200'
                : 'text-slate-500'
                }`}
            >
              Before FloraIQ
            </button>
            <button
              onClick={() => setActiveTab('after')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold text-sm transition-all ${activeTab === 'after'
                ? 'bg-[hsl(var(--marketing-primary))] text-white shadow-sm'
                : 'text-slate-500'
                }`}
            >
              With FloraIQ
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Problems */}
          <motion.div
            className={`p-8 rounded-xl border border-gray-200 bg-white shadow-sm ${isMobile && activeTab !== 'before' ? 'hidden' : ''}`}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
                <FileSpreadsheet className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Before FloraIQ</h3>
            </div>
            <ul className="space-y-5">
              {problems.map((problem, index) => {
                const Icon = problem.icon;
                return (
                  <motion.li
                    key={index}
                    className="flex items-center gap-3 text-slate-600"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-slate-400" />
                    </div>
                    <span className="text-base font-medium">{problem.text}</span>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>

          {/* Solutions */}
          <motion.div
            className={`p-8 rounded-xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg-subtle))] relative overflow-hidden ${isMobile && activeTab !== 'after' ? 'hidden' : ''}`}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            {/* Glow Effect - Removed to match Flowhub clean design */}
            <div className="flex items-center gap-4 mb-8 relative z-10">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center border border-[hsl(var(--marketing-border))] shadow-sm">
                <Sparkles className="h-5 w-5 text-[hsl(var(--marketing-primary))]" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">With FloraIQ</h3>
            </div>
            <ul className="space-y-5">
              {solutions.map((solution, index) => {
                return (
                  <motion.li
                    key={index}
                    className="flex items-center gap-3 text-slate-800 font-medium relative z-10"
                    initial={{ opacity: 0, x: 10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm border border-gray-100">
                      <Check className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
                    </div>
                    <span className="text-base">{solution.text}</span>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-lg font-medium text-slate-500 mb-6">
            Join 400+ cannabis distributors who've transformed their operations
          </p>
          <Link to="/signup">
            <Button size="lg" className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary)/0.9)] text-white h-14 px-10 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 text-base uppercase font-bold tracking-wide">
              Start Automating Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

