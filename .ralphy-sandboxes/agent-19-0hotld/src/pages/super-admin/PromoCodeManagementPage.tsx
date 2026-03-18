/**
 * Promo Code Management Page - Super Admin
 * 
 * Create, manage, and track promotional credit codes.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  MoreHorizontal,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Users,
  CheckCircle,
  XCircle,
  Calendar,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';
import {
  getAllPromoCodes as getAdminPromoCodes,
  createPromoCode as createAdminPromoCode,
  updatePromoCode,
  getPromoCodeRedemptions,
  type PromoCodeAdmin,
} from '@/lib/credits';

export default function PromoCodeManagementPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCode, setSelectedCode] = useState<PromoCodeAdmin | null>(null);
  const [showRedemptions, setShowRedemptions] = useState(false);

  // Fetch promo codes
  const { data: promoCodes, isLoading, refetch } = useQuery({
    queryKey: queryKeys.superAdminTools.promoCodes(),
    queryFn: getAdminPromoCodes,
  });

  // Fetch redemptions for selected code
  const { data: redemptions, isLoading: redemptionsLoading } = useQuery({
    queryKey: queryKeys.superAdminTools.promoRedemptions(selectedCode?.id),
    queryFn: () => selectedCode ? getPromoCodeRedemptions(selectedCode.id) : null,
    enabled: !!selectedCode && showRedemptions,
  });

  // Filter codes by search
  const filteredCodes = promoCodes?.filter(code =>
    code.code.toLowerCase().includes(search.toLowerCase()) ||
    code.description?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  // Toggle active status
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updatePromoCode(id, { isActive }),
    onSuccess: () => {
      toast.success('Promo code updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.promoCodes() });
    },
    onError: (error) => {
      toast.error('Failed to update promo code', { description: humanizeError(error) });
    },
  });

  // Copy code to clipboard
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  // View redemptions
  const viewRedemptions = (code: PromoCodeAdmin) => {
    setSelectedCode(code);
    setShowRedemptions(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Promo Code Management</h1>
          <p className="text-muted-foreground">
            Create and manage promotional credit codes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Code
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search promo codes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Search promo codes"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{promoCodes?.length ?? 0}</div>
          <div className="text-sm text-muted-foreground">Total Codes</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">
            {promoCodes?.filter(c => c.isActive).length ?? 0}
          </div>
          <div className="text-sm text-muted-foreground">Active</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-purple-600">
            {promoCodes?.reduce((sum, c) => sum + c.usesCount, 0) ?? 0}
          </div>
          <div className="text-sm text-muted-foreground">Total Redemptions</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600">
            {(promoCodes?.reduce((sum, c) => sum + (c.creditsAmount * c.usesCount), 0) ?? 0).toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Credits Distributed</div>
        </Card>
      </div>

      {/* Promo Codes Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Redemptions</TableHead>
                <TableHead>Valid Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredCodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No promo codes found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-bold">{code.code}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyCode(code.code)}
                          aria-label="Copy promo code"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {code.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {code.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-medium text-green-600">
                        +{code.creditsAmount.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{code.usesCount}</span>
                        {code.maxUses && (
                          <span className="text-muted-foreground">/ {code.maxUses}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(code.validFrom), 'MMM d, yyyy')}
                      {code.validUntil && (
                        <> - {format(new Date(code.validUntil), 'MMM d, yyyy')}</>
                      )}
                    </TableCell>
                    <TableCell>
                      {code.isActive ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Promo code actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => viewRedemptions(code as unknown as PromoCodeAdmin)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Redemptions
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyCode(code.code)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Code
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toggleMutation.mutate({ id: code.id, isActive: !code.isActive })}
                          >
                            {code.isActive ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <CreatePromoCodeDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={() => {
          setShowCreate(false);
          queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.promoCodes() });
        }}
      />

      {/* Redemptions Sheet */}
      <Sheet open={showRedemptions} onOpenChange={setShowRedemptions}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Redemption History</SheetTitle>
            <SheetDescription>
              {selectedCode && (
                <>
                  Showing redemptions for <code className="font-mono font-bold">{selectedCode.code}</code>
                </>
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {redemptionsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : redemptions?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No redemptions yet
              </div>
            ) : (
              <div className="space-y-2">
                {redemptions?.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">{r.tenantName}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.redeemedAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      +{r.creditsGranted.toLocaleString()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Create Promo Code Dialog
function CreatePromoCodeDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState('');
  const [credits, setCredits] = useState(500);
  const [maxUses, setMaxUses] = useState<number | undefined>();
  const [validUntil, setValidUntil] = useState<Date | undefined>();
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: () => createAdminPromoCode({
      code: code || generateCode(),
      creditsAmount: credits,
      maxUses,
      validUntil: validUntil || undefined,
      description: description || undefined,
    }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Promo code created');
        resetForm();
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to create promo code');
      }
    },
  });

  const resetForm = () => {
    setCode('');
    setCredits(500);
    setMaxUses(undefined);
    setValidUntil(undefined);
    setDescription('');
  };

  const generateCode = () => {
    return 'PROMO' + Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Promo Code</DialogTitle>
          <DialogDescription>
            Create a new promotional credit code
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Code</Label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Leave empty for auto-generate"
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setCode(generateCode())}
              >
                Generate
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Credits Amount</Label>
            <Input
              type="number"
              value={credits}
              onChange={(e) => setCredits(parseInt(e.target.value) || 0)}
              min={1}
            />
            <div className="flex gap-2">
              {[100, 250, 500, 1000].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCredits(preset)}
                  className={credits === preset ? 'border-primary' : ''}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Max Uses (Optional)</Label>
            <Input
              type="number"
              value={maxUses || ''}
              onChange={(e) => setMaxUses(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Unlimited"
              min={1}
            />
          </div>

          <div className="space-y-2">
            <Label>Valid Until (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left">
                  <Calendar className="h-4 w-4 mr-2" />
                  {validUntil ? format(validUntil, 'MMM d, yyyy') : 'No expiration'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={validUntil}
                  onSelect={setValidUntil}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Description (Optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Holiday promotion"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {createMutation.isPending ? 'Creating...' : 'Create Code'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}







