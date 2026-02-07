import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const location = useLocation();

  // Auto-generate breadcrumbs from URL if not provided
  const breadcrumbs = items || (() => {
    const pathnames = location.pathname.split('/').filter((x) => x);
    const crumbs: BreadcrumbItem[] = [
      { label: 'Home', href: '/' }
    ];

    let currentPath = '';
    pathnames.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathnames.length - 1;
      
      // Skip known path segments we don't want to show
      if (segment === 'admin' || segment === 'account' || segment === 'courier') {
        // Add the main section as a clickable crumb
        if (index === 0) {
          crumbs.push({
            label: segment === 'admin' ? 'Admin' : segment === 'account' ? 'Account' : 'Courier',
            href: currentPath
          });
        }
        return;
      }

      // Format segment label
      const label = segment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      crumbs.push({
        label,
        href: isLast ? undefined : currentPath
      });
    });

    return crumbs;
  })();

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center space-x-1 text-sm text-muted-foreground mb-6"
    >
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <div key={crumb.label} className="flex items-center">
            {index === 0 ? (
              <Link
                to="/"
                className="hover:text-foreground transition-colors"
                aria-label="Home"
              >
                <Home className="h-4 w-4" />
              </Link>
            ) : (
              <ChevronRight className="h-4 w-4 mx-1" />
            )}
            
            {isLast || !crumb.href ? (
              <span
                className={cn(
                  "font-medium",
                  isLast && "text-foreground"
                )}
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.href}
                className="hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

