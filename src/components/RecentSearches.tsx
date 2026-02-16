import { X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { cn } from "@/lib/utils";

interface RecentSearchesProps {
  onSelect: (search: string) => void;
  maxItems?: number;
  className?: string;
}

export function RecentSearches({ onSelect, maxItems = 5, className }: RecentSearchesProps) {
  const [recentSearches, setRecentSearches, clearSearches] = useLocalStorageState<string[]>(
    "recent-searches",
    []
  );

  const removeSearch = (search: string) => {
    setRecentSearches(recentSearches.filter(s => s !== search));
  };

  const displayedSearches = recentSearches.slice(0, maxItems);

  if (displayedSearches.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Recent Searches
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clearSearches()}
          className="h-6 text-xs"
        >
          Clear all
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {displayedSearches.map((search) => (
          <div
            key={search}
            className="group inline-flex items-center gap-1 px-3 py-1 bg-muted rounded-full text-sm hover:bg-muted/80 transition-colors cursor-pointer"
            onClick={() => onSelect(search)}
          >
            <span>{search}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeSearch(search);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove ${search} from recent searches`}
              title={`Remove ${search} from recent searches`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

