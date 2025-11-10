import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getSuggestions, type SuggestionType } from "@/lib/getSuggestions";
import { Check } from "lucide-react";

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
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced suggestion fetching
  useEffect(() => {
    if (!isFocused && !open) return;
    if (value.trim().length === 0) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const delay = setTimeout(() => {
      const results = getSuggestions(value, type);
      setSuggestions(results);
      setOpen(results.length > 0 && isFocused);
      setActiveIndex(-1);
    }, 200);

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Escape") {
        setOpen(false);
        setIsFocused(false);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      onChange(suggestions[activeIndex]);
      setOpen(false);
      setIsFocused(false);
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setOpen(false);
      setIsFocused(false);
      inputRef.current?.blur();
    }
  }, [open, suggestions, activeIndex, onChange]);

  const handleSelect = useCallback((suggestion: string) => {
    onChange(suggestion);
    setOpen(false);
    setIsFocused(false);
    inputRef.current?.blur();
  }, [onChange]);

  const handleFocus = () => {
    setIsFocused(true);
    if (value.trim().length > 0) {
      const results = getSuggestions(value, type);
      if (results.length > 0) {
        setOpen(true);
      }
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
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-background shadow-lg rounded-xl border border-border max-h-60 overflow-auto">
          {suggestions.map((s, i) => {
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
                  i === activeIndex && "bg-muted"
                )}
              >
                <span className="flex-1">{highlightText(s, value)}</span>
                {value.toLowerCase() === s.toLowerCase() && (
                  <Check className="h-4 w-4 text-primary ml-2 flex-shrink-0" />
                )}
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

