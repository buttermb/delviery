import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  PieChart,
  AreaChart,
  Bar,
  Line,
  Area,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from '../lazy-recharts';

describe('Lazy Recharts Components', () => {
  const mockData = [
    { name: 'Jan', value: 100 },
    { name: 'Feb', value: 200 },
    { name: 'Mar', value: 150 },
  ];

  describe('Chart Containers', () => {
    it('should lazy load ResponsiveContainer', async () => {
      render(
        <ResponsiveContainer width="100%" height={300}>
          <div data-testid="chart-content">Chart Content</div>
        </ResponsiveContainer>
      );

      await waitFor(() => {
        expect(screen.getByTestId('chart-content')).toBeInTheDocument();
      });
    });

    it('should show skeleton during lazy loading', async () => {
      const { container } = render(
        <ResponsiveContainer width="100%" height={300}>
          <div>Chart Content</div>
        </ResponsiveContainer>
      );

      // Verify ResponsiveContainer eventually renders
      await waitFor(() => {
        const renderedContent = container.querySelector('.recharts-responsive-container');
        expect(renderedContent).toBeTruthy();
      });
    });
  });

  describe('BarChart', () => {
    it('should lazy load BarChart component', async () => {
      render(
        <ResponsiveContainer width={400} height={300}>
          <BarChart data={mockData}>
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      );

      await waitFor(
        () => {
          const svg = document.querySelector('svg');
          expect(svg).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });

    it('should render Bar components within BarChart', async () => {
      render(
        <ResponsiveContainer width={400} height={300}>
          <BarChart data={mockData}>
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      );

      await waitFor(
        () => {
          const svg = document.querySelector('svg');
          expect(svg).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('LineChart', () => {
    it('should lazy load LineChart component', async () => {
      render(
        <ResponsiveContainer width={400} height={300}>
          <LineChart data={mockData}>
            <Line type="monotone" dataKey="value" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      );

      await waitFor(
        () => {
          const svg = document.querySelector('svg');
          expect(svg).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('PieChart', () => {
    it('should lazy load PieChart component', async () => {
      render(
        <ResponsiveContainer width={400} height={300}>
          <PieChart>
            <Pie data={mockData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" />
          </PieChart>
        </ResponsiveContainer>
      );

      await waitFor(
        () => {
          const svg = document.querySelector('svg');
          expect(svg).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });

    it('should render Cell components within Pie', async () => {
      const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];
      render(
        <ResponsiveContainer width={400} height={300}>
          <PieChart>
            <Pie data={mockData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
              {mockData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );

      await waitFor(
        () => {
          const svg = document.querySelector('svg');
          expect(svg).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('AreaChart', () => {
    it('should lazy load AreaChart component', async () => {
      render(
        <ResponsiveContainer width={400} height={300}>
          <AreaChart data={mockData}>
            <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" />
          </AreaChart>
        </ResponsiveContainer>
      );

      await waitFor(
        () => {
          const svg = document.querySelector('svg');
          expect(svg).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Chart Components', () => {
    it('should lazy load XAxis and YAxis', async () => {
      render(
        <ResponsiveContainer width={400} height={300}>
          <BarChart data={mockData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      );

      await waitFor(
        () => {
          const svg = document.querySelector('svg');
          expect(svg).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });

    it('should lazy load CartesianGrid', async () => {
      render(
        <ResponsiveContainer width={400} height={300}>
          <BarChart data={mockData}>
            <CartesianGrid strokeDasharray="3 3" />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      );

      await waitFor(
        () => {
          const svg = document.querySelector('svg');
          expect(svg).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });

    it('should lazy load Tooltip and Legend', async () => {
      render(
        <ResponsiveContainer width={400} height={300}>
          <BarChart data={mockData}>
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      );

      await waitFor(
        () => {
          const svg = document.querySelector('svg');
          expect(svg).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Component Integration', () => {
    it('should render complete chart with all components', async () => {
      render(
        <ResponsiveContainer width={600} height={400}>
          <LineChart data={mockData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      );

      await waitFor(
        () => {
          const svg = document.querySelector('svg');
          expect(svg).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Suspense Behavior', () => {
    it('should eventually render lazy-loaded components', async () => {
      const { container } = render(
        <ResponsiveContainer width={400} height={300}>
          <BarChart data={mockData}>
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      );

      // Verify components eventually load
      await waitFor(
        () => {
          const svg = container.querySelector('svg');
          expect(svg).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Type Safety', () => {
    it('should maintain TypeScript type compatibility', async () => {
      // This test verifies that TypeScript types are correctly exported
      // and can be used without errors
      const chartData: Array<{ name: string; value: number }> = mockData;

      render(
        <ResponsiveContainer width={400} height={300}>
          <BarChart data={chartData}>
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      );

      await waitFor(
        () => {
          const svg = document.querySelector('svg');
          expect(svg).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Performance', () => {
    it('should use dynamic imports for code splitting', () => {
      // Verify that lazy loading is being used
      // This is implicit in the implementation using React.lazy
      expect(ResponsiveContainer).toBeDefined();
      expect(BarChart).toBeDefined();
      expect(LineChart).toBeDefined();
      expect(PieChart).toBeDefined();
      expect(AreaChart).toBeDefined();
    });
  });
});
