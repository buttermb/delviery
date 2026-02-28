import { cn } from '@/lib/utils';

interface FloraIQLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
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
    <div className={cn('flex items-center', !iconOnly && sizes.gap, className)}>
      <FlowerMark className={cn('text-green-600 flex-shrink-0', sizes.icon)} />
      {!iconOnly && (
        <div className={cn('flex items-baseline leading-none tracking-tight', sizes.container)}>
          <span className="font-light text-foreground">Flora</span>
          <span className="font-extrabold text-foreground">IQ</span>
        </div>
      )}
    </div>
  );
};

function FlowerMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 52 52"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g transform="translate(26,26)">
        <path d="M 0 -6 C -10 -10 -8 -18 0 -23 C 8 -18 10 -10 0 -6 Z" fill="currentColor" />
        <path d="M 0 -6 C -10 -10 -8 -18 0 -23 C 8 -18 10 -10 0 -6 Z" fill="currentColor" transform="rotate(72)" />
        <path d="M 0 -6 C -10 -10 -8 -18 0 -23 C 8 -18 10 -10 0 -6 Z" fill="currentColor" transform="rotate(144)" />
        <path d="M 0 -6 C -10 -10 -8 -18 0 -23 C 8 -18 10 -10 0 -6 Z" fill="currentColor" transform="rotate(216)" />
        <path d="M 0 -6 C -10 -10 -8 -18 0 -23 C 8 -18 10 -10 0 -6 Z" fill="currentColor" transform="rotate(288)" />
        <circle cx="0" cy="0" r="6.5" fill="white" />
        <circle cx="0" cy="0" r="3" fill="currentColor" />
      </g>
    </svg>
  );
}

export default FloraIQLogo;
