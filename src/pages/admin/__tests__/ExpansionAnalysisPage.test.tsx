/**
 * ExpansionAnalysisPage Component Tests
 * Tests:
 * - Renders loading skeleton when tenant is loading
 * - Renders page content when tenant is loaded
 * - ROI calculator computes monthly profit, break-even, ROI
 * - Market opportunities render from data
 * - Key considerations and next steps render
 * - Accessible labels on inputs
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ExpansionAnalysisPage from '../ExpansionAnalysisPage';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockUseTenantAdminAuth = vi.fn();

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => mockUseTenantAdminAuth(),
}));

function renderPage() {
  return render(
    <BrowserRouter>
      <ExpansionAnalysisPage />
    </BrowserRouter>,
  );
}

describe('ExpansionAnalysisPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('renders skeleton when tenant is loading', () => {
      mockUseTenantAdminAuth.mockReturnValue({
        tenant: null,
        loading: true,
      });

      renderPage();

      // Skeleton should be visible - no heading rendered
      expect(screen.queryByText('Expansion Analysis')).not.toBeInTheDocument();
    });

    it('renders skeleton when tenant is null', () => {
      mockUseTenantAdminAuth.mockReturnValue({
        tenant: null,
        loading: false,
      });

      renderPage();

      expect(screen.queryByText('Expansion Analysis')).not.toBeInTheDocument();
    });
  });

  describe('Rendered Content', () => {
    beforeEach(() => {
      mockUseTenantAdminAuth.mockReturnValue({
        tenant: {
          id: 'test-tenant-id',
          name: 'Test Tenant',
          slug: 'test-tenant',
        },
        loading: false,
      });
    });

    it('renders page heading', () => {
      renderPage();

      expect(screen.getByText('Expansion Analysis')).toBeInTheDocument();
      expect(screen.getByText('Market opportunity assessment and growth planning')).toBeInTheDocument();
    });

    it('renders ROI calculator section', () => {
      renderPage();

      expect(screen.getByText('ROI Calculator')).toBeInTheDocument();
      expect(screen.getByLabelText('Initial Investment')).toBeInTheDocument();
      expect(screen.getByLabelText('Expected Monthly Revenue')).toBeInTheDocument();
      expect(screen.getByLabelText('Monthly Operating Costs')).toBeInTheDocument();
    });

    it('shows prompt when no values entered', () => {
      renderPage();

      expect(screen.getByText('Enter values above to calculate ROI')).toBeInTheDocument();
    });

    it('renders market opportunities', () => {
      renderPage();

      expect(screen.getByText('Market Opportunities')).toBeInTheDocument();
      expect(screen.getByText('New Location - Downtown District')).toBeInTheDocument();
      expect(screen.getByText('Online Expansion')).toBeInTheDocument();
      expect(screen.getByText('Suburban Location')).toBeInTheDocument();
    });

    it('renders market opportunity badges', () => {
      renderPage();

      expect(screen.getByText('High Potential')).toBeInTheDocument();
      expect(screen.getByText('Recommended')).toBeInTheDocument();
      expect(screen.getByText('Moderate Potential')).toBeInTheDocument();
    });

    it('renders key considerations', () => {
      renderPage();

      expect(screen.getByText('Key Considerations')).toBeInTheDocument();
      expect(screen.getByText('Market Demand')).toBeInTheDocument();
      expect(screen.getByText('Capital Requirements')).toBeInTheDocument();
      expect(screen.getByText('Growth Potential')).toBeInTheDocument();
    });

    it('renders next steps', () => {
      renderPage();

      expect(screen.getByText('Next Steps')).toBeInTheDocument();
      expect(screen.getByText('Conduct market research')).toBeInTheDocument();
      expect(screen.getByText('Secure funding and permits')).toBeInTheDocument();
      expect(screen.getByText('Finalize location and staffing')).toBeInTheDocument();
    });
  });

  describe('ROI Calculator', () => {
    beforeEach(() => {
      mockUseTenantAdminAuth.mockReturnValue({
        tenant: {
          id: 'test-tenant-id',
          name: 'Test Tenant',
          slug: 'test-tenant',
        },
        loading: false,
      });
    });

    it('calculates monthly profit from revenue minus costs', async () => {
      const user = userEvent.setup();
      renderPage();

      const revenueInput = screen.getByLabelText('Expected Monthly Revenue');
      const costsInput = screen.getByLabelText('Monthly Operating Costs');

      await user.clear(revenueInput);
      await user.type(revenueInput, '15000');

      await user.clear(costsInput);
      await user.type(costsInput, '8000');

      await waitFor(() => {
        expect(screen.getByText('Monthly Profit')).toBeInTheDocument();
      });
    });

    it('calculates break-even period', async () => {
      const user = userEvent.setup();
      renderPage();

      const investmentInput = screen.getByLabelText('Initial Investment');
      const revenueInput = screen.getByLabelText('Expected Monthly Revenue');
      const costsInput = screen.getByLabelText('Monthly Operating Costs');

      await user.clear(investmentInput);
      await user.type(investmentInput, '70000');

      await user.clear(revenueInput);
      await user.type(revenueInput, '15000');

      await user.clear(costsInput);
      await user.type(costsInput, '8000');

      await waitFor(() => {
        expect(screen.getByText('Break-even Period')).toBeInTheDocument();
        expect(screen.getByText('10.0 months')).toBeInTheDocument();
      });
    });

    it('shows ROI percentage', async () => {
      const user = userEvent.setup();
      renderPage();

      const investmentInput = screen.getByLabelText('Initial Investment');
      const revenueInput = screen.getByLabelText('Expected Monthly Revenue');
      const costsInput = screen.getByLabelText('Monthly Operating Costs');

      await user.clear(investmentInput);
      await user.type(investmentInput, '50000');

      await user.clear(revenueInput);
      await user.type(revenueInput, '15000');

      await user.clear(costsInput);
      await user.type(costsInput, '8000');

      // Annual profit = (15000 - 8000) * 12 = 84000
      // ROI = ((84000 - 50000) / 50000) * 100 = 68%
      await waitFor(() => {
        expect(screen.getByText('12-Month ROI')).toBeInTheDocument();
        expect(screen.getByText('68%')).toBeInTheDocument();
      });
    });

    it('shows N/A for break-even when monthly profit is zero or negative', async () => {
      const user = userEvent.setup();
      renderPage();

      const investmentInput = screen.getByLabelText('Initial Investment');
      const revenueInput = screen.getByLabelText('Expected Monthly Revenue');
      const costsInput = screen.getByLabelText('Monthly Operating Costs');

      await user.clear(investmentInput);
      await user.type(investmentInput, '50000');

      await user.clear(revenueInput);
      await user.type(revenueInput, '5000');

      await user.clear(costsInput);
      await user.type(costsInput, '8000');

      await waitFor(() => {
        expect(screen.getByText('N/A')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseTenantAdminAuth.mockReturnValue({
        tenant: {
          id: 'test-tenant-id',
          name: 'Test Tenant',
          slug: 'test-tenant',
        },
        loading: false,
      });
    });

    it('has accessible labels for all inputs', () => {
      renderPage();

      expect(screen.getByLabelText('Initial Investment')).toBeInTheDocument();
      expect(screen.getByLabelText('Expected Monthly Revenue')).toBeInTheDocument();
      expect(screen.getByLabelText('Monthly Operating Costs')).toBeInTheDocument();
    });

    it('has aria-label on ROI results section', () => {
      renderPage();

      expect(screen.getByRole('region', { name: 'ROI calculation results' })).toBeInTheDocument();
    });

    it('inputs have aria-label attributes', () => {
      renderPage();

      expect(screen.getByRole('spinbutton', { name: /initial investment/i })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: /expected monthly revenue/i })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: /monthly operating costs/i })).toBeInTheDocument();
    });
  });
});
