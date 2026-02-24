/**
 * Sidebar Search Component
 *
 * Search input that filters sidebar menu items in real-time
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SidebarSearch({
  value,
  onChange,
  placeholder = 'Filter menu...',
  className,
}: SidebarSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Handle keyboard shortcut to focus search (/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on "/" key when not in an input
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Clear and blur on Escape
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        onChange('');
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div className={cn('relative', className)}>
      <Search
        className={cn(
          'absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors',
          isFocused || value ? 'text-foreground' : 'text-muted-foreground'
        )}
      />
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        aria-label="Search sidebar"
        className={cn(
          'h-9 pl-8 pr-8 text-sm min-h-0',
          'bg-muted/50 border-transparent',
          'focus:bg-background focus:border-input',
          'transition-colors'
        )}
      />
      {value ? (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={handleClear}
          tabIndex={-1}
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Clear search</span>
        </Button>
      ) : (
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none hidden h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
          /
        </kbd>
      )}
    </div>
  );
}

/**
 * Filter helper function to match items against search query
 * Matches against item name (case-insensitive)
 */
export function matchesSearchQuery(name: string, query: string): boolean {
  if (!query.trim()) return true;
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedName = name.toLowerCase();
  return normalizedName.includes(normalizedQuery);
}
