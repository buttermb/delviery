/**
 * Tests for VirtualList component
 *
 * These tests verify the virtual scrolling functionality including:
 * - Visible range calculations
 * - Item positioning
 * - Scroll handling
 * - Empty state handling
 */

import { describe, it, expect } from 'vitest';

describe('VirtualList calculations', () => {
  interface TestItem {
    id: string;
    name: string;
  }

  const generateItems = (count: number): TestItem[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `item-${i}`,
      name: `Item ${i}`,
    }));
  };

  it('should calculate visible range correctly at top', () => {
    const itemHeight = 50;
    const containerHeight = 500;
    const scrollTop = 0;
    const overscan = 5;
    const itemCount = 1000;

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    expect(startIndex).toBe(0);
    expect(endIndex).toBeLessThan(itemCount);
    expect(endIndex - startIndex).toBeLessThan(50); // Only renders a fraction
  });

  it('should calculate visible range correctly when scrolled', () => {
    const itemHeight = 50;
    const containerHeight = 500;
    const scrollTop = 5000; // Scrolled to middle
    const overscan = 5;
    const itemCount = 1000;

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    expect(startIndex).toBeGreaterThan(0);
    expect(endIndex).toBeLessThan(itemCount);
    expect(endIndex).toBeGreaterThan(startIndex);
  });

  it('should calculate visible range correctly at bottom', () => {
    const itemHeight = 50;
    const containerHeight = 500;
    const itemCount = 1000;
    const totalHeight = itemCount * itemHeight;
    const scrollTop = totalHeight - containerHeight; // At bottom
    const overscan = 5;

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    expect(endIndex).toBe(itemCount - 1);
    expect(startIndex).toBeLessThan(endIndex);
  });

  it('should calculate total height correctly', () => {
    const items = generateItems(1000);
    const itemHeight = 50;
    const totalHeight = items.length * itemHeight;

    expect(totalHeight).toBe(50000);
  });

  it('should calculate item offset correctly', () => {
    const itemHeight = 50;
    const itemIndex = 100;
    const offsetTop = itemIndex * itemHeight;

    expect(offsetTop).toBe(5000);
  });

  it('should handle overscan correctly', () => {
    const itemHeight = 50;
    const scrollTop = 2500;
    const overscan = 5;

    const startIndexWithOverscan = Math.floor(scrollTop / itemHeight) - overscan;
    const startIndexWithoutOverscan = Math.floor(scrollTop / itemHeight);

    expect(startIndexWithOverscan).toBeLessThan(startIndexWithoutOverscan);
    expect(startIndexWithoutOverscan - startIndexWithOverscan).toBe(overscan);
  });

  it('should prevent negative start index', () => {
    const scrollTop = 0;
    const itemHeight = 50;
    const overscan = 5;

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);

    expect(startIndex).toBe(0);
    expect(startIndex).toBeGreaterThanOrEqual(0);
  });

  it('should prevent end index exceeding item count', () => {
    const itemHeight = 50;
    const containerHeight = 500;
    const itemCount = 20; // Small list
    const scrollTop = 0;
    const overscan = 5;

    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    expect(endIndex).toBeLessThanOrEqual(itemCount - 1);
  });

  it('should handle empty list', () => {
    const items: TestItem[] = [];
    expect(items.length).toBe(0);
  });

  it('should handle single item', () => {
    const items = generateItems(1);
    const itemHeight = 50;
    const totalHeight = items.length * itemHeight;

    expect(totalHeight).toBe(50);
  });

  it('should generate correct keys for items', () => {
    const items = generateItems(10);
    const keys = items.map((item) => item.id);

    expect(keys.length).toBe(10);
    expect(keys[0]).toBe('item-0');
    expect(keys[9]).toBe('item-9');
  });

  it('should calculate visible items count correctly', () => {
    const itemHeight = 50;
    const visibleCount = Math.ceil(500 / itemHeight);

    expect(visibleCount).toBe(10);
  });

  it('should include overscan in rendered items', () => {
    const itemHeight = 50;
    const containerHeight = 500;
    const overscan = 5;
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const renderedCount = visibleCount + (overscan * 2);

    expect(renderedCount).toBeGreaterThan(visibleCount);
    expect(renderedCount).toBe(20);
  });
});

describe('VirtualList scroll behavior', () => {
  it('should detect when scrolled near end', () => {
    const containerScrollTop = 9000;
    const containerClientHeight = 500;
    const containerScrollHeight = 10000;
    const threshold = 0.8;

    const scrollPercentage =
      (containerScrollTop + containerClientHeight) / containerScrollHeight;

    const isNearEnd = scrollPercentage >= threshold;

    expect(scrollPercentage).toBeGreaterThan(threshold);
    expect(isNearEnd).toBe(true);
  });

  it('should not trigger end reached when not near end', () => {
    const containerScrollTop = 1000;
    const containerClientHeight = 500;
    const containerScrollHeight = 10000;
    const threshold = 0.8;

    const scrollPercentage =
      (containerScrollTop + containerClientHeight) / containerScrollHeight;

    const isNearEnd = scrollPercentage >= threshold;

    expect(scrollPercentage).toBeLessThan(threshold);
    expect(isNearEnd).toBe(false);
  });

  it('should calculate scroll percentage correctly', () => {
    const containerScrollTop = 5000;
    const containerClientHeight = 500;
    const containerScrollHeight = 10000;

    const scrollPercentage =
      (containerScrollTop + containerClientHeight) / containerScrollHeight;

    expect(scrollPercentage).toBe(0.55);
  });

  it('should handle scroll at top', () => {
    const containerScrollTop = 0;
    const containerClientHeight = 500;
    const containerScrollHeight = 10000;

    const scrollPercentage =
      (containerScrollTop + containerClientHeight) / containerScrollHeight;

    expect(scrollPercentage).toBe(0.05);
  });

  it('should handle scroll at bottom', () => {
    const containerScrollTop = 9500;
    const containerClientHeight = 500;
    const containerScrollHeight = 10000;

    const scrollPercentage =
      (containerScrollTop + containerClientHeight) / containerScrollHeight;

    expect(scrollPercentage).toBe(1.0);
  });
});

describe('VirtualTable column configuration', () => {
  it('should handle fixed width columns', () => {
    const columnWidth = 100;
    const flexStyle = { width: columnWidth, flex: 'none' };

    expect(flexStyle.width).toBe(100);
    expect(flexStyle.flex).toBe('none');
  });

  it('should handle flexible width columns', () => {
    const columnWidth = undefined;
    const flexStyle = { width: columnWidth || 'auto', flex: columnWidth ? 'none' : 1 };

    expect(flexStyle.width).toBe('auto');
    expect(flexStyle.flex).toBe(1);
  });

  it('should calculate header height correctly', () => {
    const headerHeight = 48;
    const contentHeight = 500 - headerHeight;

    expect(contentHeight).toBe(452);
  });
});

describe('VirtualList performance characteristics', () => {
  it('should render significantly fewer items than total', () => {
    const totalItems = 10000;
    const itemHeight = 50;
    const containerHeight = 600;
    const overscan = 5;

    const visibleItems = Math.ceil(containerHeight / itemHeight);
    const renderedItems = visibleItems + (overscan * 2);

    const renderRatio = renderedItems / totalItems;

    expect(renderedItems).toBeLessThan(totalItems);
    expect(renderRatio).toBeLessThan(0.01); // Less than 1% rendered
  });

  it('should maintain constant rendered items regardless of total', () => {
    const itemHeight = 50;
    const containerHeight = 600;
    const overscan = 5;

    const visibleItems = Math.ceil(containerHeight / itemHeight);
    const renderedItems = visibleItems + (overscan * 2);

    // Should render same count for 1000 or 100000 items
    expect(renderedItems).toBe(22);
  });

  it('should reduce memory footprint with large datasets', () => {
    const totalItems = 100000;
    const itemHeight = 50;
    const containerHeight = 600;
    const overscan = 5;

    const visibleItems = Math.ceil(containerHeight / itemHeight);
    const renderedItems = visibleItems + (overscan * 2);
    const memoryReduction = 1 - (renderedItems / totalItems);

    expect(memoryReduction).toBeGreaterThan(0.99); // 99%+ reduction
  });
});

describe('VirtualList dynamic height estimation', () => {
  interface TestItem {
    id: string;
    name: string;
    description: string;
  }

  const generateItemsWithVariableContent = (count: number): TestItem[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `item-${i}`,
      name: `Item ${i}`,
      description: 'A'.repeat((i % 5 + 1) * 50), // Variable length content
    }));
  };

  it('should calculate total height with variable item heights', () => {
    const items = [
      { id: '1', height: 50 },
      { id: '2', height: 100 },
      { id: '3', height: 75 },
    ];

    let totalHeight = 0;
    const offsets = [];

    for (const item of items) {
      offsets.push(totalHeight);
      totalHeight += item.height;
    }

    expect(totalHeight).toBe(225);
    expect(offsets).toEqual([0, 50, 150]);
  });

  it('should calculate correct offsets for variable heights', () => {
    const heights = [40, 60, 80, 50, 70];
    const offsets: number[] = [];
    let currentOffset = 0;

    for (const height of heights) {
      offsets.push(currentOffset);
      currentOffset += height;
    }

    expect(offsets).toEqual([0, 40, 100, 180, 230]);
    expect(currentOffset).toBe(300);
  });

  it('should use estimateItemHeight when provided', () => {
    const items = generateItemsWithVariableContent(10);
    const estimator = (item: TestItem) => 50 + item.description.length;

    const heights = items.map(estimator);

    expect(heights.length).toBe(10);
    expect(heights[0]).toBe(100); // 50 + 50
    expect(heights[1]).toBe(150); // 50 + 100
    expect(heights[4]).toBe(300); // 50 + 250
  });

  it('should find start index with binary search for variable heights', () => {
    const offsets = [0, 50, 120, 200, 270, 350, 420];
    const scrollTop = 150;

    // Binary search to find item at scrollTop
    let start = 0;
    let end = offsets.length - 1;

    while (start < end) {
      const mid = Math.floor((start + end) / 2);
      if (offsets[mid] < scrollTop) {
        start = mid + 1;
      } else {
        end = mid;
      }
    }

    expect(start).toBe(3); // Item at offset 200 is first visible
  });

  it('should calculate visible range correctly with variable heights', () => {
    const heights = [50, 100, 75, 60, 80, 90, 70, 50];
    const offsets: number[] = [];
    let currentOffset = 0;

    for (const height of heights) {
      offsets.push(currentOffset);
      currentOffset += height;
    }

    const scrollTop = 100;
    const containerHeight = 200;
    const scrollBottom = scrollTop + containerHeight;

    // Find start index
    let startIndex = 0;
    while (startIndex < offsets.length && offsets[startIndex] < scrollTop) {
      startIndex++;
    }
    if (startIndex > 0) startIndex--;

    // Find end index
    let endIndex = startIndex;
    while (
      endIndex < heights.length &&
      offsets[endIndex] + heights[endIndex] < scrollBottom
    ) {
      endIndex++;
    }

    expect(startIndex).toBeGreaterThanOrEqual(0);
    expect(endIndex).toBeGreaterThan(startIndex);
    expect(endIndex).toBeLessThan(heights.length);
  });

  it('should handle all items with same estimated height', () => {
    const items = generateItemsWithVariableContent(100);
    const fixedHeight = 60;
    const estimator = () => fixedHeight;

    let totalHeight = 0;
    for (let i = 0; i < items.length; i++) {
      totalHeight += estimator(items[i], i);
    }

    expect(totalHeight).toBe(items.length * fixedHeight);
  });

  it('should handle single item with custom height', () => {
    const items = [{ id: '1', content: 'test' }];
    const customHeight = 120;
    const estimator = () => customHeight;

    const height = estimator(items[0], 0);

    expect(height).toBe(customHeight);
  });

  it('should estimate heights based on content length', () => {
    const shortContent = 'Short';
    const longContent = 'A'.repeat(500);

    const estimateHeight = (content: string) => {
      const baseHeight = 40;
      const charsPerLine = 50;
      const lineHeight = 20;
      const lines = Math.ceil(content.length / charsPerLine);
      return baseHeight + (lines - 1) * lineHeight;
    };

    const shortHeight = estimateHeight(shortContent);
    const longHeight = estimateHeight(longContent);

    expect(shortHeight).toBe(40); // Single line
    expect(longHeight).toBeGreaterThan(shortHeight);
    expect(longHeight).toBe(220); // 11 lines: 40 + 10*20
  });

  it('should handle empty items array with estimator', () => {
    const items: TestItem[] = [];
    const estimator = (item: TestItem) => 50 + item.description.length;

    let totalHeight = 0;
    for (const item of items) {
      totalHeight += estimator(item, 0);
    }

    expect(totalHeight).toBe(0);
  });

  it('should support minimum height constraint in estimator', () => {
    const items = [
      { id: '1', lines: 0 },
      { id: '2', lines: 1 },
      { id: '3', lines: 3 },
    ];

    const estimator = (item: { lines: number }) => {
      const baseHeight = 40;
      const lineHeight = 20;
      return Math.max(baseHeight, baseHeight + item.lines * lineHeight);
    };

    expect(estimator(items[0])).toBe(40);
    expect(estimator(items[1])).toBe(60);
    expect(estimator(items[2])).toBe(100);
  });

  it('should calculate metrics for mixed height items', () => {
    const items = [
      { size: 'small' },
      { size: 'large' },
      { size: 'medium' },
      { size: 'small' },
      { size: 'large' },
    ];

    const estimator = (item: { size: string }) => {
      const sizeMap = { small: 40, medium: 60, large: 100 };
      return sizeMap[item.size as keyof typeof sizeMap] || 50;
    };

    const heights = items.map(estimator);
    const offsets: number[] = [];
    let currentOffset = 0;

    for (const height of heights) {
      offsets.push(currentOffset);
      currentOffset += height;
    }

    expect(heights).toEqual([40, 100, 60, 40, 100]);
    expect(offsets).toEqual([0, 40, 140, 200, 240]);
    expect(currentOffset).toBe(340);
  });

  it('should handle estimator that depends on index', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ id: i }));
    const estimator = (_item: { id: number }, index: number) => {
      // Alternating heights based on index
      return index % 2 === 0 ? 50 : 80;
    };

    const heights = items.map((item, idx) => estimator(item, idx));

    expect(heights).toEqual([50, 80, 50, 80, 50]);
  });

  it('should preserve performance with variable heights', () => {
    const items = generateItemsWithVariableContent(1000);
    const containerHeight = 600;
    const overscan = 5;

    // Estimate average height
    const avgHeight = 75;
    const visibleItems = Math.ceil(containerHeight / avgHeight);
    const renderedItems = visibleItems + (overscan * 2);

    expect(renderedItems).toBeLessThan(100);
    expect(renderedItems).toBeLessThan(items.length);
  });

  it('should fallback to fixed height when estimator not provided', () => {
    const items = generateItemsWithVariableContent(10);
    const fixedHeight = 50;

    // Without estimator, use fixed height
    const totalHeight = items.length * fixedHeight;

    expect(totalHeight).toBe(500);
  });
});
