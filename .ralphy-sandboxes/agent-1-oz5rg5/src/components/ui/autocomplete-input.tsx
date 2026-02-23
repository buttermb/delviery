import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getSuggestionsSync, isPopularItem, type SuggestionType } from "@/lib/getSuggestions";
import { Check, Clock, TrendingUp } from "lucide-react";

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  type: SuggestionType;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AutocompleteInput({
  value,
  onChange,
  type,
  placeholder,
  className,
  disabled = false,
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSelections, setRecentSelections] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent selections from localStorage
  useEffect(() => {
    const key = `autocomplete_recent_${type}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setRecentSelections(JSON.parse(stored).slice(0, 3));
      } catch {
        // Ignore parse errors
      }
    }
  }, [type]);

  // Debounced suggestion fetching
  useEffect(() => {
    if (!isFocused && !open) return;
    if (value.trim().length === 0) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const delay = setTimeout(() => {
      // Use sync version for immediate results, async Leafly can be added later
      const results = getSuggestionsSync(value, type);
      setSuggestions(results);
      setOpen(results.length > 0 && isFocused);
      setActiveIndex(-1);
    }, 150); // Reduced from 200ms for snappier feel

    return () => clearTimeout(delay);
  }, [value, type, isFocused, open]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setIsFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback((suggestion: string) => {
    onChange(suggestion);
    setOpen(false);
    setIsFocused(false);
    inputRef.current?.blur();
    
    // Save to recent selections
    const key = `autocomplete_recent_${type}`;
    const stored = localStorage.getItem(key);
    const recent = stored ? JSON.parse(stored) : [];
    const updated = [suggestion, ...recent.filter((s: string) => s !== suggestion)].slice(0, 5);
    localStorage.setItem(key, JSON.stringify(updated));
    setRecentSelections(updated);
  }, [onChange, type]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const hasRecent = value.trim().length === 0 && recentSelections.length > 0;
    const hasSuggestions = suggestions.length > 0;
    
    if (!open || (!hasRecent && !hasSuggestions)) {
      if (e.key === "Escape") {
        setOpen(false);
        setIsFocused(false);
        inputRef.current?.blur();
      }
      return;
    }

    // Calculate total selectable items (excluding headers)
    const totalItems = hasRecent 
      ? recentSelections.length + suggestions.length
      : suggestions.length;
    
    // Build array of all selectable items
    const allItems = hasRecent
      ? [...recentSelections, ...suggestions]
      : suggestions;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => {
        const next = i + 1;
        return next >= totalItems ? 0 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => {
        const prev = i - 1;
        return prev < 0 ? totalItems - 1 : prev;
      });
    } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < allItems.length) {
      e.preventDefault();
      handleSelect(allItems[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setIsFocused(false);
      inputRef.current?.blur();
    }
  }, [open, suggestions, recentSelections, activeIndex, value, handleSelect]);

  const handleFocus = () => {
    setIsFocused(true);
    if (value.trim().length > 0) {
      const results = getSuggestionsSync(value, type);
      if (results.length > 0) {
        setOpen(true);
      }
    } else if (recentSelections.length > 0) {
      // Show recent selections when focused and empty
      setOpen(true);
    }
  };

  const handleBlur = () => {
    // Delay to allow click events to fire first
    setTimeout(() => {
      setIsFocused(false);
      setOpen(false);
    }, 200);
  };

  const displayPlaceholder = placeholder || `Enter ${type} name...`;

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={displayPlaceholder}
        disabled={disabled}
        className={cn("rounded-xl border", className)}
      />
      {open && (suggestions.length > 0 || (value.trim().length === 0 && recentSelections.length > 0)) && (
        <ul className="absolute z-50 mt-1 w-full bg-background shadow-lg rounded-xl border border-border max-h-60 overflow-auto">
          {value.trim().length === 0 && recentSelections.length > 0 && (
            <>
              <li className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border">
                Recent Selections
              </li>
              {recentSelections.map((s, i) => (
                <li
                  key={`recent-${s}`}
                  onClick={() => handleSelect(s)}
                  className={cn(
                    "px-3 py-2 cursor-pointer hover:bg-muted transition-colors flex items-center gap-2",
                    i === activeIndex && "bg-muted"
                  )}
                >
                    <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1">{s}</span>
                  {isPopularItem(s, type) && (
                    <TrendingUp className="h-3 w-3 text-primary flex-shrink-0" aria-label="Popular" />
                  )}
                </li>
              ))}
              {suggestions.length > 0 && (
                <li className="px-3 py-2 text-xs font-semibold text-muted-foreground border-t border-b border-border">
                  Suggestions
                </li>
              )}
            </>
          )}
          {suggestions.map((s, i) => {
            const adjustedIndex = value.trim().length === 0 && recentSelections.length > 0 
              ? i + recentSelections.length 
              : i;
            // Highlight matching text
            const highlightText = (text: string, query: string) => {
              if (!query.trim()) return text;
              const parts = text.split(new RegExp(`(${query})`, 'gi'));
              return parts.map((part, idx) => 
                part.toLowerCase() === query.toLowerCase() ? (
                  <mark key={idx} className="bg-primary/20 text-primary font-medium">
                    {part}
                  </mark>
                ) : (
                  part
                )
              );
            };

            return (
              <li
                key={s}
                onClick={() => handleSelect(s)}
              className={cn(
                "px-3 py-2 cursor-pointer hover:bg-muted transition-colors flex items-center justify-between",
                adjustedIndex === activeIndex && "bg-muted"
              )}
              >
                <span className="flex-1">{highlightText(s, value)}</span>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  {isPopularItem(s, type) && (
                    <TrendingUp className="h-3 w-3 text-primary" aria-label="Popular" />
                  )}
                  {value.toLowerCase() === s.toLowerCase() && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {open && suggestions.length === 0 && value.trim().length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-background shadow-lg rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground">
          No popular results — press Enter to create new
        </div>
      )}
    </div>
  );
}

