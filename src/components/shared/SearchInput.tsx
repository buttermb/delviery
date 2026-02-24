import { useState, useEffect, useRef, useId } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, X } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

interface SearchInputProps {
    placeholder?: string;
    onSearch: (value: string) => void;
    className?: string;
    defaultValue?: string;
    delay?: number;
    isLoading?: boolean;
}

export function SearchInput({
    placeholder = "Search...",
    onSearch,
    className,
    defaultValue = "",
    delay = 300,
    isLoading = false,
}: SearchInputProps) {
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState(defaultValue);
    const debouncedValue = useDebounce(value, delay);

    // Sync internal state when parent resets defaultValue (e.g. "Clear all filters")
    useEffect(() => {
        setValue(defaultValue);
    }, [defaultValue]);

    useEffect(() => {
        if (typeof onSearch === 'function') {
            onSearch(debouncedValue);
        }
    }, [debouncedValue, onSearch]);

    const handleClear = () => {
        setValue("");
        if (typeof onSearch === 'function') {
            onSearch("");
        }
        // Return focus to input after clearing
        inputRef.current?.focus();
    };

    return (
        <div className={cn("relative", className)}>
            <label htmlFor={inputId} className="sr-only">{placeholder}</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                ref={inputRef}
                id={inputId}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="pl-9 pr-9"
                placeholder={placeholder}
            />

            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}

                {!isLoading && value && (
                    <button
                        type="button"
                        aria-label="Clear search"
                        onClick={handleClear}
                        className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
