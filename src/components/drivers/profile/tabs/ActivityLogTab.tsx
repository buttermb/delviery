import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'status_change', label: 'Status Changes' },
  { value: 'delivery_completed', label: 'Deliveries' },
  { value: 'auth', label: 'Auth Events' },
  { value: 'admin', label: 'Admin Actions' },
] as const;

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Event type styling
// ---------------------------------------------------------------------------

interface EventStyle {
  icon: string;
  bg: string;
  text: string;
}

function getEventStyle(eventType: string): EventStyle {
  switch (eventType) {
    case 'came_online':
    case 'went_offline':
    case 'status_change':
      return { icon: '●', bg: 'rgba(16,185,129,0.2)', text: '#10B981' };
    case 'delivery_completed':
      return { icon: '▸', bg: 'rgba(59,130,246,0.2)', text: '#3B82F6' };
    case 'pin_reset':
    case 'password_reset':
      return { icon: '⚿', bg: 'rgba(245,158,11,0.2)', text: '#F59E0B' };
    case 'invite_sent':
    case 'invite_resent':
      return { icon: '✉', bg: 'rgba(139,92,246,0.2)', text: '#8B5CF6' };
    case 'first_login':
    case 'login':
      return { icon: '⊡', bg: 'rgba(6,182,212,0.2)', text: '#06B6D4' };
    case 'account_created':
      return { icon: '◉', bg: 'rgba(148,163,184,0.2)', text: '#94A3B8' };
    case 'suspended':
    case 'terminated':
      return { icon: '⊘', bg: 'rgba(239,68,68,0.2)', text: '#EF4444' };
    default:
      return { icon: '●', bg: 'rgba(148,163,184,0.2)', text: '#94A3B8' };
  }
}

function getEventDescription(eventType: string, eventData: Record<string, unknown>): string {
  switch (eventType) {
    case 'came_online':
      return 'Came online';
    case 'went_offline':
      return 'Went offline';
    case 'status_change':
      return `Status changed to ${(eventData.new_status as string) ?? 'unknown'}`;
    case 'delivery_completed': {
      const order = (eventData.order_number as string) ?? '';
      const rating = eventData.rating as number | undefined;
      return `Completed delivery ${order ? `#${order}` : ''}${rating ? ` Rated ★${rating}` : ''}`;
    }
    case 'pin_reset':
      return `PIN reset${eventData.by_admin ? ' by Admin' : ''}`;
    case 'password_reset':
      return `Password reset${eventData.by_admin ? ' by Admin' : ''}`;
    case 'invite_sent':
      return 'Invite email sent';
    case 'invite_resent':
      return 'Invite email resent';
    case 'first_login': {
      const device = (eventData.device as string) ?? '';
      return `First login${device ? ` · ${device}` : ''}`;
    }
    case 'login':
      return 'Logged in';
    case 'account_created':
      return `Account created${eventData.by_admin ? ' by Admin' : ''}`;
    case 'suspended':
      return `Account suspended${eventData.reason ? ` — ${eventData.reason}` : ''}`;
    case 'terminated':
      return `Account terminated${eventData.reason ? ` — ${eventData.reason}` : ''}`;
    default:
      return eventType.replace(/_/g, ' ');
  }
}

function getEventFilterCategory(eventType: string): string {
  if (eventType === 'status_change' || eventType === 'came_online' || eventType === 'went_offline') {
    return 'status_change';
  }
  if (eventType === 'delivery_completed') return 'delivery_completed';
  if (
    eventType === 'first_login' ||
    eventType === 'login' ||
    eventType === 'pin_reset' ||
    eventType === 'password_reset'
  ) {
    return 'auth';
  }
  if (
    eventType === 'account_created' ||
    eventType === 'suspended' ||
    eventType === 'terminated' ||
    eventType === 'invite_sent' ||
    eventType === 'invite_resent'
  ) {
    return 'admin';
  }
  return 'all';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ActivityLogTabProps {
  driver: DriverProfile;
  tenantId: string;
}

export function ActivityLogTab({ driver, tenantId }: ActivityLogTabProps) {
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);

  const resetAndSetFilter = useCallback((value: string) => {
    setFilter(value);
    setPage(1);
  }, []);

  const activityQuery = useQuery({
    queryKey: [
      ...queryKeys.couriersAdmin.byTenant(tenantId),
      'activity-log',
      driver.id,
      { filter, page },
    ],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('driver_activity_log')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('driver_id', driver.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      // Apply event type filter
      if (filter === 'status_change') {
        query = query.in('event_type', ['status_change', 'came_online', 'went_offline']);
      } else if (filter === 'delivery_completed') {
        query = query.eq('event_type', 'delivery_completed');
      } else if (filter === 'auth') {
        query = query.in('event_type', ['first_login', 'login', 'pin_reset', 'password_reset']);
      } else if (filter === 'admin') {
        query = query.in('event_type', [
          'account_created',
          'suspended',
          'terminated',
          'invite_sent',
          'invite_resent',
        ]);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch activity log', error);
        throw error;
      }

      return { data: data ?? [], count: count ?? 0 };
    },
    enabled: !!tenantId && !!driver.id,
  });

  const events = activityQuery.data?.data ?? [];
  const totalCount = activityQuery.data?.count ?? 0;
  const hasMore = page * PAGE_SIZE < totalCount;

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {EVENT_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => resetAndSetFilter(value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === value
                ? 'bg-[#10B981] text-white'
                : 'text-[#64748B] hover:bg-[#1E293B] hover:text-[#94A3B8]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-5">
        {activityQuery.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4">
                <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full bg-[#334155]" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48 bg-[#334155]" />
                  <Skeleton className="h-3 w-32 bg-[#334155]" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#64748B]">
            No activity events found.
          </div>
        ) : (
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-[#334155]" />

            <div className="space-y-0">
              {events.map((event, idx) => {
                const eventData = (event.event_data ?? {}) as Record<string, unknown>;
                const style = getEventStyle(event.event_type);
                const description = getEventDescription(event.event_type, eventData);
                const location = (eventData.location as string) ?? null;
                const timestamp = formatEventTime(event.created_at);

                // Group separator: show date header when date changes
                const prevEvent = idx > 0 ? events[idx - 1] : null;
                const showDateHeader =
                  !prevEvent || getDateKey(event.created_at) !== getDateKey(prevEvent.created_at);

                return (
                  <div key={event.id}>
                    {showDateHeader && (
                      <div className="mb-3 mt-1 pl-11 first:mt-0">
                        <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#475569]">
                          {formatDateHeader(event.created_at)}
                        </span>
                      </div>
                    )}
                    <div className="relative flex items-start gap-4 py-2.5">
                      {/* Icon badge */}
                      <div
                        className="z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm"
                        style={{ backgroundColor: style.bg, color: style.text }}
                      >
                        {style.icon}
                      </div>

                      {/* Content */}
                      <div className="flex flex-1 items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-[#F8FAFC]">{description}</p>
                          {location && (
                            <p className="mt-0.5 text-xs text-[#64748B]">{location}</p>
                          )}
                        </div>
                        <span className="flex-shrink-0 text-xs text-[#475569]">
                          {timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={activityQuery.isFetching}
              className="text-xs text-[#64748B] hover:bg-[#263548] hover:text-[#F8FAFC]"
            >
              {activityQuery.isFetching ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEventTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.floor((today.getTime() - eventDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDateKey(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
