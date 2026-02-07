import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calculator, TrendingUp, DollarSign, Clock, Target } from 'lucide-react';
import { CountUpNumber } from './CountUpNumber';

export function ROICalculator() {
  const [currentCosts, setCurrentCosts] = useState({
    manualHours: 20,
    hourlyRate: 25,
    monthlySoftware: 50,
    errors: 500,
  });

  const savings = useMemo(() => {
    const timeSavings = currentCosts.manualHours * 0.75 * currentCosts.hourlyRate * 4; // 75% time saved, monthly
    const errorReduction = currentCosts.errors * 0.8; // 80% fewer errors
    const softwareCost = 299; // Professional plan
    const monthlySavings = timeSavings + errorReduction - softwareCost - currentCosts.monthlySoftware;
    const annualSavings = monthlySavings * 12;
    const roi = ((annualSavings / (softwareCost * 12)) * 100).toFixed(0);

    return {
      monthlySavings: Math.max(0, monthlySavings),
      annualSavings: Math.max(0, annualSavings),
      roi: Math.max(0, parseFloat(roi)),
      timeSaved: currentCosts.manualHours * 0.75,
    };
  }, [currentCosts]);

  return (
    <div className="glass-card p-8 rounded-xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg-subtle))]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center">
          <Calculator className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-[hsl(var(--marketing-text))]">ROI Calculator</h3>
          <p className="text-sm text-[hsl(var(--marketing-text-light))]">See how much you can save</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-[hsl(var(--marketing-text))] mb-2">
            Manual Hours/Week
          </label>
          <input
            type="number"
            value={currentCosts.manualHours}
            onChange={(e) =>
              setCurrentCosts({ ...currentCosts, manualHours: parseInt(e.target.value) || 0 })
            }
            className="w-full px-4 py-2 border border-[hsl(var(--marketing-border))] rounded-lg bg-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-text))]"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[hsl(var(--marketing-text))] mb-2">
            Hourly Rate ($)
          </label>
          <input
            type="number"
            value={currentCosts.hourlyRate}
            onChange={(e) =>
              setCurrentCosts({ ...currentCosts, hourlyRate: parseInt(e.target.value) || 0 })
            }
            className="w-full px-4 py-2 border border-[hsl(var(--marketing-border))] rounded-lg bg-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-text))]"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[hsl(var(--marketing-text))] mb-2">
            Current Software Cost ($/mo)
          </label>
          <input
            type="number"
            value={currentCosts.monthlySoftware}
            onChange={(e) =>
              setCurrentCosts({ ...currentCosts, monthlySoftware: parseInt(e.target.value) || 0 })
            }
            className="w-full px-4 py-2 border border-[hsl(var(--marketing-border))] rounded-lg bg-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-text))]"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[hsl(var(--marketing-text))] mb-2">
            Error Costs ($/mo)
          </label>
          <input
            type="number"
            value={currentCosts.errors}
            onChange={(e) =>
              setCurrentCosts({ ...currentCosts, errors: parseInt(e.target.value) || 0 })
            }
            className="w-full px-4 py-2 border border-[hsl(var(--marketing-border))] rounded-lg bg-[hsl(var(--marketing-bg))] text-[hsl(var(--marketing-text))]"
            min="0"
          />
        </div>
      </div>

      {/* Enhanced Results with Animations */}
      <motion.div
        className="bg-gradient-to-br from-[hsl(var(--marketing-primary))]/10 to-[hsl(var(--marketing-accent))]/10 p-8 rounded-xl border-2 border-[hsl(var(--marketing-primary))]/30 relative overflow-hidden"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="roi-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="1" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#roi-grid)" />
          </svg>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              <TrendingUp className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
            </motion.div>
            <h4 className="font-bold text-lg text-[hsl(var(--marketing-text))]">Your Potential Savings</h4>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Monthly Savings */}
            <motion.div
              className="bg-[hsl(var(--marketing-bg))]/50 p-4 rounded-lg border border-[hsl(var(--marketing-border))]"
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
                <div className="text-xs font-medium text-[hsl(var(--marketing-text-light))]">Monthly Savings</div>
              </div>
              <div className="text-3xl font-bold text-[hsl(var(--marketing-text))]">
                $<CountUpNumber key={savings.monthlySavings} end={savings.monthlySavings} duration={1500} />
              </div>
              {/* Visual bar */}
              <motion.div
                className="h-1 bg-[hsl(var(--marketing-primary))]/30 rounded-full mt-3 overflow-hidden"
              >
                <motion.div
                  className="h-full bg-[hsl(var(--marketing-primary))]"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.5, delay: 0.3 }}
                />
              </motion.div>
            </motion.div>

            {/* Annual Savings */}
            <motion.div
              className="bg-[hsl(var(--marketing-bg))]/50 p-4 rounded-lg border border-[hsl(var(--marketing-border))]"
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
                <div className="text-xs font-medium text-[hsl(var(--marketing-text-light))]">Annual Savings</div>
              </div>
              <div className="text-3xl font-bold text-[hsl(var(--marketing-text))]">
                $<CountUpNumber key={savings.annualSavings} end={savings.annualSavings} duration={1500} />
              </div>
              <motion.div
                className="h-1 bg-[hsl(var(--marketing-primary))]/30 rounded-full mt-3 overflow-hidden"
              >
                <motion.div
                  className="h-full bg-[hsl(var(--marketing-primary))]"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.5, delay: 0.5 }}
                />
              </motion.div>
            </motion.div>

            {/* Time Saved */}
            <motion.div
              className="bg-[hsl(var(--marketing-bg))]/50 p-4 rounded-lg border border-[hsl(var(--marketing-border))]"
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-[hsl(var(--marketing-primary))]" />
                <div className="text-xs font-medium text-[hsl(var(--marketing-text-light))]">Time Saved/Week</div>
              </div>
              <div className="text-3xl font-bold text-[hsl(var(--marketing-text))]">
                <CountUpNumber key={savings.timeSaved} end={savings.timeSaved} decimals={1} duration={1500} />hrs
              </div>
              <motion.div
                className="h-1 bg-[hsl(var(--marketing-primary))]/30 rounded-full mt-3 overflow-hidden"
              >
                <motion.div
                  className="h-full bg-[hsl(var(--marketing-primary))]"
                  initial={{ width: 0 }}
                  animate={{ width: '75%' }}
                  transition={{ duration: 1.5, delay: 0.7 }}
                />
              </motion.div>
            </motion.div>

            {/* ROI */}
            <motion.div
              className="bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-secondary))] p-4 rounded-lg text-white relative overflow-hidden"
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <motion.div
                className="absolute inset-0 bg-white/10"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <div className="text-xs font-medium">Return on Investment</div>
                </div>
                <div className="text-4xl font-bold">
                  <CountUpNumber key={savings.roi} end={savings.roi} duration={1500} />%
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

