import * as React from "react";

import { cn } from "@/lib/utils";

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  containerClassName?: string;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, ...props }, ref) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = React.useState(false);
    const [canScrollRight, setCanScrollRight] = React.useState(false);

    React.useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;

      const updateScrollState = () => {
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setCanScrollLeft(scrollLeft > 2);
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
      };

      updateScrollState();
      el.addEventListener('scroll', updateScrollState, { passive: true });
      const observer = new ResizeObserver(updateScrollState);
      observer.observe(el);

      return () => {
        el.removeEventListener('scroll', updateScrollState);
        observer.disconnect();
      };
    }, []);

    return (
      <div className="relative w-full">
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-4 z-10 pointer-events-none bg-gradient-to-r from-background/80 to-transparent" />
        )}
        <div
          ref={scrollRef}
          className={cn("relative w-full overflow-auto", containerClassName)}
        >
          <table ref={ref} className={cn("w-full caption-bottom text-sm dark:bg-gray-800 dark:text-gray-100", className)} {...props} />
        </div>
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-4 z-10 pointer-events-none bg-gradient-to-l from-background/80 to-transparent" />
        )}
      </div>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))] [&_tr]:border-b dark:bg-gray-800 dark:text-gray-100", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0 dark:bg-gray-800 dark:text-gray-100", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0 dark:bg-gray-800 dark:text-gray-100", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, scope = "col", ...props }, ref) => (
    <th
      ref={ref}
      scope={scope}
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 dark:bg-gray-800 dark:text-gray-100",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0 dark:bg-gray-800 dark:text-gray-100", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground dark:text-gray-100", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
