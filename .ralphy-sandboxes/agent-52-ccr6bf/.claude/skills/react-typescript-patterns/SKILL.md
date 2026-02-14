---
name: react-typescript-patterns
description: Modern React 19+ patterns with TypeScript including function components, hooks, state management, TanStack Query integration, form handling with Zod, error boundaries, and performance optimization.
---

# React TypeScript Patterns

Modern React development patterns for FloraIQ.

## Component Patterns

### Function Components with TypeScript

```typescript
interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: string) => void;
  className?: string;
}

export function ProductCard({ product, onAddToCart, className }: ProductCardProps) {
  return (
    <div className={cn("rounded-lg border p-4", className)}>
      <h3>{product.name}</h3>
      <p>{formatCurrency(product.price)}</p>
      {onAddToCart && (
        <Button onClick={() => onAddToCart(product.id)}>
          Add to Cart
        </Button>
      )}
    </div>
  );
}
```

### Props Interface Best Practices

```typescript
// ✅ Good: Extend HTML element props
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

// ✅ Good: Use discriminated unions for exclusive props
type ModalProps = 
  | { mode: 'create'; onSubmit: (data: FormData) => void }
  | { mode: 'edit'; initialData: FormData; onSubmit: (data: FormData) => void };
```

## Hooks Patterns

### Custom Hooks with TypeScript

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}
```

### TanStack Query with Types

```typescript
interface UseProductsOptions {
  categoryId?: string;
  enabled?: boolean;
}

export function useProducts({ categoryId, enabled = true }: UseProductsOptions = {}) {
  const { tenant } = useTenantAdminAuth();
  
  return useQuery({
    queryKey: queryKeys.products.list(tenant?.id, categoryId),
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenant!.id);
      
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
    enabled: enabled && !!tenant?.id,
  });
}
```

## Form Handling with Zod

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  price: z.number().positive('Price must be positive'),
  description: z.string().optional(),
  category_id: z.string().uuid('Invalid category'),
});

type ProductFormData = z.infer<typeof productSchema>;

export function ProductForm({ onSubmit }: { onSubmit: (data: ProductFormData) => void }) {
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      price: 0,
      description: '',
    },
  });
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Form fields */}
      </form>
    </Form>
  );
}
```

## Error Boundaries

```typescript
interface ErrorBoundaryProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('React Error Boundary caught error', { error, info });
  }
  
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
```

## Performance Optimization

### Memoization

```typescript
// ✅ Memoize expensive computations
const sortedProducts = useMemo(() => 
  products?.slice().sort((a, b) => a.name.localeCompare(b.name)),
  [products]
);

// ✅ Memoize callbacks passed to children
const handleSelect = useCallback((id: string) => {
  setSelected(id);
}, []);

// ✅ Memoize components that receive complex props
const MemoizedProductCard = memo(ProductCard);
```

### Lazy Loading

```typescript
const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  );
}
```
