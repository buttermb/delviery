/**
 * GiftCardTable Component
 * DataTable view of all gift cards with search, filter by status, and bulk actions
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { untypedClient } from '@/lib/supabaseUntyped';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { showCopyToast } from '@/utils/toastHelpers';
import { usePagination } from '@/hooks/usePagination';
import { StandardPagination } from '@/components/shared/StandardPagination';
import {
  Search,
  Loader2,
  Copy,
  Mail,
  Ban,
  CheckCircle,
  Gift,
  History,
  Trash2,
} from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';

interface GiftCard {
  id: string;
  code: string;
  initial_balance: number;
  current_balance: number;
  status: 'active' | 'disabled' | 'depleted';
  recipient_email: string | null;
  recipient_name: string | null;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
}

interface GiftCardTableProps {
  storeId: string;
  onViewLedger: (card: GiftCard) => void;
}

type StatusFilter = 'all' | 'active' | 'disabled' | 'depleted';

export function GiftCardTable({ storeId, onViewLedger }: GiftCardTableProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'disable' | 'enable' | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<GiftCard | null>(null);

  const { data: giftCards = [], isLoading } = useQuery({
    queryKey: queryKeys.giftCards.byStore(storeId),
    queryFn: async () => {
      const { data, error } = await untypedClient
        .from('marketplace_gift_cards')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as GiftCard[];
    },
    enabled: !!storeId,
  });

  const filteredCards = useMemo(() => {
    return giftCards.filter(card => {
      const matchesSearch = !searchTerm ||
        card.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.recipient_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || card.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [giftCards, searchTerm, statusFilter]);

  const {
    paginatedItems,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    goToPage,
    changePageSize,
    pageSizeOptions,
  } = usePagination(filteredCards, {
    defaultPageSize: 10,
    persistInUrl: false,
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, newStatus }: { ids: string[]; newStatus: 'active' | 'disabled' }) => {
      const { error } = await untypedClient
        .from('marketplace_gift_cards')
        .update({ status: newStatus })
        .in('id', ids)
        .eq('store_id', storeId);

      if (error) throw error;
    },
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.giftCards.byStore(storeId) });
      toast.success("${variables.ids.length} card(s) ${variables.newStatus === ");
      setSelectedIds(new Set());
      setBulkAction(null);
    },
    onError: (err: Error) => {
      logger.error('Bulk status update failed', { error: err.message });
      toast.error("Error updating cards", { description: humanizeError(err) });
      setBulkAction(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await untypedClient
        .from('marketplace_gift_cards')
        .delete()
        .eq('id', cardId)
        .eq('store_id', storeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.giftCards.byStore(storeId) });
      toast.success('Gift card deleted successfully');
      setDeleteDialogOpen(false);
      setCardToDelete(null);
    },
    onError: (err: Error) => {
      logger.error('Failed to delete gift card', { error: err.message });
      toast.error('Failed to delete gift card', { description: humanizeError(err) });
    },
  });

  const handleDeleteCard = (card: GiftCard) => {
    setCardToDelete(card);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteCard = () => {
    if (cardToDelete) {
      deleteMutation.mutate(cardToDelete.id);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showCopyToast('Gift card code');
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedIds.size === paginatedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedItems.map(c => c.id)));
    }
  };

  const isAllSelected = selectedIds.size === paginatedItems.length && paginatedItems.length > 0;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < paginatedItems.length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
      case 'disabled':
        return <Badge variant="secondary">Disabled</Badge>;
      case 'depleted':
        return <Badge variant="outline" className="text-orange-600 border-orange-600">Depleted</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const totalBalance = useMemo(() => {
    return filteredCards.reduce((sum, card) => sum + card.current_balance, 0);
  }, [filteredCards]);

  const activeCount = giftCards.filter(c => c.status === 'active').length;
  const depletedCount = giftCards.filter(c => c.status === 'depleted').length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Gift Cards
          </CardTitle>
          <CardDescription>
            {giftCards.length} total cards • {activeCount} active • {depletedCount} redeemed • {formatCurrency(totalBalance)} outstanding balance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, email, or name..."
                aria-label="Search gift cards"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  goToPage(0);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as StatusFilter);
                goToPage(0);
              }}
            >
              <SelectTrigger className="w-[160px]" aria-label="Filter by status">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="depleted">Depleted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkAction('disable')}
                disabled={bulkStatusMutation.isPending}
              >
                {bulkStatusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Ban className="h-3 w-3 mr-1" />
                Deactivate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkAction('enable')}
                disabled={bulkStatusMutation.isPending}
              >
                {bulkStatusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <CheckCircle className="h-3 w-3 mr-1" />
                Activate
              </Button>
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No gift cards found</p>
              <p className="text-sm">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Issue your first gift card to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto dark:bg-gray-800 dark:text-gray-100">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleAllSelection}
                        aria-label="Select all"
                        ref={(el) => {
                          if (el) {
                            const button = el as HTMLButtonElement & { indeterminate?: boolean };
                            if ('indeterminate' in button) {
                              button.indeterminate = isIndeterminate;
                            }
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((card) => (
                    <TableRow key={card.id} className={selectedIds.has(card.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(card.id)}
                          onCheckedChange={() => toggleSelection(card.id)}
                          aria-label={`Select card ${card.code}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded font-bold">
                            {card.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyCode(card.code)}
                            aria-label="Copy"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {card.recipient_email ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span>{card.recipient_email}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <div className="font-bold">{formatCurrency(card.current_balance)}</div>
                          {card.current_balance !== card.initial_balance && (
                            <div className="text-xs text-muted-foreground">
                              of {formatCurrency(card.initial_balance)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(card.status)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatSmartDate(card.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {card.expires_at ? formatSmartDate(card.expires_at) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewLedger(card)}
                            title="View transaction history"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteCard(card)}
                            title="Delete gift card"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {filteredCards.length > 0 && (
            <StandardPagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              pageSizeOptions={pageSizeOptions}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
            />
          )}
        </CardContent>
      </Card>

      {/* Delete Gift Card Confirmation */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDeleteCard}
        isLoading={deleteMutation.isPending}
        title="Delete Gift Card"
        description={`Are you sure you want to delete gift card "${cardToDelete?.code}"? This action cannot be undone. Any remaining balance will be forfeited.`}
        itemName={cardToDelete?.code}
        itemType="gift card"
      />

      {/* Bulk Action Confirmation */}
      <AlertDialog open={bulkAction !== null} onOpenChange={() => setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === 'disable' ? 'Deactivate' : 'Activate'} {selectedIds.size} Gift Card(s)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === 'disable'
                ? 'Deactivated cards cannot be used by customers until reactivated.'
                : 'Activated cards will become available for use by customers.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkStatusMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const newStatus = bulkAction === 'disable' ? 'disabled' : 'active';
                bulkStatusMutation.mutate({ ids: Array.from(selectedIds), newStatus });
              }}
              disabled={bulkStatusMutation.isPending}
            >
              {bulkStatusMutation.isPending ? 'Updating...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
