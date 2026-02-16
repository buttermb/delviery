/**
 * CustomerLink - Clickable cross-link to a customer/client detail page.
 * Renders customer name with avatar/initials badge as a clickable link.
 * Shows "Walk-in" label when no customer is assigned.
 * Tooltip displays customer email on hover.
 * Uses useEntityNavigation for consistent navigation.
 */

import { Link } from "react-router-dom";
import User from "lucide-react/dist/esm/icons/user";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEntityNavigation } from "@/hooks/useEntityNavigation";

interface CustomerLinkProps {
  customerId?: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerAvatar?: string | null;
  className?: string;
  showAvatar?: boolean;
}

/**
 * Get initials from a customer name for the avatar fallback
 */
function getInitials(name: string): string {
  if (!name || name === "Walk-in") return "?";

  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function CustomerLink({
  customerId,
  customerName,
  customerEmail,
  customerAvatar,
  className = "",
  showAvatar = true,
}: CustomerLinkProps) {
  const { getEntityUrl } = useEntityNavigation();

  // If no customer assigned, show "Walk-in" label
  if (!customerId) {
    return (
      <span className={`inline-flex items-center gap-2 text-muted-foreground ${className}`}>
        {showAvatar && (
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-muted text-xs">
              <User className="h-3 w-3" />
            </AvatarFallback>
          </Avatar>
        )}
        <span className="italic">Walk-in</span>
      </span>
    );
  }

  const customerUrl = getEntityUrl("CUSTOMER", customerId);
  const displayName = customerName || "Unknown Customer";
  const initials = getInitials(displayName);

  // Build the link content with avatar
  const linkContent = (
    <span className="inline-flex items-center gap-2">
      {showAvatar && (
        <Avatar className="h-6 w-6">
          {customerAvatar ? (
            <AvatarImage src={customerAvatar} alt={displayName} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
      )}
      <span>{displayName}</span>
    </span>
  );

  // If we can't generate a URL (no tenant context), render as plain text
  if (!customerUrl) {
    return (
      <span className={className}>
        {linkContent}
      </span>
    );
  }

  // Wrap in tooltip if email is available
  if (customerEmail) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={customerUrl}
              className={`inline-flex items-center gap-2 text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors ${className}`}
              onClick={(e) => e.stopPropagation()}
            >
              {linkContent}
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>{customerEmail}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Render link without tooltip
  return (
    <Link
      to={customerUrl}
      className={`inline-flex items-center gap-2 text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {linkContent}
    </Link>
  );
}
