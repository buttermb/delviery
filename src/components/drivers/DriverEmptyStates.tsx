import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// NoDriversEmpty — shown when directory has zero drivers
// ---------------------------------------------------------------------------

interface NoDriversEmptyProps {
  onAddDriver: () => void;
  className?: string;
}

export function NoDriversEmpty({ onAddDriver, className }: NoDriversEmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
        <svg className="h-7 w-7 text-emerald-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      </div>

      <h3 className="mt-4 text-base font-semibold text-foreground">No drivers yet</h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
        Add your first driver to start managing deliveries
      </p>

      <Button
        onClick={onAddDriver}
        className="mt-5 bg-emerald-500 text-white hover:bg-emerald-600"
      >
        <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Driver
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NoResultsEmpty — shown when search/filters match nothing
// ---------------------------------------------------------------------------

interface NoResultsEmptyProps {
  onClearFilters: () => void;
  className?: string;
}

export function NoResultsEmpty({ onClearFilters, className }: NoResultsEmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/30">
        <svg className="h-7 w-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </div>

      <h3 className="mt-4 text-base font-semibold text-foreground">
        No drivers match your filters
      </h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
        Try adjusting your search or filter criteria
      </p>

      <Button
        variant="ghost"
        onClick={onClearFilters}
        className="mt-5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        Clear Filters
      </Button>
    </div>
  );
}
