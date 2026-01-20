import { cn } from '@/lib/utils';

interface FloraIQLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  disableAnimation?: boolean;
  iconOnly?: boolean;
}

const sizeMap = {
  sm: { container: 'text-xl', icon: 'w-5 h-5', gap: 'gap-1.5' },
  md: { container: 'text-2xl', icon: 'w-7 h-7', gap: 'gap-2' },
  lg: { container: 'text-3xl', icon: 'w-9 h-9', gap: 'gap-2.5' },
  xl: { container: 'text-4xl', icon: 'w-12 h-12', gap: 'gap-3' },
};

const FloraIQLogo = ({
  size = 'md',
  className = '',
  iconOnly = false,
}: FloraIQLogoProps) => {
  const sizes = sizeMap[size];

  return (
    <div className={cn('flex items-center font-sans font-bold tracking-tight text-[#0f3a22]', !iconOnly && sizes.gap, sizes.container, className)}>
      <FlowerIcon className={sizes.icon} />
      {!iconOnly && <span>FloraIQ</span>}
    </div>
  );
};

// Custom Flower Icon matching the provided design
// Custom Unique "Tech-Bloom" Icon
// Combines organic flower shape with geometric precision (Flora + IQ)
function FlowerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Stem/Tail - Curves to right like a 'Q' tail */}
      <path d="M12 16 C12 16 12 21 16.5 21" strokeWidth="2.5" />

      {/* Geometric Leaf - Left side balance */}
      <path d="M12 18 L9.5 16.5" strokeWidth="2.5" />

      {/* Center Node (Neural/Tech Core) */}
      <circle cx="12" cy="11" r="1.5" fill="currentColor" stroke="none" />

      {/* 4 Elliptical Petals (Propeller/Data-Array) */}
      {/* Top */}
      <ellipse cx="12" cy="6" rx="2" ry="3.5" strokeWidth="2" />
      {/* Bottom */}
      <ellipse cx="12" cy="16" rx="2" ry="3.5" strokeWidth="2" />
      {/* Left */}
      <ellipse cx="7" cy="11" rx="3.5" ry="2" strokeWidth="2" />
      {/* Right */}
      <ellipse cx="17" cy="11" rx="3.5" ry="2" strokeWidth="2" />
    </svg>
  );
}

export default FloraIQLogo;
