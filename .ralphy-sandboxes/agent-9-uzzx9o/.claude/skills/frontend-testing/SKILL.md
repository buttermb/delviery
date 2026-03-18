---
name: frontend-testing
description: Generate Vitest + React Testing Library tests for FloraIQ components, hooks, and utilities. Use when writing tests, creating spec files, or requesting test coverage.
---

# Frontend Testing Skill

Generate comprehensive tests for FloraIQ React components using Vitest and React Testing Library.

## Tech Stack

| Tool | Purpose |
|------|---------|
| Vitest | Test runner |
| React Testing Library | Component testing |
| jsdom | Test environment |

## Key Commands

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Run specific file
npm test -- src/hooks/useProductFilters.test.ts

# Coverage report
npm test -- --coverage
```

## File Naming

- Test files: `ComponentName.test.tsx` (co-located with component)
- Hook tests: `useHookName.test.ts`

## Test Structure Template

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ComponentName } from './ComponentName';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

// Test wrapper with providers
const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // REQUIRED: Rendering tests
  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<ComponentName />, { wrapper });
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  // REQUIRED: Props tests
  describe('Props', () => {
    it('should apply custom className', () => {
      render(<ComponentName className="custom" />, { wrapper });
      expect(screen.getByRole('button')).toHaveClass('custom');
    });
  });

  // User Interactions
  describe('User Interactions', () => {
    it('should handle click events', () => {
      const handleClick = vi.fn();
      render(<ComponentName onClick={handleClick} />, { wrapper });
      
      fireEvent.click(screen.getByRole('button'));
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  // REQUIRED: Edge Cases
  describe('Edge Cases', () => {
    it('should handle null data', () => {
      render(<ComponentName data={null} />, { wrapper });
      expect(screen.getByText(/no data/i)).toBeInTheDocument();
    });

    it('should handle empty array', () => {
      render(<ComponentName items={[]} />, { wrapper });
      expect(screen.getByText(/empty/i)).toBeInTheDocument();
    });
  });
});
```

## Core Principles

### 1. AAA Pattern (Arrange-Act-Assert)
```typescript
it('should show error when submission fails', () => {
  // Arrange
  const mockSubmit = vi.fn().mockRejectedValue(new Error('Failed'));
  render(<Form onSubmit={mockSubmit} />, { wrapper });
  
  // Act
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));
  
  // Assert
  expect(screen.getByRole('alert')).toHaveTextContent(/failed/i);
});
```

### 2. Black-Box Testing
Test observable behavior, not implementation:
```typescript
// ❌ Avoid: testing internal state
expect(component.state.isLoading).toBe(true);

// ✅ Better: testing observable behavior
expect(screen.getByRole('status')).toBeInTheDocument();
```

### 3. Single Behavior Per Test
```typescript
// ✅ Good: One behavior
it('should disable button when loading', () => {
  render(<Button loading />, { wrapper });
  expect(screen.getByRole('button')).toBeDisabled();
});
```

### 4. Semantic Naming
Use `should <behavior> when <condition>`:
```typescript
it('should show error message when validation fails')
it('should call onSubmit when form is valid')
it('should disable input when isReadOnly is true')
```

## Required Test Scenarios

### Always Required
- [ ] Component renders without crashing
- [ ] Props are applied correctly
- [ ] Loading states display properly
- [ ] Error states handled gracefully
- [ ] Empty states render fallback UI

### Conditional
- [ ] Form validation (if form component)
- [ ] Navigation (if uses useNavigate)
- [ ] API calls (if fetches data)
- [ ] Permissions (if uses usePermissions)
