import { motion } from "framer-motion";
import { Shield, CheckCircle, Lock } from "lucide-react";

const badges = [
  {
    icon: Shield,
    text: "AES-256 Encrypted",
    delay: 0,
  },
  {
    icon: CheckCircle,
    text: "GDPR Compliant",
    delay: 0.2,
  },
  {
    icon: Lock,
    text: "256-bit SSL",
    delay: 0.4,
  },
];

export function FloatingBadges() {
  return (
    <div className="flex flex-wrap justify-center gap-6">
      {badges.map((badge, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
            opacity: 1, 
            y: 0,
          }}
          transition={{ 
            duration: 0.6,
            delay: badge.delay,
          }}
          className="group relative"
        >
          <motion.div
            animate={{ 
              y: [0, -8, 0],
            }}
            transition={{
              duration: 3,
              delay: badge.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 hover:bg-white/20 transition-colors cursor-default"
          >
            <badge.icon className="h-5 w-5 text-white" />
            <span className="text-sm text-white font-medium">{badge.text}</span>
          </motion.div>

          {/* Subtle glow effect */}
          <motion.div
            className="absolute inset-0 rounded-lg pointer-events-none"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 0.3 }}
            transition={{ duration: 0.3 }}
            style={{
              background: "radial-gradient(circle at center, rgba(255,255,255,0.5) 0%, transparent 70%)",
              filter: "blur(8px)",
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}
