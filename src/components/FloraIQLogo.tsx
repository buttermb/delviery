import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FloraIQLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  disableAnimation?: boolean;
}

const sizeMap = {
  sm: { container: 'text-lg', flora: 'text-lg', iq: 'text-xl' },
  md: { container: 'text-xl', flora: 'text-xl', iq: 'text-2xl' },
  lg: { container: 'text-2xl', flora: 'text-2xl', iq: 'text-3xl' },
  xl: { container: 'text-4xl', flora: 'text-4xl', iq: 'text-5xl' },
};

const FloraIQLogo = ({
  size = 'md',
  className = '',
  disableAnimation = false
}: FloraIQLogoProps) => {
  const sizes = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-1 font-serif font-bold tracking-tight', sizes.container, className)}>
      {/* Flora - Cannabis green */}
      <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent font-black">
        Flora
      </span>

      {/* IQ - Animated tech purple/blue with pulse glow */}
      {disableAnimation ? (
        <span className="bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-400 bg-clip-text text-transparent font-black">
          IQ
        </span>
      ) : (
        <motion.span
          className={cn(
            "bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-400 bg-clip-text text-transparent font-black relative",
            sizes.iq
          )}
          animate={{
            textShadow: [
              "0 0 8px rgba(139, 92, 246, 0.5), 0 0 16px rgba(59, 130, 246, 0.3)",
              "0 0 16px rgba(139, 92, 246, 0.8), 0 0 32px rgba(59, 130, 246, 0.5)",
              "0 0 8px rgba(139, 92, 246, 0.5), 0 0 16px rgba(59, 130, 246, 0.3)",
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          whileHover={{
            scale: 1.05,
            transition: { duration: 0.2 }
          }}
        >
          IQ
        </motion.span>
      )}
    </div>
  );
};

export default FloraIQLogo;
