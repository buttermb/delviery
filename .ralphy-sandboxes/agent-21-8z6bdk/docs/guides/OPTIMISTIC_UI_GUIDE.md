# Optimistic UI Updates Guide

## Overview
Optimistic UI updates provide immediate feedback to users by updating the interface before the server confirms the operation. If the operation fails, the UI automatically rolls back to the previous state.

## Benefits
- ⚡ **Instant Feedback** - Users see changes immediately
- 🎯 **Better UX** - No waiting for server responses
- 🔄 **Automatic Rollback** - Failed operations revert automatically
- 📱 **Offline Support** - Queue operations when offline
- 🎨 **Visual States** - Clear loading, success, and error indicators

## Core Hook: `useOptimisticUpdate`

### Basic Usage

```typescript
import { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate';

function MyComponent() {
  const { execute, isOptimistic, isLoading, error } = useOptimisticUpdate({
    successMessage: 'Saved successfully!',
    errorMessage: 'Failed to save',
  });

  const handleSave = async (formData: FormData) => {
    await execute(
      formData, // Parameters
      { ...formData, id: 'temp-123' }, // Optimistic data (shown immediately)
      async (params) => {
        // Actual operation (runs in background)
        const response = await supabase
          .from('items')
          .insert(params)
          .select()
          .single();
        return response.data;
      }
    );
  };

  return (
    <div>
      <button onClick={handleSave} disabled={isLoading}>
        {isOptimistic ? '✓ Saved!' : 'Save'}
      </button>
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

### Options

```typescript
interface OptimisticUpdateOptions<T> {
  onSuccess?: (data: T) => void;      // Called when operation succeeds
  onError?: (error: Error) => void;   // Called when operation fails
  successMessage?: string;             // Toast message on success
  errorMessage?: string;               // Toast message on error
  rollbackDelay?: number;              // Delay before rollback (default: 1000ms)
}
```

## List Operations: `useOptimisticList`

For managing lists (add, update, delete) with optimistic updates:

```typescript
import { useOptimisticList } from '@/hooks/useOptimisticUpdate';

function ProductList() {
  const {
    items,
    optimisticIds,
    addOptimistic,
    updateOptimistic,
    deleteOptimistic,
  } = useOptimisticList<Product>(initialProducts);

  const handleAdd = async (newProduct: Product) => {
    await addOptimistic(
      newProduct,
      async (item) => {
        const { data } = await supabase
          .from('products')
          .insert(item)
          .select()
          .single();
        return data;
      }
    );
  };

  const handleUpdate = async (id: string, updates: Partial<Product>) => {
    await updateOptimistic(
      id,
      updates,
      async (id, updates) => {
        const { data } = await supabase
          .from('products')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        return data;
      }
    );
  };

  const handleDelete = async (id: string) => {
    await deleteOptimistic(
      id,
      async (id) => {
        await supabase.from('products').delete().eq('id', id);
      }
    );
  };

  return (
    <div>
      {items.map((item) => (
        <div
          key={item.id}
          className={optimisticIds.has(item.id) ? 'opacity-70' : ''}
        >
          {item.name}
          <button onClick={() => handleUpdate(item.id, { name: 'New Name' })}>
            Update
          </button>
          <button onClick={() => handleDelete(item.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Pre-built Components

### OptimisticButton

Button with built-in state visualization:

```typescript
import { OptimisticButton } from '@/components/shared/OptimisticButton';

<OptimisticButton
  onClick={handleSave}
  isOptimistic={isOptimistic}
  isLoading={isLoading}
  hasError={!!error}
>
  Save Changes
</OptimisticButton>
```

**Props:**
- `isOptimistic` - Shows success state (green with checkmark)
- `isLoading` - Shows loading spinner
- `hasError` - Shows error state (red with alert icon)
- Custom icons via `successIcon`, `loadingIcon`, `errorIcon`

### OptimisticFormWrapper

Wraps forms with visual feedback:

```typescript
import { OptimisticFormWrapper } from '@/components/shared/OptimisticFormWrapper';

<OptimisticFormWrapper
  onSubmit={handleSubmit}
  isOptimistic={isOptimistic}
  isLoading={isLoading}
  hasError={!!error}
  showNetworkStatus={true}
>
  <input name="title" />
  <button type="submit">Save</button>
</OptimisticFormWrapper>
```

**Features:**
- Ring border changes color based on state
- Status badges (Saving, Saved, Error)
- Network status indicators (Offline, Slow Connection)
- Subtle overlay animations

## Real-World Example: Product Form

```typescript
import { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate';
import { OptimisticFormWrapper } from '@/components/shared/OptimisticFormWrapper';
import { OptimisticButton } from '@/components/shared/OptimisticButton';
import { supabase } from '@/integrations/supabase/client';

interface ProductFormData {
  name: string;
  price: number;
  category: string;
}

function ProductForm() {
  const { execute, isOptimistic, isLoading, error } = useOptimisticUpdate<Product>({
    successMessage: 'Product saved!',
    errorMessage: 'Failed to save product',
    onSuccess: (product) => {
      console.log('Product created:', product.id);
      // Navigate or refresh list
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const productData: ProductFormData = {
      name: formData.get('name') as string,
      price: parseFloat(formData.get('price') as string),
      category: formData.get('category') as string,
    };

    // Execute with optimistic update
    await execute(
      productData,
      {
        ...productData,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
      },
      async (params) => {
        // Actual database operation
        const { data, error } = await supabase
          .from('products')
          .insert(params)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    );
  };

  return (
    <OptimisticFormWrapper
      onSubmit={handleSubmit}
      isOptimistic={isOptimistic}
      isLoading={isLoading}
      hasError={!!error}
      className="space-y-4 p-6"
    >
      <div>
        <label>Product Name</label>
        <input
          name="name"
          type="text"
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <label>Price</label>
        <input
          name="price"
          type="number"
          step="0.01"
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <label>Category</label>
        <select name="category" required disabled={isLoading}>
          <option value="flower">Flower</option>
          <option value="edibles">Edibles</option>
          <option value="vapes">Vapes</option>
        </select>
      </div>

      <OptimisticButton
        type="submit"
        isOptimistic={isOptimistic}
        isLoading={isLoading}
        hasError={!!error}
        disabled={isLoading}
      >
        Create Product
      </OptimisticButton>
    </OptimisticFormWrapper>
  );
}
```

## Network Resilience

Optimistic updates integrate with `useNetworkStatus`:

```typescript
const { isOnline, retryWhenOnline } = useNetworkStatus();

// When offline, operations are automatically queued
await execute(
  params,
  optimisticData,
  async (params) => {
    // If offline, this is queued and will execute when connection restored
    return await saveToDatabase(params);
  }
);
```

**Offline Behavior:**
1. Show optimistic update immediately
2. Queue operation for retry
3. Show "Queued for sync" toast
4. Automatically retry when connection restored
5. Update UI with real data after sync

## Best Practices

### 1. Choose Appropriate Operations
✅ **Good for:**
- Create, update, delete operations
- Form submissions
- Toggle states
- Non-critical updates

❌ **Not good for:**
- Payment processing
- Authentication
- Operations requiring server validation
- Operations with complex side effects

### 2. Provide Rollback Data
```typescript
// ❌ Bad - no way to rollback
const optimisticData = { name: 'New Name' };

// ✅ Good - include ID and timestamp
const optimisticData = {
  id: `temp-${Date.now()}`,
  name: 'New Name',
  created_at: new Date().toISOString(),
};
```

### 3. Handle Errors Gracefully
```typescript
const { execute } = useOptimisticUpdate({
  onError: (error) => {
    // Log for debugging
    logger.error('Save failed', error);
    
    // Show user-friendly message
    if (error.message.includes('duplicate')) {
      toast.error('This item already exists');
    }
  },
});
```

### 4. Visual Feedback
Always provide clear visual states:
- Loading: Spinner or pulse animation
- Success: Green checkmark
- Error: Red alert icon
- Optimistic: Subtle opacity or border change

### 5. Disable During Operations
```typescript
<input disabled={isLoading || isOptimistic} />
<button disabled={isLoading}>Submit</button>
```

## Animation Classes

The system includes CSS animations for smooth transitions:

```css
/* In tailwind.config.ts or index.css */
@keyframes scale-in {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.animate-scale-in {
  animation: scale-in 0.2s ease-out;
}

.animate-shake {
  animation: shake 0.3s ease-in-out;
}
```

## Debugging

Enable logging for optimistic updates:

```typescript
import { logger } from '@/lib/logger';

// All optimistic operations are automatically logged:
// - "Optimistic update confirmed" on success
// - "Optimistic update failed - rolling back" on error
// - "Offline - queueing operation for retry" when offline

// Check logs in console to debug issues
```

## Testing Checklist

- [ ] Operation succeeds - UI updates immediately and stays updated
- [ ] Operation fails - UI rolls back to previous state
- [ ] Offline mode - Operation queued and retried when online
- [ ] Multiple rapid operations - Each handled independently
- [ ] Visual feedback - Loading, success, and error states visible
- [ ] Error messages - Clear and actionable
- [ ] Form validation - Works before optimistic update
- [ ] Network recovery - Queued operations sync correctly

## Status

✅ **IMPLEMENTED** - Ready to use in forms throughout the application
