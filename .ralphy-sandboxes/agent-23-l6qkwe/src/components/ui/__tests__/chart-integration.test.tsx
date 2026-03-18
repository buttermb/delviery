import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '../chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from '../lazy-recharts';

describe('Chart Integration with Lazy Recharts', () => {
  const mockData = [
    { month: 'Jan', revenue: 1000, orders: 20 },
    { month: 'Feb', revenue: 1500, orders: 30 },
    { month: 'Mar', revenue: 1200, orders: 25 },
  ];

  const mockConfig = {
    revenue: {
      label: 'Revenue',
      color: 'hsl(var(--chart-1))',
    },
    orders: {
      label: 'Orders',
      color: 'hsl(var(--chart-2))',
    },
  };

  describe('ChartContainer with BarChart', () => {
    it('should render ChartContainer with lazy-loaded BarChart', async () => {
      const { container } = render(
        <div style={{ width: '600px', height: '300px' }}>
          <ChartContainer config={mockConfig} className="h-full w-full">
            <BarChart data={mockData} width={600} height={300}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" />
            </BarChart>
          </ChartContainer>
        </div>
      );

      // Chart container should render immediately
      await waitFor(() => {
        const chartContainer = container.querySelector('[data-chart]');
        expect(chartContainer).toBeInTheDocument();
      });
    });

    it('should apply chart configuration to lazy-loaded components', async () => {
      const { container } = render(
        <div style={{ width: '600px', height: '300px' }}>
          <ChartContainer config={mockConfig} className="h-full w-full">
            <BarChart data={mockData} width={600} height={300}>
              <Bar dataKey="revenue" fill="var(--color-revenue)" />
            </BarChart>
          </ChartContainer>
        </div>
      );

      await waitFor(
        () => {
          const chartContainer = container.querySelector('[data-chart]');
          expect(chartContainer).toBeInTheDocument();

          // Verify chart style is injected
          const style = container.querySelector('style');
          expect(style).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('ChartContainer with LineChart', () => {
    it('should render ChartContainer with lazy-loaded LineChart', async () => {
      const { container } = render(
        <div style={{ width: '600px', height: '300px' }}>
          <ChartContainer config={mockConfig} className="h-full w-full">
            <LineChart data={mockData} width={600} height={300}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" />
            </LineChart>
          </ChartContainer>
        </div>
      );

      await waitFor(() => {
        const chartContainer = container.querySelector('[data-chart]');
        expect(chartContainer).toBeInTheDocument();
      });
    });
  });

  describe('ChartContainer with PieChart', () => {
    it('should render ChartContainer with lazy-loaded PieChart', async () => {
      const pieData = [
        { name: 'Category A', value: 400, fill: '#8884d8' },
        { name: 'Category B', value: 300, fill: '#82ca9d' },
        { name: 'Category C', value: 200, fill: '#ffc658' },
      ];

      const pieConfig = {
        'Category A': { label: 'Category A', color: '#8884d8' },
        'Category B': { label: 'Category B', color: '#82ca9d' },
        'Category C': { label: 'Category C', color: '#ffc658' },
      };

      const { container } = render(
        <div style={{ width: '600px', height: '300px' }}>
          <ChartContainer config={pieConfig} className="h-full w-full">
            <PieChart width={600} height={300}>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ChartContainer>
        </div>
      );

      await waitFor(() => {
        const chartContainer = container.querySelector('[data-chart]');
        expect(chartContainer).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Charts', () => {
    it('should render multiple charts with lazy loading', async () => {
      const { container } = render(
        <div>
          <div style={{ width: '600px', height: '300px' }}>
            <ChartContainer config={mockConfig} className="h-full w-full">
              <BarChart data={mockData} width={600} height={300}>
                <Bar dataKey="revenue" fill="var(--color-revenue)" />
              </BarChart>
            </ChartContainer>
          </div>
          <div style={{ width: '600px', height: '300px' }}>
            <ChartContainer config={mockConfig} className="h-full w-full">
              <LineChart data={mockData} width={600} height={300}>
                <Line type="monotone" dataKey="orders" stroke="var(--color-orders)" />
              </LineChart>
            </ChartContainer>
          </div>
        </div>
      );

      await waitFor(() => {
        const chartContainers = container.querySelectorAll('[data-chart]');
        expect(chartContainers.length).toBe(2);
      });
    });
  });

  describe('Suspense Fallback', () => {
    it('should eventually load lazy components', async () => {
      const { container } = render(
        <div style={{ width: '600px', height: '300px' }}>
          <ChartContainer config={mockConfig} className="h-full w-full">
            <BarChart data={mockData} width={600} height={300}>
              <Bar dataKey="revenue" fill="var(--color-revenue)" />
            </BarChart>
          </ChartContainer>
        </div>
      );

      // Verify chart eventually loads
      await waitFor(
        () => {
          const chartContainer = container.querySelector('[data-chart]');
          expect(chartContainer).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Chart Configuration', () => {
    it('should inject CSS variables for chart colors', async () => {
      const configWithColor = {
        revenue: {
          label: 'Revenue',
          color: '#10b981',
        },
        orders: {
          label: 'Orders',
          color: '#3b82f6',
        },
      };

      const { container } = render(
        <div style={{ width: '600px', height: '300px' }}>
          <ChartContainer config={configWithColor} className="h-full w-full">
            <BarChart data={mockData} width={600} height={300}>
              <Bar dataKey="revenue" fill="var(--color-revenue)" />
            </BarChart>
          </ChartContainer>
        </div>
      );

      // Wait for chart container and style to render
      const style = container.querySelector('style');
      expect(style).toBeInTheDocument();

      const cssContent = style?.innerHTML || '';
      expect(cssContent).toContain('--color-revenue');
    });

    it('should apply theme-specific styles', async () => {
      const themeConfig = {
        revenue: {
          label: 'Revenue',
          theme: {
            light: 'hsl(220, 70%, 50%)',
            dark: 'hsl(220, 70%, 60%)',
          },
        },
      };

      const { container } = render(
        <div style={{ width: '600px', height: '300px' }}>
          <ChartContainer config={themeConfig} className="h-full w-full">
            <BarChart data={mockData} width={600} height={300}>
              <Bar dataKey="revenue" fill="var(--color-revenue)" />
            </BarChart>
          </ChartContainer>
        </div>
      );

      const style = container.querySelector('style');
      expect(style).toBeInTheDocument();

      const cssContent = style?.innerHTML || '';
      // Should contain the chart data attribute styling
      expect(cssContent).toContain('[data-chart=');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty data gracefully', async () => {
      const { container } = render(
        <div style={{ width: '600px', height: '300px' }}>
          <ChartContainer config={mockConfig} className="h-full w-full">
            <BarChart data={[]} width={600} height={300}>
              <Bar dataKey="revenue" fill="var(--color-revenue)" />
            </BarChart>
          </ChartContainer>
        </div>
      );

      await waitFor(
        () => {
          const chartContainer = container.querySelector('[data-chart]');
          expect(chartContainer).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });
});
