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

// Custom Unique "Tech-Bloom" Icon
// Circular design for a fuller, non-squished look
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
      {/* Stem/Tail - Curves to right */}
      <path d="M12 18 C12 18 12 22 16 22" strokeWidth="2.5" />

      {/* Leaf - Left side */}
      <path d="M12 20 L9.5 18.5" strokeWidth="2.5" />

      {/* Center Node */}
      <circle cx="12" cy="11" r="1.5" fill="currentColor" stroke="none" />

      {/* 4 Circular Petals (Full & Balanced) */}
      {/* Top */}
      <circle cx="12" cy="6" r="3" strokeWidth="2" />
      {/* Bottom */}
      <circle cx="12" cy="16" r="3" strokeWidth="2" />
      {/* Left */}
      <circle cx="7" cy="11" r="3" strokeWidth="2" />
      {/* Right */}
      <circle cx="17" cy="11" r="3" strokeWidth="2" />
    </svg>
  );
}

export default FloraIQLogo;
