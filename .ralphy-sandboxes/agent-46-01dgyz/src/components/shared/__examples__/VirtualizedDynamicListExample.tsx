/**
 * Example usage of VirtualizedDynamicList and VirtualizedTableTanstack
 * with dynamic row height estimation for variable content.
 */

import React from 'react';
import { VirtualizedDynamicList } from '../VirtualizedDynamicList';
import { VirtualizedTableTanstack } from '../VirtualizedTableTanstack';

// Example 1: Using VirtualizedDynamicList with automatic height estimation
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
}

export function ProductListExample() {
  const products: Product[] = [
    {
      id: '1',
      name: 'Product A',
      description: 'Short description',
      price: 29.99,
    },
    {
      id: '2',
      name: 'Product B',
      description: 'This is a much longer description that will span multiple lines when displayed in the table. It contains detailed information about the product features and benefits.',
      price: 49.99,
    },
    {
      id: '3',
      name: 'Product C',
      description: 'Medium length description with some details',
      price: 39.99,
    },
  ];

  const columns = [
    { header: 'Name', accessorKey: 'name' as const, width: 200 },
    { header: 'Description', accessorKey: 'description' as const },
    { header: 'Price', accessorKey: 'price' as const, width: 120 },
  ];

  return (
    <VirtualizedDynamicList
      columns={columns}
      data={products}
      height={600}
      dynamicHeightConfig={{
        baseHeight: 48,
        lineHeight: 20,
        charsPerLine: 50,
        padding: 16,
      }}
    />
  );
}

// Example 2: Using VirtualizedTableTanstack with custom height estimation
interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export function CommentListExample() {
  const comments: Comment[] = [
    {
      id: '1',
      author: 'John Doe',
      text: 'Great product!',
      timestamp: '2024-01-01',
    },
    {
      id: '2',
      author: 'Jane Smith',
      text: 'I really enjoyed using this product. It exceeded my expectations in every way. The quality is outstanding and the customer service was excellent. Highly recommend to anyone looking for a reliable solution.',
      timestamp: '2024-01-02',
    },
  ];

  const columns = [
    { header: 'Author', accessorKey: 'author' as const, width: 150 },
    { header: 'Comment', accessorKey: 'text' as const },
    { header: 'Date', accessorKey: 'timestamp' as const, width: 120 },
  ];

  // Custom height estimation based on text length
  const estimateHeight = (comment: Comment) => {
    const textLength = comment.text.length;
    if (textLength > 200) return 120;
    if (textLength > 100) return 80;
    if (textLength > 50) return 60;
    return 48;
  };

  return (
    <VirtualizedTableTanstack
      columns={columns}
      data={comments}
      height={600}
      enableDynamicHeight={true}
      estimateRowHeight={estimateHeight}
    />
  );
}

// Example 3: Using measureElement for precise height calculation
export function PreciseHeightExample() {
  const items = Array.from({ length: 100 }, (_, i) => ({
    id: `${i}`,
    title: `Item ${i}`,
    content: i % 3 === 0
      ? 'Short content'
      : i % 3 === 1
      ? 'Medium length content that takes up a bit more space'
      : 'Very long content that spans multiple lines and needs precise measurement to ensure proper scrolling behavior. This is especially important for complex layouts.',
  }));

  const columns = [
    { header: 'Title', accessorKey: 'title' as const, width: 150 },
    { header: 'Content', accessorKey: 'content' as const },
  ];

  return (
    <VirtualizedTableTanstack
      columns={columns}
      data={items}
      height={600}
      enableDynamicHeight={true}
      measureElement={true} // Measure actual DOM heights for precision
      estimateRowHeight={(item) => {
        // Provide initial estimate, will be refined by measurement
        return item.content.length > 100 ? 100 : 60;
      }}
    />
  );
}

// Example 4: Handling custom cell renderers with dynamic height
interface Task {
  id: string;
  title: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
}

export function TaskListExample() {
  const tasks: Task[] = [
    {
      id: '1',
      title: 'Simple task',
      tags: ['urgent'],
      priority: 'high',
    },
    {
      id: '2',
      title: 'Complex task with many details',
      tags: ['feature', 'frontend', 'backend', 'database', 'testing'],
      priority: 'medium',
    },
  ];

  const columns = [
    { header: 'Title', accessorKey: 'title' as const, width: 200 },
    {
      header: 'Tags',
      id: 'tags',
      cell: ({ original }: { original: Task }) => (
        <div className="flex flex-wrap gap-1">
          {original.tags.map((tag) => (
            <span key={tag} className="px-2 py-1 bg-blue-100 rounded text-xs">
              {tag}
            </span>
          ))}
        </div>
      ),
    },
    { header: 'Priority', accessorKey: 'priority' as const, width: 100 },
  ];

  // Estimate height based on number of tags
  const estimateHeight = (task: Task) => {
    const tagCount = task.tags.length;
    const baseHeight = 48;
    const tagRowHeight = 28; // Height per row of tags
    const tagsPerRow = 3; // Approximate tags that fit per row
    const tagRows = Math.ceil(tagCount / tagsPerRow);
    return baseHeight + (tagRows - 1) * tagRowHeight;
  };

  return (
    <VirtualizedTableTanstack
      columns={columns}
      data={tasks}
      height={600}
      enableDynamicHeight={true}
      estimateRowHeight={estimateHeight}
      measureElement={true} // For precise measurement of wrapped tags
    />
  );
}
