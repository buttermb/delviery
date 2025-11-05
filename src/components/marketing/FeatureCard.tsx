import { Link } from "react-router-dom";
import { LucideIcon, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  link?: string;
}

export function FeatureCard({ icon: Icon, title, description, link }: FeatureCardProps) {
  const content = (
    <motion.div 
      className="p-6 rounded-xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg))] hover:border-[hsl(var(--marketing-primary))]/50 transition-all group relative"
      whileHover={{ 
        y: -8,
        boxShadow: "0 12px 24px -10px rgba(0, 0, 0, 0.15)"
      }}
      transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
    >
      {/* Glow effect on hover */}
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 0.15 }}
        transition={{ duration: 0.3 }}
        style={{
          background: "radial-gradient(circle at center, hsl(var(--marketing-primary)) 0%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      <motion.div 
        className="w-12 h-12 rounded-xl bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center mb-4 group-hover:bg-[hsl(var(--marketing-primary))]/20 transition-colors relative z-10"
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={{ type: "spring", stiffness: 400 }}
      >
        <Icon className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
      </motion.div>
      
      <h3 className="text-xl font-bold mb-2 text-[hsl(var(--marketing-text))] relative z-10">{title}</h3>
      <p className="text-[hsl(var(--marketing-text-light))] mb-4 relative z-10">{description}</p>
      
      {link && (
        <Link to={link} className="inline-flex items-center text-[hsl(var(--marketing-primary))] font-medium group-hover:gap-2 transition-all relative z-10">
          Learn More <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      )}
    </motion.div>
  );

  return content;
}

