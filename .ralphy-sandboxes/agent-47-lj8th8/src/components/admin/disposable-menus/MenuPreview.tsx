/**
 * MenuPreview Component
 * Shows a customer-facing preview of a disposable menu
 * Allows admins to see exactly what customers will see when accessing the menu
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Monitor from "lucide-react/dist/esm/icons/monitor";
import Tablet from "lucide-react/dist/esm/icons/tablet";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import X from "lucide-react/dist/esm/icons/x";
import Shield from "lucide-react/dist/esm/icons/shield";
import Lock from "lucide-react/dist/esm/icons/lock";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Clock from "lucide-react/dist/esm/icons/clock";
import Package from "lucide-react/dist/esm/icons/package";
import Search from "lucide-react/dist/esm/icons/search";
import User from "lucide-react/dist/esm/icons/user";
import Plus from "lucide-react/dist/esm/icons/plus";
import ZoomIn from "lucide-react/dist/esm/icons/zoom-in";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { jsonToString, extractSecuritySetting, jsonToBooleanSafe } from '@/utils/menuTypeHelpers';
import { useMenuProductsForPreview } from '@/hooks/useMenuProductsForPreview';
import { MenuComplianceBadge } from '@/components/admin/disposable-menus/MenuComplianceBadge';
import type { Json } from '@/integrations/supabase/types';

interface MenuProduct {
  id: string;
  product_id: string;
  custom_price?: number | null;
  display_order?: number;
  display_availability?: boolean;
  products?: {
    id: string;
    product_name: string;
    description?: string | null;
    base_price: number;
    image_url?: string | null;
    category?: string | null;
    strain_type?: string | null;
    thc_content?: number | null;
    cbd_content?: number | null;
  };
  // Alternative flat structure from wholesale_inventory join
  product?: {
    id: string;
    product_name: string;
    description?: string | null;
    base_price: number;
    image_url?: string | null;
    category?: string | null;
  };
}

interface Menu {
  id: string;
  name: string;
  description: Json;
  status: string;
  is_encrypted: boolean;
  device_locking_enabled: boolean;
  security_settings: Json;
  expiration_date: string | null;
  never_expires: boolean;
  created_at: string;
  access_code: string | null;
  disposable_menu_products?: MenuProduct[];
  appearance_settings?: Json;
}

interface MenuPreviewProps {
  menu: Menu;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DevicePreview = 'desktop' | 'tablet' | 'mobile';

export function MenuPreview({ menu, open, onOpenChange }: MenuPreviewProps) {
  const [devicePreview, setDevicePreview] = useState<DevicePreview>('desktop');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Fetch products with details when preview is open
  const { data: menuProducts, isLoading: productsLoading } = useMenuProductsForPreview(
    menu.id,
    open
  );

  // Parse products from fetched data
  const products = (menuProducts || []).map(mp => {
    const productData = mp.product;
    if (!productData) return null;
    return {
      id: mp.product_id,
      name: productData.product_name,
      description: productData.description,
      price: mp.custom_price ?? productData.base_price,
      image_url: productData.image_url,
      category: productData.category,
      strain_type: productData.strain_type,
      thc_content: productData.thc_content,
      cbd_content: productData.cbd_content,
      display_order: mp.display_order || 0,
      display_availability: mp.display_availability ?? true,
      // Compliance fields
      lab_name: productData.lab_name,
      lab_results_url: productData.lab_results_url,
      test_date: productData.test_date,
      coa_url: productData.coa_url,
      batch_number: productData.batch_number,
    };
  }).filter(Boolean).sort((a, b) => (a?.display_order ?? 0) - (b?.display_order ?? 0)) as Array<{
    id: string;
    name: string;
    description: string | null | undefined;
    price: number;
    image_url: string | null | undefined;
    category: string | null | undefined;
    strain_type: string | null | undefined;
    thc_content: number | null | undefined;
    cbd_content: number | null | undefined;
    display_order: number;
    display_availability: boolean;
    lab_name: string | null | undefined;
    lab_results_url: string | null | undefined;
    test_date: string | null | undefined;
    coa_url: string | null | undefined;
    batch_number: string | null | undefined;
  }>;

  // Get unique categories
  const categories = useMemo(() => {
    return ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Security badges
  const securityFeatures: Array<{ icon: typeof Lock; label: string }> = [];
  if (menu.is_encrypted) securityFeatures.push({ icon: Lock, label: 'Encrypted' });
  if (jsonToBooleanSafe(extractSecuritySetting(menu.security_settings, 'require_geofence'))) {
    securityFeatures.push({ icon: MapPin, label: 'Geofenced' });
  }
  if (menu.device_locking_enabled) securityFeatures.push({ icon: Shield, label: 'Device Lock' });

  const getPreviewStyle = () => {
    switch (devicePreview) {
      case 'mobile':
        return { width: '375px', maxWidth: '100%' };
      case 'tablet':
        return { width: '768px', maxWidth: '100%' };
      default:
        return { width: '100%', maxWidth: '1200px' };
    }
  };

  const getGridCols = () => {
    switch (devicePreview) {
      case 'mobile':
        return 'grid-cols-1';
      case 'tablet':
        return 'grid-cols-2';
      default:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    }
  };

  const menuDescription = jsonToString(menu.description);
  const expiresDate = menu.expiration_date ? new Date(menu.expiration_date) : null;
  const isExpired = expiresDate ? expiresDate < new Date() : false;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-hidden p-0">
          {/* Header with device controls */}
          <div className="sticky top-0 z-50 bg-background border-b">
            <DialogHeader className="p-4">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <span>Customer Preview</span>
                  <Badge variant="outline" className="ml-2">
                    {menu.name}
                  </Badge>
                </DialogTitle>
                <div className="flex items-center gap-2">
                  {/* Device Toggle */}
                  <div className="flex items-center border rounded-lg p-1 gap-1">
                    <Button
                      variant={devicePreview === 'desktop' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setDevicePreview('desktop')}
                      className="h-8 w-8 p-0"
                    >
                      <Monitor className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={devicePreview === 'tablet' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setDevicePreview('tablet')}
                      className="h-8 w-8 p-0"
                    >
                      <Tablet className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={devicePreview === 'mobile' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setDevicePreview('mobile')}
                      className="h-8 w-8 p-0"
                    >
                      <Smartphone className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Preview Container */}
          <div className="flex-1 bg-muted overflow-auto flex justify-center p-4 min-h-0">
            <div
              className="bg-background shadow-2xl overflow-auto transition-all duration-300 rounded-lg"
              style={{
                ...getPreviewStyle(),
                minHeight: 'calc(95vh - 100px)',
                maxHeight: 'calc(95vh - 100px)',
              }}
            >
              {/* Menu Header - Customer View */}
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
                <div className="px-4 py-6 md:py-8">
                  <Card className="border-none bg-card/50 backdrop-blur">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Demo welcome message */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>Welcome, Customer</span>
                        </div>

                        <div>
                          <h1 className={cn(
                            "font-bold text-foreground mb-2",
                            devicePreview === 'mobile' ? "text-2xl" : "text-3xl md:text-4xl"
                          )}>
                            {menu.name}
                          </h1>
                          {menuDescription && (
                            <p className="text-muted-foreground text-lg">
                              {menuDescription}
                            </p>
                          )}
                        </div>

                        {/* Expiration Info */}
                        {expiresDate && !menu.never_expires && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className={isExpired ? 'text-destructive' : 'text-muted-foreground'}>
                              {isExpired ? (
                                'This menu has expired'
                              ) : (
                                <>Expires {formatDistanceToNow(expiresDate, { addSuffix: true })}</>
                              )}
                            </span>
                          </div>
                        )}
                        {menu.never_expires && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>No expiration</span>
                          </div>
                        )}

                        {/* Security Features */}
                        {securityFeatures.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {securityFeatures.map((feature, i) => (
                              <Badge key={i} variant="outline" className="text-xs gap-1">
                                <feature.icon className="h-3 w-3" />
                                {feature.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Products Section */}
              <div className="p-4">
                {/* Search and Filters */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b pb-4 mb-4 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Category Tabs */}
                  {categories.length > 1 && (
                    <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                      <TabsList className={cn(
                        "w-full justify-start overflow-x-auto",
                        devicePreview === 'mobile' && "flex-wrap"
                      )}>
                        {categories.map(cat => (
                          <TabsTrigger key={cat} value={cat} className="capitalize text-sm">
                            {cat}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  )}
                </div>

                {/* Product Grid */}
                {productsLoading ? (
                  <Card className="p-12 text-center">
                    <Loader2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-spin" />
                    <p className="text-muted-foreground">Loading products...</p>
                  </Card>
                ) : filteredProducts.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {products.length === 0 ? 'No products in this menu' : 'No products found'}
                    </p>
                  </Card>
                ) : (
                  <div className={cn("grid gap-4 md:gap-6", getGridCols())}>
                    {filteredProducts.map((product) => (
                      <Card
                        key={product.id}
                        className="group overflow-hidden hover:shadow-lg transition-all duration-300"
                      >
                        {/* Product Image */}
                        <div className="relative aspect-square overflow-hidden bg-muted">
                          {product.image_url ? (
                            <>
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                loading="lazy"
                              />
                              <button
                                onClick={() => setSelectedImage(product.image_url ?? null)}
                                className="absolute top-2 right-2 p-2 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <ZoomIn className="h-4 w-4" />
                              </button>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <Package className="h-16 w-16 opacity-20" />
                            </div>
                          )}

                          {/* Category Badge */}
                          {product.category && (
                            <Badge className="absolute top-2 left-2 capitalize">
                              {product.category}
                            </Badge>
                          )}
                        </div>

                        {/* Product Info */}
                        <CardContent className="p-4 space-y-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg line-clamp-1">{product.name}</h3>
                              {product.strain_type && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    product.strain_type === 'indica' && 'border-purple-500 text-purple-500',
                                    product.strain_type === 'sativa' && 'border-green-500 text-green-500',
                                    product.strain_type === 'hybrid' && 'border-orange-500 text-orange-500',
                                    product.strain_type === 'cbd' && 'border-blue-500 text-blue-500'
                                  )}
                                >
                                  {product.strain_type}
                                </Badge>
                              )}
                            </div>
                            {product.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {product.description}
                              </p>
                            )}

                            {/* Compliance Badges */}
                            <div className="mt-2">
                              <MenuComplianceBadge
                                product={{
                                  id: product.id,
                                  name: product.name,
                                  thc_content: product.thc_content,
                                  cbd_content: product.cbd_content,
                                  lab_name: product.lab_name,
                                  lab_results_url: product.lab_results_url,
                                  test_date: product.test_date,
                                  coa_url: product.coa_url,
                                  batch_number: product.batch_number,
                                }}
                                size="sm"
                                showDetails={false}
                              />
                            </div>
                          </div>

                          {/* Price */}
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold text-primary">
                              ${product.price.toFixed(2)}
                            </span>
                          </div>

                          {/* Demo Add to Cart Button */}
                          <Button className="w-full" disabled>
                            <Plus className="h-4 w-4 mr-2" />
                            Add to Cart
                            <span className="text-xs ml-2 opacity-70">(Preview Only)</span>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Demo Footer */}
              <div className="border-t bg-muted/50 p-4 mt-8">
                <div className="text-center text-sm text-muted-foreground space-y-1">
                  <p>This is a preview of how customers will see your menu.</p>
                  <p>Created {format(new Date(menu.created_at), 'MMM d, yyyy')}</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Zoom Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Product zoom"
              className="w-full h-auto"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
