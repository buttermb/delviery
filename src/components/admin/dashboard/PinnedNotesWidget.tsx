/**
 * Pinned Notes Widget - "Requires Attention" Dashboard Section
 *
 * Displays order notes that have been marked as pinned, indicating
 * orders that need special attention:
 * - Wrong address
 * - Customer callback needed
 * - Product substitution required
 * - Other flagged issues
 *
 * Provides direct navigation to the order and ability to unpin resolved notes.
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Pin from 'lucide-react/dist/esm/icons/pin';
import PinOff from 'lucide-react/dist/esm/icons/pin-off';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Phone from 'lucide-react/dist/esm/icons/phone';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card';
import Truck from 'lucide-react/dist/esm/icons/truck';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { usePinnedOrderNotes, PIN_REASONS, PinReason } from '@/hooks/usePinnedOrderNotes';
import { queryKeys } from '@/lib/queryKeys';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

/** Get icon for pin reason */
function getPinReasonIcon(reason: string | null) {
  switch (reason) {
    case 'wrong_address':
      return <MapPin className="h-4 w-4" />;
    case 'callback_needed':
      return <Phone className="h-4 w-4" />;
    case 'substitution_required':
      return <RefreshCw className="h-4 w-4" />;
    case 'payment_issue':
      return <CreditCard className="h-4 w-4" />;
    case 'delivery_issue':
      return <Truck className="h-4 w-4" />;
    default:
      return <AlertTriangle className="h-4 w-4" />;
  }
}

/** Get label for pin reason */
function getPinReasonLabel(reason: string | null): string {
  const found = PIN_REASONS.find((r) => r.value === reason);
  return found?.label || 'Attention Needed';
}

/** Get badge variant for pin reason */
function getPinReasonVariant(reason: string | null): 'destructive' | 'outline' | 'secondary' {
  switch (reason) {
    case 'wrong_address':
    case 'payment_issue':
      return 'destructive';
    case 'callback_needed':
    case 'substitution_required':
      return 'outline';
    default:
      return 'secondary';
  }
}

/** Get initials for avatar fallback */
function getInitials(name: string | null, email?: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return '?';
}

export function PinnedNotesWidget() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const {
    pinnedNotes,
    isLoading,
    refetch,
    unpinNote,
    isUnpinning,
  } = usePinnedOrderNotes();

  const getFullPath = (href: string) => {
    if (href.startsWith('/admin') && tenantSlug) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  // Set up real-time subscription for pinned notes
  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel('pinned-notes-widget-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_notes',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, refetch]);

  const handleUnpin = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    unpinNote(noteId);
  };

  const handleNavigateToOrder = (orderId: string) => {
    navigate(getFullPath(`/admin/orders/${orderId}`));
  };

  const pinnedCount = pinnedNotes.length;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Pin className="h-5 w-5 text-orange-500" />
          Requires Attention
        </h3>
        {pinnedCount > 0 && (
          <Badge variant="destructive">{pinnedCount}</Badge>
        )}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-6 rounded" />
            </div>
          ))
        ) : pinnedNotes.length > 0 ? (
          pinnedNotes.map((note) => {
            const userName =
              note.user?.full_name ||
              (note.user?.first_name && note.user?.last_name
                ? `${note.user.first_name} ${note.user.last_name}`
                : null) ||
              note.user?.email ||
              'Unknown';

            const orderNumber = note.order?.order_number || note.order_id.slice(0, 8);

            return (
              <div
                key={note.id}
                className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20"
                onClick={() => handleNavigateToOrder(note.order_id)}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={cn(
                      'p-2 rounded-full shadow-sm flex-shrink-0',
                      note.pin_reason === 'wrong_address' || note.pin_reason === 'payment_issue'
                        ? 'bg-red-500 text-white'
                        : 'bg-orange-500 text-white'
                    )}
                  >
                    {getPinReasonIcon(note.pin_reason)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        Order #{orderNumber}
                      </span>
                      <Badge
                        variant={getPinReasonVariant(note.pin_reason)}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {getPinReasonLabel(note.pin_reason)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {note.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={note.user?.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px]">
                          {getInitials(note.user?.full_name || null, note.user?.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{userName}</span>
                      <span className="opacity-60">
                        • {formatDistanceToNow(new Date(note.pinned_at || note.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30 flex-shrink-0"
                        onClick={(e) => handleUnpin(e, note.id)}
                        disabled={isUnpinning}
                        title="Mark as resolved"
                      >
                        <PinOff className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Mark as resolved (unpin)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            );
          })
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No pinned notes</p>
            <p className="text-xs mt-1">
              Pin important order notes to see them here
            </p>
          </div>
        )}
      </div>

      {pinnedNotes.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-4"
          onClick={() => navigate(getFullPath('/admin/orders'))}
        >
          View All Orders
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </Card>
  );
}

export default PinnedNotesWidget;
