import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, TrendingUp } from 'lucide-react';

export function ROICalculator() {
  const [currentCosts, setCurrentCosts] = useState({
    manualHours: 20,
    hourlyRate: 25,
    monthlySoftware: 50,
    errors: 500,
  });

  const calculateSavings = () => {
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
  };

  const savings = calculateSavings();

  return (
    <div className="glass-card p-8 rounded-xl border border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center">
          <Calculator className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">ROI Calculator</h3>
          <p className="text-sm text-muted-foreground">See how much you can save</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Manual Hours/Week
          </label>
          <input
            type="number"
            value={currentCosts.manualHours}
            onChange={(e) =>
              setCurrentCosts({ ...currentCosts, manualHours: parseInt(e.target.value) || 0 })
            }
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Hourly Rate ($)
          </label>
          <input
            type="number"
            value={currentCosts.hourlyRate}
            onChange={(e) =>
              setCurrentCosts({ ...currentCosts, hourlyRate: parseInt(e.target.value) || 0 })
            }
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Current Software Cost ($/mo)
          </label>
          <input
            type="number"
            value={currentCosts.monthlySoftware}
            onChange={(e) =>
              setCurrentCosts({ ...currentCosts, monthlySoftware: parseInt(e.target.value) || 0 })
            }
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Error Costs ($/mo)
          </label>
          <input
            type="number"
            value={currentCosts.errors}
            onChange={(e) =>
              setCurrentCosts({ ...currentCosts, errors: parseInt(e.target.value) || 0 })
            }
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            min="0"
          />
        </div>
      </div>

      {/* Results */}
      <motion.div
        className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-6 rounded-xl border border-emerald-200 dark:border-emerald-800"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h4 className="font-bold text-emerald-900 dark:text-emerald-100">Your Potential Savings</h4>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-emerald-700 dark:text-emerald-300">Monthly Savings</div>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
              ${savings.monthlySavings.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-emerald-700 dark:text-emerald-300">Annual Savings</div>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
              ${savings.annualSavings.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-emerald-700 dark:text-emerald-300">Time Saved/Week</div>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
              {savings.timeSaved.toFixed(1)}hrs
            </div>
          </div>
          <div>
            <div className="text-sm text-emerald-700 dark:text-emerald-300">ROI</div>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
              {savings.roi}%
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

