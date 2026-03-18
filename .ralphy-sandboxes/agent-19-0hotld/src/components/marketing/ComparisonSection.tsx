import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

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

  // ... (renderValue function and useMemo remain same, implied by not changing them if I could, but here I must provide the function body I suppose or just the return? I'll provide full return)
  // Actually I need to provide the full function or chunk. 
  // I will replace the return statement.

  const renderValue = (value: boolean | string) => {
    if (value === true) {
      return <Check className="h-5 w-5 text-emerald-500" aria-label="Supported" />;
    }
    if (value === false) {
      return <X className="h-5 w-5 text-red-500" aria-label="Not supported" />;
    }
    return <span className="text-sm text-slate-500 font-medium">{value}</span>;
  };

  const visibleFeatures = useMemo(() => showAll ? features : features.slice(0, 4), [showAll]);

  return (
    <div className="container mx-auto px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900">
            FloraIQ vs. The Competition
          </h2>
          <p className="text-lg text-slate-600">
            See why 400+ distributors switched to FloraIQ
          </p>
        </motion.div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
            <table className="w-full">
              <caption className="sr-only">Feature comparison between FloraIQ, Competitor A, and Spreadsheets</caption>
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th scope="col" className="text-left p-6 font-semibold text-slate-900">Feature</th>
                  <th scope="col" className="text-center p-6 font-semibold text-emerald-800 bg-emerald-50">
                    <span className="text-emerald-700 font-bold">FloraIQ</span>
                  </th>
                  <th scope="col" className="text-center p-6 font-semibold text-slate-500">
                    Competitor A
                  </th>
                  <th scope="col" className="text-center p-6 font-semibold text-slate-500">
                    Spreadsheets
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleFeatures.map((feature, index) => (
                  <motion.tr
                    key={feature.name}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-0"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <td className="p-5 font-medium text-slate-900">{feature.name}</td>
                    <td className="p-5 text-center bg-emerald-50/30">
                      <div className="flex justify-center">
                        {renderValue(feature.floraiq)}
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex justify-center">
                        {renderValue(feature.competitor)}
                      </div>
                    </td>
                    <td className="p-5 text-center">
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
              className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <h4 className="font-bold mb-4 text-slate-900">{feature.name}</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded bg-emerald-50 border border-emerald-100">
                  <span className="text-sm text-emerald-800 font-bold">FloraIQ</span>
                  {renderValue(feature.floraiq)}
                </div>
                <div className="flex items-center justify-between p-2">
                  <span className="text-sm text-slate-500">Competitor</span>
                  {renderValue(feature.competitor)}
                </div>
                <div className="flex items-center justify-between p-2">
                  <span className="text-sm text-slate-500">Spreadsheets</span>
                  {renderValue(feature.spreadsheet)}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {!showAll && features.length > 4 && (
          <div className="text-center mt-10">
            <button
              onClick={() => setShowAll(true)}
              className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline transition-colors"
            >
              Show all {features.length} features
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

