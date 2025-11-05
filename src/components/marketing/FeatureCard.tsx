import { Link } from "react-router-dom";
import { LucideIcon, ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  link?: string;
}

const featureDetails: Record<string, string[]> = {
  "DISPOSABLE MENUS": ["One-time access links", "Auto-expiration", "View tracking", "Screenshot protection"],
  "ENCRYPTED & SECURE": ["256-bit encryption", "SOC 2 compliant", "Regular audits", "Data backup"],
  "INVENTORY TRACKING": ["Barcode scanning", "Multi-location", "Low stock alerts", "Auto reorder"],
  "AUTOMATION": ["Smart workflows", "Email alerts", "Report scheduling", "Order processing"],
  "CUSTOMER PORTAL": ["24/7 self-service", "Order history", "Custom branding", "Mobile app"],
  "ANALYTICS": ["Real-time data", "Custom reports", "Sales trends", "Customer insights"],
};

export function FeatureCard({ icon: Icon, title, description, link }: FeatureCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const details = featureDetails[title] || [];

  return (
    <div 
      className="relative h-[280px] cursor-pointer"
      style={{ perspective: "1000px" }}
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
    >
      <motion.div
        className="relative w-full h-full"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front Side */}
        <div 
          className="absolute inset-0 p-6 rounded-xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg))] backface-hidden"
          style={{ backfaceVisibility: "hidden" }}
        >
          <motion.div 
            className="w-12 h-12 rounded-xl bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center mb-4"
            whileHover={{ scale: 1.1, rotate: 5 }}
          >
            <Icon className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
          </motion.div>
          <h3 className="text-xl font-bold mb-2 text-[hsl(var(--marketing-text))]">{title}</h3>
          <p className="text-[hsl(var(--marketing-text-light))] mb-4">{description}</p>
        </div>

        {/* Back Side */}
        <div 
          className="absolute inset-0 p-6 rounded-xl border-2 border-[hsl(var(--marketing-primary))]/50 bg-gradient-to-br from-[hsl(var(--marketing-primary))]/10 to-[hsl(var(--marketing-accent))]/10 backdrop-blur-sm backface-hidden"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--marketing-primary))]/20 flex items-center justify-center">
              <Icon className="h-5 w-5 text-[hsl(var(--marketing-primary))]" />
            </div>
            <h3 className="text-lg font-bold text-[hsl(var(--marketing-text))]">{title}</h3>
          </div>
          <ul className="space-y-3 mb-4">
            {details.map((detail, i) => (
              <motion.li 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={isFlipped ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                transition={{ delay: i * 0.1 + 0.3 }}
                className="flex items-center gap-2 text-sm text-[hsl(var(--marketing-text))]"
              >
                <Check className="h-4 w-4 text-[hsl(var(--marketing-primary))] flex-shrink-0" />
                {detail}
              </motion.li>
            ))}
          </ul>
          {link && (
            <Link to={link} className="inline-flex items-center text-[hsl(var(--marketing-primary))] font-medium text-sm">
              Learn More <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
}

