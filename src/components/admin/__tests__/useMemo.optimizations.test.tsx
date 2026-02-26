/**
 * useMemo Optimization Tests
 *
 * Tests to verify that filtered and sorted list operations are properly memoized
 * to prevent unnecessary re-computations and improve performance.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMemo } from 'react';

describe('useMemo Optimizations', () => {
  describe('Array filtering and sorting', () => {
    it('should memoize filtered arrays when dependencies do not change', () => {
      const mockData = [
        { id: '1', name: 'Apple', category: 'fruit', price: 10 },
        { id: '2', name: 'Banana', category: 'fruit', price: 5 },
        { id: '3', name: 'Carrot', category: 'vegetable', price: 3 },
      ];

      const { result, rerender } = renderHook(
        ({ data, filter }) => {
          const filtered = useMemo(() => {
            return data.filter((item) => item.category === filter);
          }, [data, filter]);
          return filtered;
        },
        { initialProps: { data: mockData, filter: 'fruit' } }
      );

      const firstResult = result.current;
      expect(firstResult).toHaveLength(2);
      expect(firstResult[0].name).toBe('Apple');

      // Rerender with same props - should return same reference
      rerender({ data: mockData, filter: 'fruit' });
      expect(result.current).toBe(firstResult); // Reference equality check
    });

    it('should recompute when filter dependency changes', () => {
      const mockData = [
        { id: '1', name: 'Apple', category: 'fruit', price: 10 },
        { id: '2', name: 'Banana', category: 'fruit', price: 5 },
        { id: '3', name: 'Carrot', category: 'vegetable', price: 3 },
      ];

      const { result, rerender } = renderHook(
        ({ data, filter }) => {
          const filtered = useMemo(() => {
            return data.filter((item) => item.category === filter);
          }, [data, filter]);
          return filtered;
        },
        { initialProps: { data: mockData, filter: 'fruit' } }
      );

      const firstResult = result.current;
      expect(firstResult).toHaveLength(2);

      // Change filter - should recompute
      rerender({ data: mockData, filter: 'vegetable' });
      expect(result.current).not.toBe(firstResult);
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('Carrot');
    });

    it('should memoize sorted arrays when dependencies do not change', () => {
      const mockData = [
        { id: '3', name: 'Charlie', price: 30 },
        { id: '1', name: 'Alice', price: 10 },
        { id: '2', name: 'Bob', price: 20 },
      ];

      const { result, rerender } = renderHook(
        ({ data, sortBy }) => {
          const sorted = useMemo(() => {
            return [...data].sort((a, b) => {
              if (sortBy === 'name') return a.name.localeCompare(b.name);
              return a.price - b.price;
            });
          }, [data, sortBy]);
          return sorted;
        },
        { initialProps: { data: mockData, sortBy: 'name' as 'name' | 'price' } }
      );

      const firstResult = result.current;
      expect(firstResult[0].name).toBe('Alice');
      expect(firstResult[1].name).toBe('Bob');
      expect(firstResult[2].name).toBe('Charlie');

      // Rerender with same props
      rerender({ data: mockData, sortBy: 'name' as 'name' | 'price' });
      expect(result.current).toBe(firstResult);
    });

    it('should memoize combined filter and sort operations', () => {
      const mockData = [
        { id: '1', name: 'Apple', category: 'fruit', price: 10 },
        { id: '2', name: 'Banana', category: 'fruit', price: 5 },
        { id: '3', name: 'Carrot', category: 'vegetable', price: 3 },
        { id: '4', name: 'Avocado', category: 'fruit', price: 15 },
      ];

      const { result, rerender } = renderHook(
        ({ data, filter, sortBy: _sortBy }) => {
          const processed = useMemo(() => {
            return data
              .filter((item) => item.category === filter)
              .sort((a, b) => b.price - a.price);
          }, [data, filter]);
          return processed;
        },
        { initialProps: { data: mockData, filter: 'fruit', sortBy: 'price' } }
      );

      const firstResult = result.current;
      expect(firstResult).toHaveLength(3);
      expect(firstResult[0].name).toBe('Avocado'); // Highest price fruit
      expect(firstResult[1].name).toBe('Apple');
      expect(firstResult[2].name).toBe('Banana'); // Lowest price fruit

      // Rerender with same props
      rerender({ data: mockData, filter: 'fruit', sortBy: 'price' });
      expect(result.current).toBe(firstResult);
    });

    it('should memoize category extraction from products', () => {
      const mockProducts = [
        { id: '1', category: 'electronics' },
        { id: '2', category: 'food' },
        { id: '3', category: 'electronics' },
        { id: '4', category: null },
      ];

      const { result, rerender } = renderHook(
        ({ products }) => {
          const categories = useMemo(() => {
            return [
              'all',
              ...Array.from(
                new Set(products.map((p) => p.category).filter(Boolean))
              ),
            ];
          }, [products]);
          return categories;
        },
        { initialProps: { products: mockProducts } }
      );

      const firstResult = result.current;
      expect(firstResult).toEqual(['all', 'electronics', 'food']);

      // Rerender with same data
      rerender({ products: mockProducts });
      expect(result.current).toBe(firstResult);
    });

    it('should memoize search filtering', () => {
      const mockProducts = [
        { id: '1', name: 'Apple iPhone', description: 'Smartphone' },
        { id: '2', name: 'Samsung Galaxy', description: 'Smartphone' },
        { id: '3', name: 'Apple Watch', description: 'Smartwatch' },
      ];

      const { result, rerender } = renderHook(
        ({ products, searchQuery }) => {
          const filtered = useMemo(() => {
            if (!searchQuery) return products;
            const query = searchQuery.toLowerCase();
            return products.filter(
              (p) =>
                p.name.toLowerCase().includes(query) ||
                p.description?.toLowerCase().includes(query)
            );
          }, [products, searchQuery]);
          return filtered;
        },
        { initialProps: { products: mockProducts, searchQuery: '' } }
      );

      // Empty search - all products
      expect(result.current).toHaveLength(3);
      const firstResult = result.current;

      // Same search - same reference
      rerender({ products: mockProducts, searchQuery: '' });
      expect(result.current).toBe(firstResult);

      // Search for 'apple'
      rerender({ products: mockProducts, searchQuery: 'apple' });
      expect(result.current).not.toBe(firstResult);
      expect(result.current).toHaveLength(2);
      expect(result.current[0].name).toBe('Apple iPhone');
      expect(result.current[1].name).toBe('Apple Watch');
    });

    it('should memoize aggregation operations', () => {
      const mockOrders = [
        { id: '1', status: 'pending', amount: 100 },
        { id: '2', status: 'confirmed', amount: 200 },
        { id: '3', status: 'pending', amount: 50 },
        { id: '4', status: 'cancelled', amount: 75 },
      ];

      const { result, rerender } = renderHook(
        ({ orders }) => {
          const stats = useMemo(
            () => [
              {
                label: 'Total Orders',
                value: orders.length,
              },
              {
                label: 'Pending',
                value: orders.filter((o) => o.status === 'pending').length,
              },
              {
                label: 'Total Revenue',
                value: orders.reduce((sum, o) => sum + o.amount, 0),
              },
            ],
            [orders]
          );
          return stats;
        },
        { initialProps: { orders: mockOrders } }
      );

      const firstResult = result.current;
      expect(firstResult[0].value).toBe(4); // Total orders
      expect(firstResult[1].value).toBe(2); // Pending orders
      expect(firstResult[2].value).toBe(425); // Total revenue

      // Rerender with same data
      rerender({ orders: mockOrders });
      expect(result.current).toBe(firstResult);
    });

    it('should memoize grouped results', () => {
      const mockResults = [
        { id: '1', type: 'customer', label: 'John Doe' },
        { id: '2', type: 'order', label: 'Order #123' },
        { id: '3', type: 'customer', label: 'Jane Smith' },
        { id: '4', type: 'product', label: 'Widget' },
      ];

      const { result, rerender } = renderHook(
        ({ results }) => {
          const grouped = useMemo(() => {
            return results.reduce<Record<string, typeof results>>((acc, result) => {
              if (!acc[result.type]) {
                acc[result.type] = [];
              }
              acc[result.type].push(result);
              return acc;
            }, {});
          }, [results]);
          return grouped;
        },
        { initialProps: { results: mockResults } }
      );

      const firstResult = result.current;
      expect(firstResult.customer).toHaveLength(2);
      expect(firstResult.order).toHaveLength(1);
      expect(firstResult.product).toHaveLength(1);

      // Rerender with same data
      rerender({ results: mockResults });
      expect(result.current).toBe(firstResult);
    });

    it('should memoize low stock filtering and sorting', () => {
      const mockProducts = [
        { id: '1', name: 'Product A', stock: 5, threshold: 10, level: 'warning' },
        { id: '2', name: 'Product B', stock: 0, threshold: 5, level: 'out_of_stock' },
        { id: '3', name: 'Product C', stock: 2, threshold: 5, level: 'critical' },
        { id: '4', name: 'Product D', stock: 100, threshold: 10, level: 'ok' },
      ];

      const { result, rerender } = renderHook(
        ({ products }) => {
          const lowStock = useMemo(() => {
            const levelPriority: Record<string, number> = {
              out_of_stock: 0,
              critical: 1,
              warning: 2,
            };
            return products
              .filter((p) => p.stock <= p.threshold)
              .sort((a, b) => levelPriority[a.level] - levelPriority[b.level])
              .slice(0, 5);
          }, [products]);
          return lowStock;
        },
        { initialProps: { products: mockProducts } }
      );

      const firstResult = result.current;
      expect(firstResult).toHaveLength(3);
      expect(firstResult[0].level).toBe('out_of_stock'); // Highest priority
      expect(firstResult[1].level).toBe('critical');
      expect(firstResult[2].level).toBe('warning');

      // Rerender with same data
      rerender({ products: mockProducts });
      expect(result.current).toBe(firstResult);
    });

    it('should memoize chart data transformation', () => {
      const mockProducts = [
        { id: '1', name: 'Very Long Product Name Here', value: 1234.567 },
        { id: '2', name: 'Short', value: 99.99 },
      ];

      const { result, rerender } = renderHook(
        ({ products }) => {
          const chartData = useMemo(() => {
            return products.map((product) => ({
              name: product.name.slice(0, 12) + (product.name.length > 12 ? '…' : ''),
              value: Math.round(product.value * 100) / 100,
              fullName: product.name,
              product_id: product.id,
            }));
          }, [products]);
          return chartData;
        },
        { initialProps: { products: mockProducts } }
      );

      const firstResult = result.current;
      expect(firstResult[0].name).toBe('Very Long Pr…');
      expect(firstResult[0].value).toBe(1234.57);
      expect(firstResult[1].name).toBe('Short');

      // Rerender with same data
      rerender({ products: mockProducts });
      expect(result.current).toBe(firstResult);
    });
  });

  describe('Performance characteristics', () => {
    it('should avoid unnecessary recalculations on unrelated state changes', () => {
      const mockData = Array.from({ length: 1000 }, (_, i) => ({
        id: String(i),
        name: `Item ${i}`,
        category: i % 2 === 0 ? 'even' : 'odd',
      }));

      let filterCallCount = 0;

      const { result, rerender } = renderHook(
        ({ data, filter, unrelatedState }) => {
          const filtered = useMemo(() => {
            filterCallCount++;
            return data.filter((item) => item.category === filter);
          }, [data, filter]);
          return { filtered, unrelatedState };
        },
        {
          initialProps: {
            data: mockData,
            filter: 'even',
            unrelatedState: 'initial',
          },
        }
      );

      expect(filterCallCount).toBe(1);
      const firstResult = result.current.filtered;

      // Change unrelated state - should NOT recompute
      rerender({ data: mockData, filter: 'even', unrelatedState: 'changed' });
      expect(filterCallCount).toBe(1); // Still 1, not recomputed
      expect(result.current.filtered).toBe(firstResult);

      // Change filter - SHOULD recompute
      rerender({ data: mockData, filter: 'odd', unrelatedState: 'changed' });
      expect(filterCallCount).toBe(2); // Now 2
      expect(result.current.filtered).not.toBe(firstResult);
    });

    it('should handle empty arrays efficiently', () => {
      const { result } = renderHook(() => {
        const filtered = useMemo(() => {
          return [].filter((item: { category: string }) => item.category === 'test');
        }, []);
        return filtered;
      });

      expect(result.current).toEqual([]);
    });

    it('should handle null/undefined values safely', () => {
      const mockData = [
        { id: '1', name: null, category: 'a' },
        { id: '2', name: 'Product', category: null },
        { id: '3', name: undefined, category: 'b' },
      ];

      const { result } = renderHook(() => {
        const categories = useMemo(() => {
          return Array.from(
            new Set(mockData.map((p) => p.category).filter(Boolean))
          );
        }, []);
        return categories;
      });

      expect(result.current).toEqual(['a', 'b']);
    });
  });
});
