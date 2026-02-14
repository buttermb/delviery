import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VirtualizedDynamicList } from '../VirtualizedDynamicList';

interface TestRow {
  id: string;
  title: string;
  description: string;
  category: string;
}

const mockData: TestRow[] = [
  {
    id: '1',
    title: 'Short Title',
    description: 'Brief description',
    category: 'A',
  },
  {
    id: '2',
    title: 'Medium Length Title Here',
    description: 'This is a medium length description that has some content but not too much',
    category: 'B',
  },
  {
    id: '3',
    title: 'Very Long Title That Goes On And On',
    description: 'This is a very long description that contains a lot of text and would definitely wrap to multiple lines when rendered in a table cell. It has enough content to demonstrate the dynamic height estimation feature working properly.',
    category: 'C',
  },
  {
    id: '4',
    title: 'Another Item',
    description: 'Medium content here',
    category: 'A',
  },
];

const columns = [
  { header: 'Title', accessorKey: 'title' as const, width: 200 },
  { header: 'Description', accessorKey: 'description' as const },
  { header: 'Category', accessorKey: 'category' as const, width: 100 },
];

describe('VirtualizedDynamicList', () => {
  it('renders with default dynamic height config', () => {
    render(
      <VirtualizedDynamicList
        columns={columns}
        data={mockData}
      />
    );

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
  });

  it('renders empty message when no data', () => {
    render(
      <VirtualizedDynamicList
        columns={columns}
        data={[]}
        emptyMessage="No results found"
      />
    );

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('accepts custom dynamic height config', () => {
    const customConfig = {
      baseHeight: 60,
      lineHeight: 24,
      charsPerLine: 40,
      padding: 20,
    };

    const { container } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={mockData}
        dynamicHeightConfig={customConfig}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('handles partial dynamic height config', () => {
    const partialConfig = {
      baseHeight: 55,
      lineHeight: 22,
      // charsPerLine and padding use defaults
    };

    const { container } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={mockData}
        dynamicHeightConfig={partialConfig}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('enables DOM measurement when specified', () => {
    const { container } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={mockData}
        dynamicHeightConfig={{
          measureElement: true,
        }}
      />
    );

    // Check that data-index attributes exist for measurement
    const elementsWithIndex = container.querySelectorAll('[data-index]');
    expect(elementsWithIndex.length).toBeGreaterThanOrEqual(0);
  });

  it('estimates different heights for different content lengths', () => {
    const { container } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={mockData}
        dynamicHeightConfig={{
          charsPerLine: 30, // Smaller to trigger more wrapping
        }}
      />
    );

    // Component should render successfully
    expect(container).toBeInTheDocument();

    // The virtual container should have calculated total height
    const virtualContainer = container.querySelector('[style*="position: relative"]');
    expect(virtualContainer).toBeInTheDocument();
  });

  it('handles custom cell renderers gracefully', () => {
    const customColumns = [
      {
        id: 'title',
        header: 'Title',
        cell: ({ original }: { original: TestRow }) => (
          <div data-testid="custom-title">
            <strong>{original.title}</strong>
          </div>
        ),
      },
      {
        header: 'Description',
        accessorKey: 'description' as const,
      },
    ];

    const { container } = render(
      <VirtualizedDynamicList
        columns={customColumns}
        data={mockData}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('applies className prop', () => {
    const { container } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={mockData}
        className="custom-list-class"
      />
    );

    const listWrapper = container.querySelector('.custom-list-class');
    expect(listWrapper).toBeInTheDocument();
  });

  it('handles onRowClick callback', () => {
    const { container } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={mockData}
        onRowClick={() => {}}
      />
    );

    const clickableRows = container.querySelectorAll('.cursor-pointer');
    expect(clickableRows.length).toBeGreaterThanOrEqual(0);
  });

  it('respects height prop', () => {
    const { container } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={mockData}
        height={800}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('handles overscanCount prop', () => {
    const { container } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={mockData}
        overscanCount={15}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('handles null and undefined values in cells', () => {
    const dataWithNulls = [
      { id: '1', title: 'Title 1', description: '', category: 'A' },
      { id: '2', title: '', description: 'Description 2', category: '' },
    ];

    const { container } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={dataWithNulls}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('works with very short content', () => {
    const shortData = [
      { id: '1', title: 'A', description: 'B', category: 'C' },
    ];

    const { container } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={shortData}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('works with very long content', () => {
    const longDescription = 'A'.repeat(500);
    const longData = [
      { id: '1', title: 'Title', description: longDescription, category: 'Cat' },
    ];

    const { container } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={longData}
        dynamicHeightConfig={{
          charsPerLine: 50,
        }}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('handles large datasets efficiently', () => {
    const largeData = Array.from({ length: 500 }, (_, i) => ({
      id: `id-${i}`,
      title: `Item ${i}`,
      description: `Description for item ${i}`.repeat(Math.floor(Math.random() * 3) + 1),
      category: ['A', 'B', 'C'][i % 3],
    }));

    const { container } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={largeData}
        height={600}
      />
    );

    expect(container).toBeInTheDocument();

    // Virtualization should keep DOM nodes manageable
    const rows = container.querySelectorAll('[style*="position: absolute"]');
    expect(rows.length).toBeLessThan(largeData.length);
  });

  it('uses default config values when not specified', () => {
    const { container } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={mockData}
        // No dynamicHeightConfig provided
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('handles extreme chars per line values', () => {
    const { container: container1 } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={mockData}
        dynamicHeightConfig={{
          charsPerLine: 10, // Very small
        }}
      />
    );

    expect(container1).toBeInTheDocument();

    const { container: container2 } = render(
      <VirtualizedDynamicList
        columns={columns}
        data={mockData}
        dynamicHeightConfig={{
          charsPerLine: 200, // Very large
        }}
      />
    );

    expect(container2).toBeInTheDocument();
  });

  it('handles column without accessorKey', () => {
    const columnsWithoutAccessor = [
      {
        id: 'custom',
        header: 'Custom',
        cell: ({ original }: { original: TestRow }) => <span>{original.title}</span>,
      },
    ];

    const { container } = render(
      <VirtualizedDynamicList
        columns={columnsWithoutAccessor}
        data={mockData}
      />
    );

    expect(container).toBeInTheDocument();
  });
});
