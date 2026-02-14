---
name: test-driven-development
description: Use when implementing any feature or bugfix. Write tests first, then implementation. Ensures code correctness and documentation.
---

# Test-Driven Development Skill

Follow the Red-Green-Refactor cycle for all implementations.

## The TDD Cycle

```
┌─────────────────────────────────────┐
│  1. RED: Write failing test         │
│  ↓                                  │
│  2. GREEN: Minimal code to pass     │
│  ↓                                  │
│  3. REFACTOR: Improve code quality  │
│  ↓                                  │
│  Back to step 1                     │
└─────────────────────────────────────┘
```

## Step 1: RED - Write Failing Test

Before writing any implementation:

```typescript
// src/hooks/useProductFilters.test.ts
import { renderHook } from '@testing-library/react';
import { useProductFilters } from './useProductFilters';

describe('useProductFilters', () => {
  it('filters products by category', () => {
    const { result } = renderHook(() => useProductFilters(products));
    
    result.current.setCategory('edibles');
    
    expect(result.current.filtered).toEqual([
      expect.objectContaining({ category: 'edibles' })
    ]);
  });
  
  it('returns all products when no filter set', () => {
    const { result } = renderHook(() => useProductFilters(products));
    expect(result.current.filtered).toHaveLength(products.length);
  });
});
```

Run: `npm test -- useProductFilters` → Should FAIL (Red)

## Step 2: GREEN - Minimal Implementation

Write just enough code to make tests pass:

```typescript
// src/hooks/useProductFilters.ts
export function useProductFilters(products: Product[]) {
  const [category, setCategory] = useState<string | null>(null);
  
  const filtered = useMemo(() => {
    if (!category) return products;
    return products.filter(p => p.category === category);
  }, [products, category]);
  
  return { filtered, setCategory };
}
```

Run: `npm test -- useProductFilters` → Should PASS (Green)

## Step 3: REFACTOR

Improve without changing behavior:
- Extract helper functions
- Add type safety
- Improve naming
- Optimize performance

Run tests after each refactor to ensure they still pass.

## When to Apply TDD

✅ New feature implementations
✅ Bug fixes (write test that reproduces bug first)
✅ Refactoring critical paths
✅ Complex business logic

## Test File Locations

```
src/
├── hooks/
│   ├── useProductFilters.ts
│   └── useProductFilters.test.ts  # Co-located
├── utils/
│   ├── formatCurrency.ts
│   └── formatCurrency.test.ts
└── components/
    ├── ProductCard/
    │   ├── ProductCard.tsx
    │   └── ProductCard.test.tsx
```

## Running Tests

```bash
# All tests
npm test

# Specific file
npm test -- useProductFilters

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

## Commit Pattern

1. Commit failing test: `test: add failing test for product filters`
2. Commit passing implementation: `feat: implement product filters`
3. Commit refactor: `refactor: extract filter logic to utility`
