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
    <section className="py-12 md:py-24 bg-[hsl(var(--marketing-bg))] relative overflow-x-hidden border-t border-[hsl(var(--marketing-border))]">
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-mono font-bold mb-6 text-[hsl(var(--marketing-text))] tracking-tight">
              Spreadsheet Hell <span className="text-[hsl(var(--marketing-text-light))]">vs.</span> Automated Ops
            </h2>
            <p className="text-lg font-mono text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto">
              We built FloraIQ because we got tired of debugging inventory drift in Excel.
            </p>
          </motion.div>

          {/* Mobile Tab Switcher */}
          {isMobile && (
            <div className="flex gap-2 mb-6 p-1 bg-[hsl(var(--marketing-bg-subtle))] rounded-lg border border-[hsl(var(--marketing-border))]">
              <button
                onClick={() => setActiveTab('before')}
                className={`flex-1 px-4 py-3 rounded-md font-mono text-xs font-bold transition-all ${activeTab === 'before'
                  ? 'bg-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-text))] shadow-sm border border-[hsl(var(--marketing-border))]'
                  : 'text-[hsl(var(--marketing-text-light))]'
                  }`}
              >
                Before.xlsx
              </button>
              <button
                onClick={() => setActiveTab('after')}
                className={`flex-1 px-4 py-3 rounded-md font-mono text-xs font-bold transition-all ${activeTab === 'after'
                  ? 'bg-[hsl(var(--marketing-primary))] text-white shadow-sm'
                  : 'text-[hsl(var(--marketing-text-light))]'
                  }`}
              >
                After (System)
              </button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* Problems - The "Old Way" */}
            <motion.div
              className={`p-8 rounded border-2 border-dashed border-red-200 bg-red-50/10 ${isMobile && activeTab !== 'before' ? 'hidden' : ''
                }`}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-8">
                <FileSpreadsheet className="h-5 w-5 text-red-400" />
                <h3 className="text-xl font-bold font-mono text-red-900/70">Legacy_Systems</h3>
              </div>
              <ul className="space-y-6 font-mono text-sm">
                <li className="flex items-start gap-3 opacity-70">
                  <span className="text-red-400 mt-0.5">x</span>
                  <span>inventory_v4_final_REAL.xlsx</span>
                </li>
                <li className="flex items-start gap-3 opacity-70">
                  <span className="text-red-400 mt-0.5">x</span>
                  <span>Manual CSV exports (3x daily)</span>
                </li>
                <li className="flex items-start gap-3 opacity-70">
                  <span className="text-red-400 mt-0.5">x</span>
                  <span>Sync conflicts: 14 items</span>
                </li>
                <li className="flex items-start gap-3 opacity-70">
                  <span className="text-red-400 mt-0.5">x</span>
                  <span>Email threads for approvals</span>
                </li>
              </ul>
            </motion.div>

            {/* Solutions - The "Dev Way" */}
            <motion.div
              className={`p-8 rounded bg-[#1e1e1e] text-emerald-400 border border-emerald-500/20 shadow-2xl relative overflow-hidden ${isMobile && activeTab !== 'after' ? 'hidden' : ''
                }`}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-8 border-b border-emerald-500/20 pb-4">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </div>
                <h3 className="text-sm font-mono text-emerald-500/50 ml-2">system_status.log</h3>
              </div>

              <ul className="space-y-4 font-mono text-sm">
                <li className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span><span className="text-emerald-700">{`>`}</span> Sync_Latancy: <span className="text-white">45ms</span></span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span><span className="text-emerald-700">{`>`}</span> Man hours saved: <span className="text-white">15.4/wk</span></span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span><span className="text-emerald-700">{`>`}</span> Uptime: <span className="text-white">99.99%</span></span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span><span className="text-emerald-700">{`>`}</span> Data_Source: <span className="text-white">Single Truth</span></span>
                </li>
              </ul>

              <div className="mt-8 pt-6 border-t border-emerald-500/20">
                <div className="text-xs text-emerald-600 mb-2">// Deploy infrastructure</div>
                <Link to="/signup">
                  <button className="w-full py-3 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/50 text-emerald-400 font-mono text-xs uppercase tracking-widest transition-all">
                    Initialize_Instance
                  </button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section >
  );
}

