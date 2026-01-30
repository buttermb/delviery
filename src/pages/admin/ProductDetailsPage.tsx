/**
 * Product Details Page
 * Shows detailed product information with tabs for:
 * - Info: Basic product details and cannabis-specific info
 * - Variants: Pricing tiers and configurations
 * - Inventory: Stock levels, batch info, and movement history
 */

import { useParams } from 'react-router-dom';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useProduct, useProductInventoryHistory, useProductFrontedInventory } from '@/hooks/useProduct';
import { useProductMutations } from '@/hooks/useProductMutations';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { SwipeBackWrapper } from '@/components/mobile/SwipeBackWrapper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/utils/formatters';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Package,
    DollarSign,
    Boxes,
    Edit,
    Loader2,
    Image as ImageIcon,
    Beaker,
    Tag,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Clock,
    FileText,
    BarChart3,
} from 'lucide-react';
import { useState } from 'react';

export default function ProductDetailsPage() {
    const { productId } = useParams<{ productId: string }>();
    const { navigateToAdmin, buildAdminUrl } = useTenantNavigation();
    const { tenant } = useTenantAdminAuth();
    const [activeTab, setActiveTab] = useState('info');

    const { data: product, isLoading, error } = useProduct({ productId });
    const { data: inventoryHistory = [], isLoading: historyLoading } = useProductInventoryHistory(productId);
    const { data: frontedInventory = [], isLoading: frontedLoading } = useProductFrontedInventory(productId);

    // Loading state
    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="container mx-auto py-8 text-center">
                <h2 className="text-2xl font-bold text-destructive">Error loading product</h2>
                <p className="text-muted-foreground mt-2">{(error as Error).message}</p>
                <Button onClick={() => navigateToAdmin('inventory-hub?tab=products')} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Products
                </Button>
            </div>
        );
    }

    // Not found state
    if (!product) {
        return (
            <div className="container mx-auto py-8 text-center">
                <h2 className="text-2xl font-bold">Product not found</h2>
                <p className="text-muted-foreground mt-2">The product you are looking for does not exist.</p>
                <Button onClick={() => navigateToAdmin('inventory-hub?tab=products')} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Products
                </Button>
            </div>
        );
    }

    // Calculate inventory stats
    const availableQty = product.available_quantity ?? 0;
    const frontedQty = product.fronted_quantity ?? 0;
    const lowStockThreshold = product.low_stock_alert ?? 10;
    const isLowStock = availableQty > 0 && availableQty <= lowStockThreshold;
    const isOutOfStock = availableQty <= 0;

    // Calculate profit margin
    const calculateMargin = (cost: number | null, price: number | null) => {
        if (!cost || !price || price === 0) return null;
        return ((price - cost) / price * 100).toFixed(1);
    };

    const wholesaleMargin = calculateMargin(product.cost_per_unit, product.wholesale_price);
    const retailMargin = calculateMargin(product.cost_per_unit, product.retail_price);

    return (
        <SwipeBackWrapper onBack={() => navigateToAdmin('inventory-hub?tab=products')}>
            <div className="container mx-auto py-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigateToAdmin('inventory-hub?tab=products')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-4">
                            {product.image_url ? (
                                <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="h-16 w-16 rounded-lg object-cover border"
                                />
                            ) : (
                                <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                                    <Package className="h-8 w-8 text-muted-foreground" />
                                </div>
                            )}
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3 flex-wrap">
                                    {product.name}
                                    {isOutOfStock && (
                                        <Badge variant="destructive">Out of Stock</Badge>
                                    )}
                                    {isLowStock && !isOutOfStock && (
                                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                                            Low Stock
                                        </Badge>
                                    )}
                                </h1>
                                <div className="flex items-center gap-4 text-muted-foreground mt-1 flex-wrap">
                                    {product.sku && (
                                        <span className="text-sm">SKU: {product.sku}</span>
                                    )}
                                    {product.category && (
                                        <Badge variant="secondary" className="capitalize">
                                            {product.category}
                                        </Badge>
                                    )}
                                    {product.strain_type && (
                                        <Badge variant="outline" className="capitalize">
                                            {product.strain_type}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => navigateToAdmin(`inventory-hub?tab=products&edit=${product.id}`)}
                        >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Product
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Available Stock</CardTitle>
                            <Boxes className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${isOutOfStock ? 'text-destructive' : isLowStock ? 'text-amber-600' : ''}`}>
                                {availableQty}
                            </div>
                            {lowStockThreshold > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Alert threshold: {lowStockThreshold}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Wholesale Price</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {product.wholesale_price ? formatCurrency(product.wholesale_price) : '-'}
                            </div>
                            {wholesaleMargin && (
                                <p className="text-xs text-muted-foreground">
                                    {wholesaleMargin}% margin
                                </p>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Retail Price</CardTitle>
                            <Tag className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {product.retail_price ? formatCurrency(product.retail_price) : '-'}
                            </div>
                            {retailMargin && (
                                <p className="text-xs text-muted-foreground">
                                    {retailMargin}% margin
                                </p>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Fronted Qty</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${frontedQty > 0 ? 'text-amber-600' : ''}`}>
                                {frontedQty}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Owed to clients
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                        <TabsTrigger value="info">
                            <FileText className="h-4 w-4 mr-2 hidden sm:block" />
                            Info
                        </TabsTrigger>
                        <TabsTrigger value="variants">
                            <DollarSign className="h-4 w-4 mr-2 hidden sm:block" />
                            Variants
                        </TabsTrigger>
                        <TabsTrigger value="inventory">
                            <Boxes className="h-4 w-4 mr-2 hidden sm:block" />
                            Inventory
                        </TabsTrigger>
                    </TabsList>

                    {/* Info Tab */}
                    <TabsContent value="info" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Basic Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Basic Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Product Name</p>
                                            <p className="font-medium">{product.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">SKU</p>
                                            <p className="font-medium">{product.sku || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Category</p>
                                            <p className="font-medium capitalize">{product.category || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Brand/Vendor</p>
                                            <p className="font-medium">{product.vendor_name || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Barcode</p>
                                            <p className="font-medium font-mono text-sm">{product.barcode || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Menu Visibility</p>
                                            <Badge variant={product.menu_visibility ? 'default' : 'secondary'}>
                                                {product.menu_visibility ? 'Visible' : 'Hidden'}
                                            </Badge>
                                        </div>
                                    </div>
                                    {product.description && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Description</p>
                                            <p className="text-sm mt-1">{product.description}</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Cannabis Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Beaker className="h-4 w-4" />
                                        Cannabis Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Strain Name</p>
                                            <p className="font-medium">{product.strain_name || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Strain Type</p>
                                            <p className="font-medium capitalize">{product.strain_type || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">THC %</p>
                                            <p className="font-medium">
                                                {product.thc_percent != null ? `${product.thc_percent}%` : '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">CBD %</p>
                                            <p className="font-medium">
                                                {product.cbd_percent != null ? `${product.cbd_percent}%` : '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">THCA %</p>
                                            <p className="font-medium">
                                                {product.thca_percentage != null ? `${product.thca_percentage}%` : '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Weight (g)</p>
                                            <p className="font-medium">
                                                {product.weight_grams != null ? `${product.weight_grams}g` : '-'}
                                            </p>
                                        </div>
                                    </div>

                                    {product.strain_lineage && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Strain Lineage</p>
                                            <p className="text-sm mt-1">{product.strain_lineage}</p>
                                        </div>
                                    )}

                                    {product.effects && product.effects.length > 0 && (
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-2">Effects</p>
                                            <div className="flex flex-wrap gap-1">
                                                {product.effects.map((effect, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                        {effect}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {product.medical_benefits && product.medical_benefits.length > 0 && (
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-2">Medical Benefits</p>
                                            <div className="flex flex-wrap gap-1">
                                                {product.medical_benefits.map((benefit, idx) => (
                                                    <Badge key={idx} variant="secondary" className="text-xs">
                                                        {benefit}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Lab Results */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Lab Results & Compliance</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Lab Name</p>
                                            <p className="font-medium">{product.lab_name || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Test Date</p>
                                            <p className="font-medium">
                                                {product.test_date
                                                    ? format(new Date(product.test_date), 'MMM d, yyyy')
                                                    : '-'}
                                            </p>
                                        </div>
                                    </div>
                                    {(product.coa_url || product.lab_results_url) && (
                                        <div className="flex gap-2">
                                            {product.coa_url && (
                                                <Button variant="outline" size="sm" asChild>
                                                    <a href={product.coa_url} target="_blank" rel="noopener noreferrer">
                                                        View COA
                                                    </a>
                                                </Button>
                                            )}
                                            {product.lab_results_url && (
                                                <Button variant="outline" size="sm" asChild>
                                                    <a href={product.lab_results_url} target="_blank" rel="noopener noreferrer">
                                                        Lab Results
                                                    </a>
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Timestamps */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Record Details</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Created At</p>
                                            <p className="font-medium">
                                                {product.created_at
                                                    ? format(new Date(product.created_at), 'MMM d, yyyy h:mm a')
                                                    : '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Version</p>
                                            <p className="font-medium">{product.version ?? 1}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Variants Tab (Pricing Tiers) */}
                    <TabsContent value="variants" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Pricing Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Pricing</CardTitle>
                                    <CardDescription>Cost and selling prices for this product</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-muted-foreground">Cost per Unit</span>
                                            <span className="font-medium">
                                                {product.cost_per_unit ? formatCurrency(product.cost_per_unit) : '-'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-muted-foreground">Wholesale Price</span>
                                            <div className="text-right">
                                                <span className="font-medium">
                                                    {product.wholesale_price ? formatCurrency(product.wholesale_price) : '-'}
                                                </span>
                                                {wholesaleMargin && (
                                                    <p className="text-xs text-green-600">{wholesaleMargin}% margin</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-muted-foreground">Retail Price</span>
                                            <div className="text-right">
                                                <span className="font-medium">
                                                    {product.retail_price ? formatCurrency(product.retail_price) : '-'}
                                                </span>
                                                {retailMargin && (
                                                    <p className="text-xs text-green-600">{retailMargin}% margin</p>
                                                )}
                                            </div>
                                        </div>
                                        {product.sale_price && (
                                            <div className="flex justify-between items-center py-2 border-b">
                                                <span className="text-muted-foreground">Sale Price</span>
                                                <span className="font-medium text-red-600">
                                                    {formatCurrency(product.sale_price)}
                                                </span>
                                            </div>
                                        )}
                                        {product.price_per_lb && (
                                            <div className="flex justify-between items-center py-2 border-b">
                                                <span className="text-muted-foreground">Price per lb</span>
                                                <span className="font-medium">
                                                    {formatCurrency(product.price_per_lb)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Price Tiers */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Price Tiers</CardTitle>
                                    <CardDescription>Volume-based pricing tiers</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {product.prices && typeof product.prices === 'object' ? (
                                        <div className="space-y-2">
                                            {Object.entries(product.prices as Record<string, number>).map(([tier, price]) => (
                                                <div key={tier} className="flex justify-between items-center py-2 border-b last:border-0">
                                                    <span className="text-muted-foreground capitalize">{tier}</span>
                                                    <span className="font-medium">{formatCurrency(price)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground text-center py-4">
                                            No price tiers configured
                                        </p>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Discount Settings */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Discount Settings</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Exclude from Discounts</span>
                                        <Badge variant={product.exclude_from_discounts ? 'destructive' : 'secondary'}>
                                            {product.exclude_from_discounts ? 'Yes' : 'No'}
                                        </Badge>
                                    </div>
                                    {product.minimum_price != null && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Minimum Price</span>
                                            <span className="font-medium">{formatCurrency(product.minimum_price)}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* METRC Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Regulatory IDs</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">METRC Retail ID</p>
                                        <p className="font-mono text-sm mt-1">
                                            {product.metrc_retail_id || '-'}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Inventory Tab */}
                    <TabsContent value="inventory" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Stock Levels */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Stock Levels</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-muted-foreground">Available Quantity</span>
                                            <span className={`font-medium ${isOutOfStock ? 'text-destructive' : isLowStock ? 'text-amber-600' : ''}`}>
                                                {availableQty}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-muted-foreground">Total Quantity</span>
                                            <span className="font-medium">{product.total_quantity ?? '-'}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-muted-foreground">Reserved Quantity</span>
                                            <span className="font-medium">{product.reserved_quantity ?? 0}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-muted-foreground">Fronted Quantity</span>
                                            <span className={`font-medium ${frontedQty > 0 ? 'text-amber-600' : ''}`}>
                                                {frontedQty}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-muted-foreground">Low Stock Alert</span>
                                            <span className="font-medium">{lowStockThreshold}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2">
                                            <span className="text-muted-foreground">In Stock</span>
                                            <Badge variant={product.in_stock ? 'default' : 'destructive'}>
                                                {product.in_stock ? 'Yes' : 'No'}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Batch Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Batch Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Batch Number</p>
                                            <p className="font-medium">{product.batch_number || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Vendor</p>
                                            <p className="font-medium">{product.vendor_name || '-'}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Fronted Inventory */}
                            <Card className="md:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        Fronted Inventory
                                    </CardTitle>
                                    <CardDescription>
                                        Inventory given to clients on credit
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {frontedLoading ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                        </div>
                                    ) : frontedInventory.length === 0 ? (
                                        <p className="text-muted-foreground text-center py-8">
                                            No fronted inventory for this product
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {frontedInventory.map((item: Record<string, unknown>) => (
                                                <div
                                                    key={item.id as string}
                                                    className="flex items-center justify-between p-3 border rounded-lg"
                                                >
                                                    <div>
                                                        <p className="font-medium">
                                                            {(item.client as { name: string } | null)?.name ?? 'Unknown Client'}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {item.created_at
                                                                ? format(new Date(item.created_at as string), 'MMM d, yyyy')
                                                                : '-'}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold">{item.quantity as number} units</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {formatCurrency((item.unit_price as number) ?? 0)}/unit
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Inventory History */}
                            <Card className="md:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4" />
                                        Recent Inventory Movements
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {historyLoading ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                        </div>
                                    ) : inventoryHistory.length === 0 ? (
                                        <p className="text-muted-foreground text-center py-8">
                                            No inventory movements recorded
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {inventoryHistory.slice(0, 10).map((movement: Record<string, unknown>) => (
                                                <div
                                                    key={movement.id as string}
                                                    className="flex items-center justify-between p-3 border rounded-lg"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {(movement.quantity_change as number) > 0 ? (
                                                            <TrendingUp className="h-4 w-4 text-green-600" />
                                                        ) : (
                                                            <TrendingDown className="h-4 w-4 text-red-600" />
                                                        )}
                                                        <div>
                                                            <p className="font-medium capitalize">
                                                                {(movement.movement_type as string)?.replace(/_/g, ' ') ?? 'Unknown'}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {movement.created_at
                                                                    ? format(new Date(movement.created_at as string), 'MMM d, yyyy h:mm a')
                                                                    : '-'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`font-bold ${(movement.quantity_change as number) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {(movement.quantity_change as number) > 0 ? '+' : ''}
                                                            {movement.quantity_change as number}
                                                        </p>
                                                        {movement.notes && (
                                                            <p className="text-xs text-muted-foreground max-w-[200px] truncate">
                                                                {movement.notes as string}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </SwipeBackWrapper>
    );
}
