import { useState, useEffect } from "react";
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
    const [value, setValue] = useState(defaultValue);
    const debouncedValue = useDebounce(value, delay);

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
    };

    return (
        <div className={cn("relative", className)}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
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
                        onClick={handleClear}
                        className="text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
