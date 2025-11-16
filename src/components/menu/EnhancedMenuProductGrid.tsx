import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMenuCart } from '@/contexts/MenuCartContext';
import { toast } from '@/hooks/use-toast';
import { ShoppingCart, Search, ZoomIn, Plus, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  image_url?: string | null;
  images?: string[];
  quantity_lbs?: number;
  prices?: Record<string, number>;
  strain_type?: string;
  thc_percentage?: number;
  cbd_percentage?: number;
  terpenes?: Array<{ name: string; percentage: number }>;
  effects?: string[];
  flavors?: string[];
  lineage?: string;
}

interface EnhancedMenuProductGridProps {
  products: Product[];
  menuId: string;
  whitelistEntryId?: string;
}

export function EnhancedMenuProductGrid({ products }: EnhancedMenuProductGridProps) {
  const { items, addItem } = useMenuCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price'>('name');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedWeights, setSelectedWeights] = useState<Record<string, string>>({});

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  // Filter and sort products
  const filteredProducts = products
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price;
      return a.name.localeCompare(b.name);
    });

  const getCartQuantity = (productId: string, weight?: string) => {
    return items.find(item => 
      item.productId === productId && item.selectedWeight === weight
    )?.quantity || 0;
  };

  const addToCart = (product: Product) => {
    const prices = product.prices || {};
    const availableWeights = Object.keys(prices);
    
    // Get selected weight or default to 3.5g
    const selectedWeight = selectedWeights[product.id] || 
      (availableWeights.includes('3.5g') ? '3.5g' : availableWeights[0]);
    
    const price = prices[selectedWeight] || product.price;

    addItem({
      id: product.id,
      name: product.name,
      price: price,
      image_url: getProductImage(product),
      selectedWeight: selectedWeight,
    });

    // Trigger confetti effect
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 }
    });

    toast({
      title: 'Added to cart',
      description: `${product.name} (${selectedWeight}) has been added to your cart`,
    });
  };

  const getPriceDisplay = (product: Product) => {
    if (product.prices && Object.keys(product.prices).length > 0) {
      const prices = Object.values(product.prices);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (min === max) return `$${min.toFixed(2)}`;
      return `$${min.toFixed(2)} - $${max.toFixed(2)}`;
    }
    return `$${(product.price || 0).toFixed(2)}`;
  };

  const getProductImage = (product: Product) => {
    return product.image_url || product.images?.[0] || null;
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b pb-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'price')}
            className="px-4 py-2 rounded-md border bg-background"
          >
            <option value="name">Sort by Name</option>
            <option value="price">Sort by Price</option>
          </select>
        </div>

        {/* Category Tabs */}
        {categories.length > 1 && (
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="w-full justify-start overflow-x-auto">
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat} className="capitalize">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No products found</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const selectedWeight = selectedWeights[product.id];
            const cartQuantity = getCartQuantity(product.id, selectedWeight);
            const productImage = getProductImage(product);

            return (
              <Card
                key={product.id}
                className="group overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                {/* Product Image */}
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {productImage ? (
                    <>
                      <img
                        src={productImage}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                      <button
                        onClick={() => setSelectedImage(productImage)}
                        className="absolute top-2 right-2 p-2 rounded-full bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </button>
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <ShoppingCart className="h-16 w-16 opacity-20" />
                    </div>
                  )}
                  
                  {/* Category Badge */}
                  {product.category && (
                    <Badge className="absolute top-2 left-2 capitalize">
                      {product.category}
                    </Badge>
                  )}

                  {/* Cart Badge */}
                  {cartQuantity > 0 && (
                    <Badge className="absolute bottom-2 left-2 bg-primary">
                      {cartQuantity} in cart
                    </Badge>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4 space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg line-clamp-1">{product.name}</h3>
                      {product.strain_type && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            product.strain_type === 'Indica' ? 'border-purple-500 text-purple-500' :
                            product.strain_type === 'Sativa' ? 'border-green-500 text-green-500' :
                            product.strain_type === 'Hybrid' ? 'border-orange-500 text-orange-500' :
                            'border-blue-500 text-blue-500'
                          }`}
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
                    
                    {/* THC/CBD Info */}
                    {(product.thc_percentage || product.cbd_percentage) && (
                      <div className="flex gap-2 mt-2">
                        {product.thc_percentage && (
                          <Badge variant="secondary" className="text-xs">
                            THC {product.thc_percentage.toFixed(1)}%
                          </Badge>
                        )}
                        {product.cbd_percentage && (
                          <Badge variant="secondary" className="text-xs">
                            CBD {product.cbd_percentage.toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {/* Effects */}
                    {product.effects && product.effects.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {product.effects.slice(0, 3).map(effect => (
                          <span key={effect} className="text-xs px-2 py-0.5 rounded-full bg-muted">
                            {effect}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Weight Selector */}
                  {product.prices && Object.keys(product.prices).length > 0 ? (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Select Size:</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {Object.entries(product.prices).map(([weight, price]) => {
                          const isSelected = selectedWeights[product.id] === weight || 
                            (!selectedWeights[product.id] && weight === '3.5g');
                          return (
                            <Button
                              key={weight}
                              size="sm"
                              variant={isSelected ? "default" : "outline"}
                              onClick={() => setSelectedWeights(prev => ({ ...prev, [product.id]: weight }))}
                              className="flex flex-col h-auto py-2"
                            >
                              <span className="font-bold text-xs">{weight}</span>
                              <span className="text-[10px] opacity-80">${price.toFixed(0)}</span>
                            </Button>
                          );
                        })}
                      </div>
                      <div className="text-center">
                        <span className="text-xl font-bold text-primary">
                          {getPriceDisplay(product)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-primary">
                        ${product.price.toFixed(2)}
                      </span>
                      {product.quantity_lbs && (
                        <span className="text-sm text-muted-foreground">
                          {product.quantity_lbs} lbs
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => addToCart(product)}
                      className="flex-1 relative overflow-hidden group/btn"
                      size="lg"
                    >
                      <span className="flex items-center gap-2">
                        {cartQuantity > 0 ? (
                          <>
                            <Check className="h-4 w-4" />
                            Add More
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Add to Cart
                          </>
                        )}
                      </span>
                    </Button>
                    <Button
                      onClick={() => setSelectedProduct(product)}
                      variant="outline"
                      size="lg"
                    >
                      Details
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

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

      {/* Product Details Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              {getProductImage(selectedProduct) && (
                <img
                  src={getProductImage(selectedProduct)!}
                  alt={selectedProduct.name}
                  className="w-full h-64 object-cover rounded-lg"
                />
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold text-primary">
                    ${selectedProduct.price.toFixed(2)}
                  </span>
                  {selectedProduct.category && (
                    <Badge className="capitalize">{selectedProduct.category}</Badge>
                  )}
                </div>
                {selectedProduct.description && (
                  <p className="text-muted-foreground">{selectedProduct.description}</p>
                )}
                {selectedProduct.quantity_lbs && (
                  <p className="text-sm text-muted-foreground">
                    Available: {selectedProduct.quantity_lbs} lbs
                  </p>
                )}
              </div>
              <Button
                onClick={() => {
                  addToCart(selectedProduct);
                  setSelectedProduct(null);
                }}
                className="w-full"
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Cart
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
