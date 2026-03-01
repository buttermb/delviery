/**
 * Coupon Redemption Table Component
 * Displays detailed redemption tracking with recent usage history
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Receipt, Search, Calendar, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';
import { formatDistanceToNow } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Coupon = Database['public']['Tables']['coupon_codes']['Row'];
type CouponUsage = Database['public']['Tables']['coupon_usage']['Row'];

interface RedemptionRecord {
  id: string;
  couponId: string;
  couponCode: string;
  discountType: string | null;
  discountValue: number | null;
  discountAmount: number;
  usedAt: string;
  orderId: string | null;
}

const PAGE_SIZE = 10;

interface CouponRedemptionTableProps {
  className?: string;
  maxRows?: number;
}

export function CouponRedemptionTable({ className, maxRows }: CouponRedemptionTableProps) {
  const { tenant } = useTenantAdminAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.coupons.all, 'redemptions', tenant?.id, dateFilter],
    queryFn: async () => {
      if (!tenant?.id) {
        throw new Error('No tenant');
      }

      try {
        // Fetch all coupons for this tenant
        const couponsResult = await supabase
          .from('coupon_codes')
          .select('id, code, discount_type, discount_value')
          .eq('tenant_id', tenant.id);
        
        const { data: coupons, error: couponsError } = couponsResult;

        if (couponsError) {
          logger.error('Failed to fetch coupons', couponsError, { component: 'CouponRedemptionTable' });
          throw couponsError;
        }

        const couponList = (coupons ?? []) as Coupon[];
        const couponIds = couponList.map(c => c.id);
        const couponMap = new Map(couponList.map(c => [c.id, c]));

        if (couponIds.length === 0) {
          return { redemptions: [], totalCount: 0 };
        }

        // Build usage query with date filter
        let usageQuery = supabase
          .from('coupon_usage')
          .select('id, coupon_id, discount_amount, used_at, order_id', { count: 'exact' })
          .in('coupon_id', couponIds)
          .order('used_at', { ascending: false });

        // Apply date filter
        if (dateFilter !== 'all') {
          const now = new Date();
          let startDate: Date;

          switch (dateFilter) {
            case 'today':
              startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              break;
            case 'week':
              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              break;
            case 'month':
              startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              break;
            default:
              startDate = new Date(0);
          }

          usageQuery = usageQuery.gte('used_at', startDate.toISOString());
        }

        const { data: usage, error: usageError, count } = await usageQuery;

        if (usageError) {
          logger.error('Failed to fetch coupon usage', usageError, { component: 'CouponRedemptionTable' });
          throw usageError;
        }

        const usageData = (usage ?? []) as CouponUsage[];

        // Map usage data to redemption records
        const redemptions: RedemptionRecord[] = usageData.map(u => {
          const coupon = couponMap.get(u.coupon_id ?? '');
          return {
            id: u.id,
            couponId: u.coupon_id ?? '',
            couponCode: coupon?.code || 'Unknown',
            discountType: coupon?.discount_type || null,
            discountValue: coupon?.discount_value || null,
            discountAmount: u.discount_amount,
            usedAt: u.used_at || new Date().toISOString(),
            orderId: u.order_id,
          };
        });

        return {
          redemptions,
          totalCount: count || redemptions.length,
        };
      } catch (error) {
        logger.error('Error fetching redemptions', error, { component: 'CouponRedemptionTable' });
        throw error;
      }
    },
    enabled: !!tenant?.id,
  });

  // Filter and paginate locally
  const filteredRedemptions = data?.redemptions.filter(r =>
    r.couponCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.orderId?.toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];

  const displayLimit = maxRows || PAGE_SIZE;
  const totalPages = Math.ceil(filteredRedemptions.length / displayLimit);
  const paginatedRedemptions = maxRows
    ? filteredRedemptions.slice(0, maxRows)
    : filteredRedemptions.slice(page * displayLimit, (page + 1) * displayLimit);

  const getDiscountDisplay = (type: string | null, value: number | null) => {
    if (!type || value === null) return '-';
    if (type === 'percentage') return `${value}%`;
    if (type === 'fixed') return formatCurrency(value);
    if (type === 'free_shipping') return 'Free Ship';
    if (type === 'bogo') return 'BOGO';
    return '-';
  };

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Failed to load redemption data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Redemption History
            </CardTitle>
            <CardDescription>
              Track coupon usage and discount amounts
            </CardDescription>
          </div>

          {!maxRows && (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code or order..."
                  aria-label="Search by code or order"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(0);
                  }}
                  className="pl-9 w-full sm:w-[200px]"
                />
              </div>
              <Select value={dateFilter} onValueChange={(v) => {
                setDateFilter(v);
                setPage(0);
              }}>
                <SelectTrigger className="w-full sm:w-[140px]" aria-label="Filter by date range">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : paginatedRedemptions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? 'No redemptions match your search' : 'No redemptions recorded yet'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coupon Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Amount Saved</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRedemptions.map((redemption) => (
                    <TableRow key={redemption.id}>
                      <TableCell>
                        <code className="text-sm font-medium bg-muted px-2 py-1 rounded">
                          {redemption.couponCode}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getDiscountDisplay(redemption.discountType, redemption.discountValue)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-emerald-600">
                        {formatCurrency(redemption.discountAmount)}
                      </TableCell>
                      <TableCell>
                        {redemption.orderId ? (
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-mono text-muted-foreground">
                              {redemption.orderId.slice(0, 8)}...
                            </span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(redemption.usedAt), { addSuffix: true })}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {!maxRows && totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {page * displayLimit + 1} - {Math.min((page + 1) * displayLimit, filteredRedemptions.length)} of {filteredRedemptions.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
