# Performance Optimizations - Quick Reference Guide

**Quick lookup guide for developers**

---

## 🚀 Prefetching

### Route Prefetching
```typescript
import { prefetchOnHover } from '@/lib/utils/prefetch';

<Link 
  to="/admin/orders"
  onMouseEnter={() => prefetchOnHover('/admin/orders')}
>
  Orders
</Link>
```

### Query Prefetching
```typescript
import { usePrefetch } from '@/hooks/usePrefetch';

const { prefetchQuery } = usePrefetch();

// Prefetch on hover
<div onMouseEnter={() => {
  prefetchQuery(['product', productId], () => fetchProduct(productId));
}}>
  Product Card
</div>
```

---

## 📊 Virtual Scrolling

### Enable in DataTable
```typescript
import { DataTable } from '@/components/shared/DataTable';

<DataTable
  data={largeList}
  columns={columns}
  virtualized={true}              // Enable
  virtualizedThreshold={100}      // Auto-enable if > 100 items
  virtualizedHeight={600}          // Viewport height
  virtualizedRowHeight={50}        // Row height
  pagination={false}               // Disable pagination
/>
```

### Standalone VirtualizedTable
```typescript
import { VirtualizedTable } from '@/components/shared/VirtualizedTable';

<VirtualizedTable
  columns={columns}
  data={data}
  height={600}
  rowHeight={50}
/>
```

---

## 🖼️ Image Optimization

### Optimize Single Image
```typescript
import { optimizeImage } from '@/lib/utils/image-optimization';

const url = optimizeImage(imageUrl, 800, 80, 'auto');
// width, quality, format (auto detects WebP)
```

### Responsive Images
```typescript
import { getResponsiveSrcSet } from '@/lib/utils/image-optimization';

const srcset = getResponsiveSrcSet(imageUrl, [400, 800, 1200]);

<img src={imageUrl} srcSet={srcset} sizes="(max-width: 800px) 400px, 800px" />
```

### Use Optimized Components
```typescript
import { OptimizedImage } from '@/components/OptimizedImage';

<OptimizedImage
  src={url}
  alt="Product"
  width={800}
  height={600}
  priority={false}
/>
```

---

## ⚡ Throttling

### Throttle Function
```typescript
import { useThrottle } from '@/hooks/useThrottle';

const throttledHandler = useThrottle(handleScroll, 100);
// Executes max once per 100ms
```

### Throttle Value
```typescript
import { useThrottledValue } from '@/hooks/useThrottle';

const throttledScrollY = useThrottledValue(scrollY, 100);
// Updates max once per 100ms
```

---

## 🧹 Cleanup

### General Cleanup
```typescript
import { useCleanup } from '@/hooks/useCleanup';

const { addCleanup } = useCleanup();
addCleanup('subscription', () => subscription.unsubscribe());
```

### Specific Cleanup Hooks
```typescript
import { 
  useSubscriptionCleanup,
  useIntervalCleanup,
  useEventListenerCleanup 
} from '@/hooks/useCleanup';

useSubscriptionCleanup(subscription);
useIntervalCleanup(intervalId);
useEventListenerCleanup(window, 'resize', handleResize);
```

---

## 🔄 Request Deduplication

```typescript
import { deduplicateRequest } from '@/lib/api/request-deduplication';

const data = await deduplicateRequest(
  '/api/products',
  () => fetch('/api/products').then(r => r.json()),
  'GET'
);
```

---

## 🛠️ Developer Tools

### Access
Navigate to `/admin/developer-tools`

### JWT Decoder
- Paste token or use session token buttons
- View header, payload, signature
- Check expiration status
- Copy decoded values

### URL Encoder/Decoder
- Select encoding type (URL, URL Component, Base64)
- Enter text to encode/decode
- Auto-converts on input
- Copy result

---

## 📈 Performance Tips

1. **Enable virtual scrolling** for lists with 100+ items
2. **Add prefetching** to navigation links and product cards
3. **Use optimized images** with WebP format
4. **Throttle scroll/resize handlers** to reduce re-renders
5. **Clean up subscriptions** to prevent memory leaks
6. **Use request deduplication** for frequently called APIs

---

## 🎯 Common Patterns

### Product Card with Prefetching
```typescript
const { prefetchQuery } = usePrefetch();

<Card onMouseEnter={() => {
  prefetchQuery(['product-reviews', product.id], () => 
    fetchReviews(product.id)
  );
}}>
  {/* Product content */}
</Card>
```

### Large List with Virtual Scrolling
```typescript
<DataTable
  data={orders}
  columns={orderColumns}
  virtualized={orders.length > 100}
  virtualizedHeight={600}
  pagination={false}
/>
```

### Throttled Scroll Handler
```typescript
const handleScroll = useThrottle((e: Event) => {
  // Handle scroll
}, 100);

useEffect(() => {
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, [handleScroll]);
```

---

**For detailed documentation, see `PERFORMANCE_IMPROVEMENTS_GUIDE.md`**

