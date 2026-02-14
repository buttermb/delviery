import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const MobileSearch = ({ value, onChange, placeholder = "Search products...", className }: MobileSearchProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className={cn(
      "relative w-full",
      isMobile && "sticky top-0 z-40 bg-background/95 backdrop-blur-lg py-3 -mx-4 px-4 border-b border-border/40",
      className
    )}>
      <div className="relative">
        <Search className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors",
          isFocused ? "text-primary" : "text-muted-foreground"
        )} />
        <Input
          id="mobile-product-search"
          name="mobile-search"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={cn(
            "pl-10 pr-10 h-12 text-base rounded-full",
            "border-2 transition-all duration-200",
            isFocused 
              ? "border-primary shadow-lg ring-4 ring-primary/10" 
              : "border-border hover:border-primary/50"
          )}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full"
            onClick={() => onChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {value && (
        <div className="mt-2 text-sm text-muted-foreground">
          Searching for "<span className="font-semibold text-foreground">{value}</span>"
        </div>
      )}
    </div>
  );
};

export default MobileSearch;
