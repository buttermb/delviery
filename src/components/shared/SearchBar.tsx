/**
 * Search Bar Component
 * Reusable search input with filters
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onClear?: () => void;
  showClearButton?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  className,
  onClear,
  showClearButton = true,
}: SearchBarProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'pl-9',
          showClearButton && value && 'pr-9'
        )}
      />
      {showClearButton && value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
          onClick={() => {
            onChange('');
            onClear?.();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

