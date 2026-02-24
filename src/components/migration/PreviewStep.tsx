import { useState, useMemo } from 'react';
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
  Search,
  Filter,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';
import type { ParsedProduct, QualityTier } from '@/types/migration';
import { EditableCell } from './EditableCell';
import { ConfidenceBar } from './ConfidenceBar';
import { formatCurrency } from '@/lib/formatters';

interface PreviewStepProps {
  products: ParsedProduct[];
  onUpdateProduct: (index: number, updates: Partial<ParsedProduct>) => void;
  onRemoveProduct: (index: number) => void;
  onStartImport: () => void;
  onBack: () => void;
}

const CATEGORIES: string[] = [
  'flower', 'preroll', 'concentrate', 'edible', 'vape', 
  'tincture', 'topical', 'accessory', 'other'
];

const STRAIN_TYPES: string[] = ['indica', 'sativa', 'hybrid', 'cbd'];

const QUALITY_TIERS: QualityTier[] = ['exotic', 'indoor', 'greenhouse', 'outdoor', 'mixed_light'];

export function PreviewStep({ 
  products, 
  onUpdateProduct, 
  onRemoveProduct,
  onStartImport,
  onBack,
}: PreviewStepProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [editingCell, setEditingCell] = useState<{ index: number; field: string } | null>(null);

  // Filter products and preserve original index
  const filteredProducts = useMemo(() => {
    return products
      .map((product, index) => ({ product, originalIndex: index }))
      .filter(({ product }) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (!product.name.toLowerCase().includes(query)) {
            return false;
          }
        }
        
        // Category filter
        if (categoryFilter !== 'all' && product.category !== categoryFilter) {
          return false;
        }
        
        // Issues filter
        if (showIssuesOnly) {
          const hasIssue = 
            (product.thcPercentage && product.thcPercentage > 35) ||
            !product.name ||
            !product.category;
          if (!hasIssue) return false;
        }
        
        return true;
      });
  }, [products, searchQuery, categoryFilter, showIssuesOnly]);

  const stats = useMemo(() => {
    const total = products.length;
    const withIssues = products.filter(p => 
      (p.thcPercentage && p.thcPercentage > 35) ||
      !p.name ||
      !p.category
    ).length;
    const categories = [...new Set(products.map(p => p.category))].filter(Boolean);
    
    return { total, withIssues, categories: categories.length };
  }, [products]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Review Products</h3>
          <p className="text-sm text-muted-foreground">
            {stats.total} products found • {stats.categories} categories • {stats.withIssues} with issues
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button onClick={onStartImport} className="gap-2">
            <Download className="h-4 w-4" />
            Import {filteredProducts.length} Products
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            aria-label="Search products"
          />
        </div>
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={showIssuesOnly ? 'default' : 'outline'}
          onClick={() => setShowIssuesOnly(!showIssuesOnly)}
          className="gap-2"
        >
          <AlertTriangle className="h-4 w-4" />
          Issues Only
          {stats.withIssues > 0 && (
            <Badge variant="destructive" className="ml-1">
              {stats.withIssues}
            </Badge>
          )}
        </Button>
      </div>

      {/* Products Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Product Name</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Category</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Strain</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">THC %</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Quality</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Price</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Confidence</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(({ product, originalIndex }) => {
                const hasIssue = 
                  (product.thcPercentage && product.thcPercentage > 35) ||
                  !product.name ||
                  !product.category;
                
                return (
                  <tr 
                    key={originalIndex} 
                    className={`border-t hover:bg-muted/30 transition-colors ${
                      hasIssue ? 'bg-yellow-500/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      {hasIssue ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      )}
                    </td>
                    
                    <td className="px-4 py-3">
                      <EditableCell
                        value={product.name}
                        isEditing={editingCell?.index === originalIndex && editingCell?.field === 'name'}
                        onEdit={() => setEditingCell({ index: originalIndex, field: 'name' })}
                        onSave={(value) => {
                          onUpdateProduct(originalIndex, { name: value });
                          setEditingCell(null);
                        }}
                        onCancel={() => setEditingCell(null)}
                      />
                    </td>
                    
                    <td className="px-4 py-3">
                      <Select
                        value={product.category || ''}
                        onValueChange={(value) => 
                          onUpdateProduct(originalIndex, { category: value as ParsedProduct['category'] })
                        }
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>
                              {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    
                    <td className="px-4 py-3">
                      <Select
                        value={product.strainType || ''}
                        onValueChange={(value) => 
                          onUpdateProduct(originalIndex, { strainType: value as ParsedProduct['strainType'] })
                        }
                      >
                        <SelectTrigger className="w-[100px] h-8">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {STRAIN_TYPES.map(type => (
                            <SelectItem key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    
                    <td className="px-4 py-3">
                      <EditableCell
                        value={product.thcPercentage?.toString() || ''}
                        isEditing={editingCell?.index === originalIndex && editingCell?.field === 'thc'}
                        onEdit={() => setEditingCell({ index: originalIndex, field: 'thc' })}
                        onSave={(value) => {
                          onUpdateProduct(originalIndex, { thcPercentage: parseFloat(value) || undefined });
                          setEditingCell(null);
                        }}
                        onCancel={() => setEditingCell(null)}
                        suffix="%"
                        className={product.thcPercentage && product.thcPercentage > 35 ? 'text-yellow-600' : ''}
                      />
                    </td>
                    
                    <td className="px-4 py-3">
                      <Select
                        value={product.qualityTier || ''}
                        onValueChange={(value) => 
                          onUpdateProduct(originalIndex, { qualityTier: value as ParsedProduct['qualityTier'] })
                        }
                      >
                        <SelectTrigger className="w-[110px] h-8">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {QUALITY_TIERS.map(tier => (
                            <SelectItem key={tier} value={tier}>
                              {tier.charAt(0).toUpperCase() + tier.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    
                    <td className="px-4 py-3">
                      {product.prices?.lb
                        ? `${formatCurrency(product.prices.lb)}/lb`
                        : product.prices?.oz
                          ? `${formatCurrency(product.prices.oz)}/oz`
                          : '-'
                      }
                    </td>
                    
                    <td className="px-4 py-3">
                      <ConfidenceBar score={product.confidence || 0} />
                    </td>
                    
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveProduct(originalIndex)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredProducts.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            No products match your filters
          </div>
        )}
      </div>
    </div>
  );
}

