/**
 * Credit Packages Management Page - Super Admin
 * 
 * Manage credit packages available for purchase.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit,
  MoreHorizontal,
  RefreshCw,
  Package,
  DollarSign,
  Coins,
  CheckCircle,
  XCircle,
  GripVertical,
  Star,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  getAllCreditPackages,
  upsertCreditPackage,
  type CreditPackageDB,
} from '@/lib/credits';

export default function CreditPackagesPage() {
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [editingPackage, setEditingPackage] = useState<CreditPackageDB | null>(null);

  // Fetch packages
  const { data: packages, isLoading, refetch } = useQuery({
    queryKey: ['admin-credit-packages'],
    queryFn: getAllCreditPackages,
  });

  // Format currency
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  // Calculate price per credit
  const pricePerCredit = (priceCents: number, credits: number) => {
    return (priceCents / credits / 100).toFixed(4);
  };

  // Open edit dialog
  const openEdit = (pkg?: CreditPackageDB) => {
    setEditingPackage(pkg || null);
    setShowEdit(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credit Packages</h1>
          <p className="text-muted-foreground">
            Manage credit packages available for purchase
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => openEdit()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Package
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{packages?.length || 0}</div>
          <div className="text-sm text-muted-foreground">Total Packages</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">
            {packages?.filter(p => p.isActive).length || 0}
          </div>
          <div className="text-sm text-muted-foreground">Active</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600">
            {packages ? formatCurrency(Math.min(...packages.map(p => p.priceCents))) : '$0'}
          </div>
          <div className="text-sm text-muted-foreground">Lowest Price</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-purple-600">
            {packages ? Math.max(...packages.map(p => p.credits)).toLocaleString() : '0'}
          </div>
          <div className="text-sm text-muted-foreground">Max Credits</div>
        </Card>
      </div>

      {/* Packages Table */}
      <Card>
        <CardHeader>
          <CardTitle>Available Packages</CardTitle>
          <CardDescription>
            These packages are shown to tenants in the credit purchase modal
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Package</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Per Credit</TableHead>
                <TableHead>Badge</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : packages?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No packages configured
                  </TableCell>
                </TableRow>
              ) : (
                packages?.map((pkg, index) => (
                  <TableRow key={pkg.id}>
                    <TableCell className="text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{pkg.name}</p>
                          {pkg.description && (
                            <p className="text-xs text-muted-foreground">
                              {pkg.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {pkg.credits.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-green-600">
                      {formatCurrency(pkg.priceCents)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      ${pricePerCredit(pkg.priceCents, pkg.credits)}
                    </TableCell>
                    <TableCell>
                      {pkg.badge ? (
                        <Badge className={
                          pkg.badge === 'POPULAR' ? 'bg-blue-100 text-blue-800' :
                          pkg.badge === 'BEST VALUE' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {pkg.badge === 'POPULAR' && <Star className="h-3 w-3 mr-1" />}
                          {pkg.badge === 'BEST VALUE' && <Sparkles className="h-3 w-3 mr-1" />}
                          {pkg.badge}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {pkg.isActive ? (
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(pkg)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Modal Preview</CardTitle>
          <CardDescription>
            How packages appear to tenants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {packages?.filter(p => p.isActive).map((pkg) => (
              <div
                key={pkg.id}
                className={`relative border rounded-lg p-4 ${
                  pkg.badge ? 'border-primary' : 'border-border'
                }`}
              >
                {pkg.badge && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                    {pkg.badge}
                  </Badge>
                )}
                <div className="text-center pt-2">
                  <h4 className="font-semibold">{pkg.name}</h4>
                  <div className="text-3xl font-bold my-2">
                    {pkg.credits.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">credits</div>
                  <div className="text-xl font-semibold mt-2 text-green-600">
                    {formatCurrency(pkg.priceCents)}
                  </div>
                  <Button className="w-full mt-4" size="sm">
                    Buy Now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <EditPackageDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        package={editingPackage}
        onSuccess={() => {
          setShowEdit(false);
          setEditingPackage(null);
          queryClient.invalidateQueries({ queryKey: ['admin-credit-packages'] });
        }}
      />
    </div>
  );
}

// Edit Package Dialog
function EditPackageDialog({
  open,
  onOpenChange,
  package: pkg,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  package: CreditPackageDB | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(pkg?.name || '');
  const [credits, setCredits] = useState(pkg?.credits || 1000);
  const [priceCents, setPriceCents] = useState(pkg?.priceCents || 2999);
  const [description, setDescription] = useState(pkg?.description || '');
  const [badge, setBadge] = useState(pkg?.badge || '');
  const [isActive, setIsActive] = useState(pkg?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(pkg?.sortOrder || 0);

  // Reset form when package changes
  useState(() => {
    if (pkg) {
      setName(pkg.name);
      setCredits(pkg.credits);
      setPriceCents(pkg.priceCents);
      setDescription(pkg.description || '');
      setBadge(pkg.badge || '');
      setIsActive(pkg.isActive);
      setSortOrder(pkg.sortOrder);
    } else {
      setName('');
      setCredits(1000);
      setPriceCents(2999);
      setDescription('');
      setBadge('');
      setIsActive(true);
      setSortOrder(0);
    }
  });

  const saveMutation = useMutation({
    mutationFn: () => upsertCreditPackage({
      id: pkg?.id,
      name,
      credits,
      priceCents,
      description: description || undefined,
      badge: badge || undefined,
      isActive,
      sortOrder,
    }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(pkg ? 'Package updated' : 'Package created');
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to save package');
      }
    },
  });

  // Format price for display
  const formatPrice = (cents: number) => (cents / 100).toFixed(2);
  const parsePrice = (str: string) => Math.round(parseFloat(str) * 100) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pkg ? 'Edit Package' : 'Create Package'}</DialogTitle>
          <DialogDescription>
            Configure credit package details
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Package Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Starter Pack"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Credits</Label>
              <Input
                type="number"
                value={credits}
                onChange={(e) => setCredits(parseInt(e.target.value) || 0)}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <Label>Price (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={formatPrice(priceCents)}
                  onChange={(e) => setPriceCents(parsePrice(e.target.value))}
                  className="pl-7"
                  min={0}
                />
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price per credit:</span>
              <span className="font-mono">${(priceCents / credits / 100).toFixed(4)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description (Optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Great for getting started"
            />
          </div>

          <div className="space-y-2">
            <Label>Badge (Optional)</Label>
            <Select value={badge} onValueChange={setBadge}>
              <SelectTrigger>
                <SelectValue placeholder="No badge" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No badge</SelectItem>
                <SelectItem value="POPULAR">POPULAR</SelectItem>
                <SelectItem value="BEST VALUE">BEST VALUE</SelectItem>
                <SelectItem value="NEW">NEW</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sort Order</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              min={0}
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name || !credits}>
            {saveMutation.isPending ? 'Saving...' : (pkg ? 'Update' : 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}







