import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';

interface Feature {
  name: string;
  floraiq: boolean | string;
  competitor: boolean | string;
  spreadsheet: boolean | string;
}

const features: Feature[] = [
  {
    name: 'Real-Time Tracking',
    floraiq: true,
    competitor: 'Manual refresh',
    spreadsheet: false,
  },
  {
    name: 'Disposable Menus',
    floraiq: true,
    competitor: 'Static links',
    spreadsheet: false,
  },
  {
    name: 'Automation',
    floraiq: 'Built-in workflow',
    competitor: 'Requires Zapier',
    spreadsheet: false,
  },
  {
    name: 'Security',
    floraiq: 'SOC2 + SSL + MFA',
    competitor: 'SSL only',
    spreadsheet: false,
  },
  {
    name: 'Multi-Location Inventory',
    floraiq: true,
    competitor: true,
    spreadsheet: false,
  },
  {
    name: 'Customer Portal',
    floraiq: true,
    competitor: false,
    spreadsheet: false,
  },
  {
    name: 'Analytics Dashboard',
    floraiq: true,
    competitor: 'Basic',
    spreadsheet: false,
  },
  {
    name: 'Mobile Access',
    floraiq: true,
    competitor: true,
    spreadsheet: false,
  },
];

export function ComparisonSection() {
  const [showAll, setShowAll] = useState(false);

  const renderValue = (value: boolean | string) => {
    if (value === true) {
      return <Check className="h-5 w-5 text-emerald-500" />;
    }
    if (value === false) {
      return <X className="h-5 w-5 text-red-500" />;
    }
    return <span className="text-sm text-muted-foreground">{value}</span>;
  };

  const visibleFeatures = showAll ? features : features.slice(0, 4);

  return (
    <section className="py-20 bg-[hsl(var(--marketing-bg))]">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              FloraIQ vs. The Competition
            </h2>
            <p className="text-xl text-[hsl(var(--marketing-text-light))]">
              See why 400+ distributors switched to FloraIQ
            </p>
          </motion.div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <div className="glass-card rounded-xl border border-[hsl(var(--marketing-border))] overflow-hidden bg-[hsl(var(--marketing-bg-subtle))]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg))]">
                    <th className="text-left p-4 font-semibold text-[hsl(var(--marketing-text))]">Feature</th>
                    <th className="text-center p-4 font-semibold text-[hsl(var(--marketing-text))]">
                      <span className="text-[hsl(var(--marketing-primary))]">FloraIQ</span>
                    </th>
                    <th className="text-center p-4 font-semibold text-[hsl(var(--marketing-text-light))]">
                      Competitor A
                    </th>
                    <th className="text-center p-4 font-semibold text-[hsl(var(--marketing-text-light))]">
                      Spreadsheets
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFeatures.map((feature, index) => (
                    <motion.tr
                      key={feature.name}
                      className="border-b border-[hsl(var(--marketing-border))]/50 hover:bg-[hsl(var(--marketing-bg))]/50 transition-colors"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <td className="p-4 font-medium text-[hsl(var(--marketing-text))]">{feature.name}</td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center">
                          {renderValue(feature.floraiq)}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center">
                          {renderValue(feature.competitor)}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center">
                          {renderValue(feature.spreadsheet)}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {visibleFeatures.map((feature, index) => (
              <motion.div
                key={feature.name}
                className="glass-card p-4 rounded-xl bg-[hsl(var(--marketing-bg-subtle))] border border-[hsl(var(--marketing-border))]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <h4 className="font-semibold mb-3 text-[hsl(var(--marketing-text))]">{feature.name}</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--marketing-primary))] font-medium">FloraIQ</span>
                    {renderValue(feature.floraiq)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--marketing-text-light))]">Competitor</span>
                    {renderValue(feature.competitor)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--marketing-text-light))]">Spreadsheets</span>
                    {renderValue(feature.spreadsheet)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {!showAll && features.length > 4 && (
            <div className="text-center mt-8">
              <button
                onClick={() => setShowAll(true)}
                className="text-[hsl(var(--marketing-primary))] hover:underline font-medium"
              >
                Show all {features.length} features
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

