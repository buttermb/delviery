import { motion } from 'framer-motion';
import X from "lucide-react/dist/esm/icons/x";
import Check from "lucide-react/dist/esm/icons/check";

const oldWay = [
  "Text a PDF menu to buyers. Hope they read it. Chase them for orders.",
  "45-minute onboarding calls and $500/mo minimums",
  "Menus that live forever — your pricing leaks to competitors",
  "Spreadsheets updated manually. Overselling is routine.",
];

const floraiqWay = [
  "Share an encrypted link. Buyers browse, order, pay. Done.",
  "Create your first menu in under 5 minutes. Free to start.",
  "Menus expire on your terms. Your pricing stays private.",
  "Inventory syncs in real-time. Menus update automatically.",
];

export function ComparisonSection() {
  return (
    <section className="py-20 bg-[hsl(var(--marketing-bg))]">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              The old way vs. the FloraIQ way
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {/* Old Way Column */}
            <motion.div
              className="rounded-2xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg-subtle))] p-6 md:p-8"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="text-lg font-bold text-[hsl(var(--marketing-text-light))] mb-6 uppercase tracking-wide">
                The Old Way
              </h3>
              <ul className="space-y-5">
                {oldWay.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <X className="w-3.5 h-3.5 text-red-500" />
                    </div>
                    <span className="text-[hsl(var(--marketing-text-light))] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* FloraIQ Way Column */}
            <motion.div
              className="rounded-2xl border-2 border-[hsl(var(--marketing-primary))] bg-[hsl(var(--marketing-primary))]/5 p-6 md:p-8"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-lg font-bold text-[hsl(var(--marketing-primary))] mb-6 uppercase tracking-wide">
                The FloraIQ Way
              </h3>
              <ul className="space-y-5">
                {floraiqWay.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <span className="text-[hsl(var(--marketing-text))] leading-relaxed font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
