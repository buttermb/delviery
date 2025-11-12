import { motion } from 'framer-motion';
import { 
  ShieldCheck as ShieldCheckIcon,
  LockKey as LockKeyIcon,
  CheckCircle as CheckCircleIcon,
  Eye as EyeIcon,
  Shield as ShieldIcon,
} from '@phosphor-icons/react';
import { AnimatedIcon } from './AnimatedIcon';

interface TrustBadge {
  icon: React.ElementType;
  label: string;
  description: string;
}

const badges: TrustBadge[] = [
  {
    icon: ShieldCheckIcon,
    label: 'SOC 2 Type II',
    description: 'Certified',
  },
  {
    icon: LockKeyIcon,
    label: 'Encrypted Infrastructure',
    description: 'End-to-end',
  },
  {
    icon: CheckCircleIcon,
    label: 'Two-Factor Auth',
    description: 'Required',
  },
  {
    icon: EyeIcon,
    label: 'Data Privacy',
    description: 'GDPR compliant',
  },
  {
    icon: ShieldIcon,
    label: 'Threat Monitoring',
    description: 'AI-powered',
  },
];

export function TrustBadgesCluster() {
  return (
    <div className="flex flex-wrap justify-center gap-6">
      {badges.map((badge, index) => {
        const Icon = badge.icon;
        return (
          <motion.div
            key={badge.label}
            className="flex items-center gap-3 px-4 py-3 bg-card/50 backdrop-blur-sm border border-border rounded-lg group hover:bg-card/80 transition-colors"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.05, y: -2 }}
          >
            <AnimatedIcon animation="glow" hover size={24} color="hsl(var(--marketing-primary))">
              <Icon weight="fill" className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
            </AnimatedIcon>
            <div>
              <div className="font-semibold text-card-foreground text-sm">{badge.label}</div>
              <div className="text-xs text-muted-foreground">{badge.description}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

