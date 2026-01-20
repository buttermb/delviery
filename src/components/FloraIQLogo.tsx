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
      {/* Stem */}
      <path d="M12 21V11" strokeWidth="2.5" />

      {/* Leaves */}
      <path d="M12 17C9 16.5 8 14 8 14" strokeWidth="2.5" />
      <path d="M12 17C15 16.5 16 14 16 14" strokeWidth="2.5" />

      {/* Flower Head - 4 petals + center */}
      {/* Top Petal */}
      <circle cx="12" cy="7" r="2.5" strokeWidth="2.5" />
      {/* Bottom Petal */}
      <circle cx="12" cy="15" r="2.5" strokeWidth="2.5" />
      {/* Left Petal */}
      <circle cx="8" cy="11" r="2.5" strokeWidth="2.5" />
      {/* Right Petal */}
      <circle cx="16" cy="11" r="2.5" strokeWidth="2.5" />
      {/* Center Dot */}
      <circle cx="12" cy="11" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default FloraIQLogo;
