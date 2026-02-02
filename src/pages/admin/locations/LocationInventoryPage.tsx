import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import Package from "lucide-react/dist/esm/icons/package";
import Search from "lucide-react/dist/esm/icons/search";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import ArrowUpDown from "lucide-react/dist/esm/icons/arrow-up-down";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { useLocationInventory } from '@/hooks/useLocationInventory';
import { useLocations, useLocationOptions } from '@/hooks/useLocations';
import { Skeleton } from '@/components/ui/skeleton';
import { SEOHead } from '@/components/SEOHead';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

type SortField = 'product_name' | 'quantity' | 'available';
type SortOrder = 'asc' | 'desc';

export default function LocationInventoryPage() {
  const { locationId } = useParams<{ locationId?: string }>();
  const { tenant } = useTenantAdminAuth();
  const { options: locationOptions } = useLocationOptions();
  const { getLocationById } = useLocations();

  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(locationId);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('product_name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const { inventory, summary, isLoading, error, refetch } = useLocationInventory(selectedLocationId);

  const selectedLocation = selectedLocationId ? getLocationById(selectedLocationId) : null;

  // Filter and sort inventory
  const filteredInventory = inventory
    .filter((item) => {
      const matchesSearch =
        item.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.product?.sku?.toLowerCase().includes(searchQuery.toLowerCase());

      if (showLowStockOnly) {
        return matchesSearch && item.quantity <= (item.reserved_quantity || 0);
      }

      return matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'product_name':
          comparison = (a.product?.name || '').localeCompare(b.product?.name || '');
          break;
        case 'quantity':
          comparison = a.quantity - b.quantity;
          break;
        case 'available': {
          const availA = a.quantity - (a.reserved_quantity || 0);
          const availB = b.quantity - (b.reserved_quantity || 0);
          comparison = availA - availB;
          break;
        }
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Calculate totals
  const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const totalReserved = inventory.reduce((sum, item) => sum + (item.reserved_quantity || 0), 0);
  const totalAvailable = totalQuantity - totalReserved;
  const lowStockCount = inventory.filter(
    (item) => item.quantity <= (item.reserved_quantity || 0)
  ).length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  if (!tenant) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      <SEOHead
        title={selectedLocation ? `${selectedLocation.name} Inventory` : 'Location Inventory'}
        description="View and manage inventory by location"
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Location Inventory</h1>
          <p className="text-muted-foreground">
            View inventory levels across your locations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={selectedLocationId || 'all'}
            onValueChange={(value) =>
              setSelectedLocationId(value === 'all' ? undefined : value)
            }
          >
            <SelectTrigger className="w-[250px]">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select a location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locationOptions.map((loc) => (
                <SelectItem key={loc.value} value={loc.value}>
                  {loc.label}
                  {loc.description && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      ({loc.description})
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{inventory.length}</p>
                <p className="text-xs text-muted-foreground">Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalQuantity.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total Units</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">
              {totalAvailable.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Available</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground">Low Stock</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant={showLowStockOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Low Stock Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">Failed to load inventory</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : filteredInventory.length === 0 ? (
        <EnhancedEmptyState
          icon={Package}
          title={showLowStockOnly ? 'No Low Stock Items' : 'No Inventory Found'}
          description={
            showLowStockOnly
              ? 'All products at this location have sufficient stock.'
              : selectedLocationId
              ? 'No inventory at this location yet.'
              : 'Select a location to view its inventory.'
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('product_name')}
                  >
                    <div className="flex items-center gap-2">
                      Product
                      {sortField === 'product_name' && (
                        <ArrowUpDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>SKU</TableHead>
                  {!selectedLocationId && <TableHead>Location</TableHead>}
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => handleSort('quantity')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Quantity
                      {sortField === 'quantity' && (
                        <ArrowUpDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => handleSort('available')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Available
                      {sortField === 'available' && (
                        <ArrowUpDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.map((item) => {
                  const available = item.quantity - (item.reserved_quantity || 0);
                  const isLowStock = available <= 0;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.product?.name || 'Unknown Product'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.product?.sku || '-'}
                      </TableCell>
                      {!selectedLocationId && (
                        <TableCell>
                          <Badge variant="outline">
                            <MapPin className="h-3 w-3 mr-1" />
                            {item.location?.name || 'Unknown'}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-right font-mono">
                        {item.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {(item.reserved_quantity || 0).toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          isLowStock ? 'text-red-500' : 'text-green-500'
                        }`}
                      >
                        {available.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {isLowStock ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-green-500/10 text-green-500 border-green-500/20"
                          >
                            In Stock
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Summary by Product (when viewing all locations) */}
      {!selectedLocationId && summary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inventory Summary by Product</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Locations</TableHead>
                  <TableHead className="text-right">Total Quantity</TableHead>
                  <TableHead className="text-right">Total Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((item) => (
                  <TableRow key={item.product_id}>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.sku || '-'}</TableCell>
                    <TableCell className="text-right">{item.location_count}</TableCell>
                    <TableCell className="text-right font-mono">
                      {item.total_quantity.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {item.total_reserved.toLocaleString()}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${
                        item.available_quantity <= 0 ? 'text-red-500' : 'text-green-500'
                      }`}
                    >
                      {item.available_quantity.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
