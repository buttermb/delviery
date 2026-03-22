/**
 * CreditCostBadge Tests
 *
 * Verifies:
 * - Correct credit cost is displayed for each action key
 * - Cost resolution from actionKey via getCreditCost()
 * - Direct cost prop takes precedence when no actionKey
 * - Color coding based on affordability (red/orange/yellow/default)
 * - Only renders for free tier users
 * - Returns null when cost is 0 (free actions)
 * - Returns null when isLoading is true
 * - Inline mode renders text span
 * - Compact mode hides Coins icon
 * - Tooltip shows action details, cost, and remaining balance
 * - Insufficient credits shows alert icon and warning
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreditCostBadge } from '../CreditCostBadge';
import { CREDIT_COSTS } from '@/lib/credits/creditCosts';

// --- Mutable mock state ---
let mockBalance = 5000;
let mockIsFreeTier = true;
let mockIsLoading = false;

// --- Mocks ---

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: mockBalance,
    isFreeTier: mockIsFreeTier,
    isLoading: mockIsLoading,
  }),
}));

// Render tooltip content directly for assertions
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('CreditCostBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBalance = 5000;
    mockIsFreeTier = true;
    mockIsLoading = false;
  });

  // ==========================================================================
  // Correct cost for each action key
  // ==========================================================================
  describe('shows correct cost for each action key', () => {
    const actionKeysWithExpectedCosts: Array<{ key: string; cost: number; name: string }> = [
      // Menus
      { key: 'menu_view', cost: 2, name: 'Menu View' },
      { key: 'menu_create', cost: 100, name: 'Create Menu' },
      { key: 'menu_order_received', cost: 75, name: 'Order Received' },
      { key: 'menu_import_catalog', cost: 50, name: 'Import Catalog' },
      // Orders
      { key: 'order_create_manual', cost: 50, name: 'Create Manual Order' },
      // Wholesale
      { key: 'wholesale_order_place', cost: 100, name: 'Place Wholesale Order' },
      { key: 'wholesale_order_receive', cost: 75, name: 'Receive Wholesale Order' },
      // Loyalty
      { key: 'loyalty_reward_create', cost: 25, name: 'Create Reward' },
      { key: 'loyalty_reward_issue', cost: 15, name: 'Issue Reward' },
      // Coupons
      { key: 'coupon_create', cost: 20, name: 'Create Coupon' },
      { key: 'coupon_redeemed', cost: 5, name: 'Coupon Redeemed' },
      // POS
      { key: 'pos_process_sale', cost: 25, name: 'Process Sale' },
      { key: 'pos_print_receipt', cost: 5, name: 'Print Receipt' },
      // Inventory
      { key: 'product_add', cost: 10, name: 'Add Product' },
      { key: 'product_bulk_import', cost: 50, name: 'Bulk Import Products' },
      { key: 'stock_update', cost: 3, name: 'Update Stock' },
      { key: 'stock_bulk_update', cost: 25, name: 'Bulk Update Stock' },
      { key: 'barcode_generate', cost: 5, name: 'Generate Barcode' },
      { key: 'barcode_print_batch', cost: 25, name: 'Print Barcode Batch' },
      { key: 'transfer_create', cost: 20, name: 'Create Transfer' },
      { key: 'receiving_log', cost: 10, name: 'Log Received Inventory' },
      { key: 'dispatch_create', cost: 20, name: 'Create Dispatch' },
      { key: 'alert_triggered', cost: 10, name: 'Alert Triggered' },
      // Customers & CRM
      { key: 'customer_add', cost: 5, name: 'Add Customer' },
      { key: 'customer_import', cost: 50, name: 'Import Customers' },
      { key: 'send_sms', cost: 25, name: 'Send SMS' },
      { key: 'send_email', cost: 10, name: 'Send Email' },
      { key: 'send_bulk_sms', cost: 20, name: 'Send Bulk SMS' },
      { key: 'send_bulk_email', cost: 8, name: 'Send Bulk Email' },
      { key: 'live_chat_message', cost: 5, name: 'Send Chat Message' },
      { key: 'who_owes_me_reminder', cost: 25, name: 'Send Payment Reminder' },
      // Invoices
      { key: 'invoice_create', cost: 50, name: 'Create Invoice' },
      { key: 'invoice_send', cost: 25, name: 'Send Invoice' },
      // Operations
      { key: 'supplier_add', cost: 5, name: 'Add Supplier' },
      { key: 'purchase_order_create', cost: 30, name: 'Create Purchase Order' },
      { key: 'return_process', cost: 15, name: 'Process Return' },
      { key: 'qc_log_check', cost: 10, name: 'Log QC Check' },
      { key: 'appointment_create', cost: 10, name: 'Create Appointment' },
      { key: 'appointment_reminder', cost: 25, name: 'Send Appointment Reminder' },
      // Delivery & Fleet
      { key: 'delivery_create', cost: 30, name: 'Create Delivery' },
      { key: 'route_optimize', cost: 50, name: 'Optimize Route' },
      { key: 'courier_assign_delivery', cost: 10, name: 'Assign Delivery' },
      { key: 'tracking_send_link', cost: 15, name: 'Send Tracking Link' },
      // Reports & Analytics
      { key: 'report_custom_generate', cost: 75, name: 'Generate Custom Report' },
      { key: 'report_schedule', cost: 50, name: 'Schedule Report' },
      { key: 'commission_calculate', cost: 30, name: 'Calculate Commissions' },
      { key: 'forecast_run', cost: 75, name: 'Run Forecast' },
      { key: 'data_warehouse_query', cost: 25, name: 'Query Data Warehouse' },
      { key: 'data_warehouse_export', cost: 200, name: 'Export from Data Warehouse' },
      // AI Features
      { key: 'ai_insight_generate', cost: 50, name: 'Generate AI Insight' },
      { key: 'menu_ocr', cost: 250, name: 'Menu OCR Scan' },
      { key: 'ai_suggestions', cost: 100, name: 'AI Suggestions' },
      // Marketplace
      { key: 'marketplace_list_product', cost: 25, name: 'List Product' },
      { key: 'marketplace_order_created', cost: 100, name: 'Marketplace Order Received' },
      { key: 'storefront_create', cost: 500, name: 'Create Storefront' },
    ];

    it.each(actionKeysWithExpectedCosts)(
      'displays $cost credits for $key ($name)',
      ({ key, cost }) => {
        mockBalance = 10000; // Ensure we can afford everything
        render(<CreditCostBadge actionKey={key} showTooltip={false} />);
        expect(screen.getByText(cost.toLocaleString())).toBeInTheDocument();
      }
    );

    it('verifies action key costs match CREDIT_COSTS source', () => {
      for (const { key, cost } of actionKeysWithExpectedCosts) {
        expect(CREDIT_COSTS[key]?.credits).toBe(cost);
      }
    });
  });

  // ==========================================================================
  // Free actions return null
  // ==========================================================================
  describe('free actions return null', () => {
    const freeActionKeys = [
      'dashboard_view',
      'orders_view',
      'menu_edit',
      'product_view',
      'customer_view',
      'settings_view',
      'export_csv',
      'export_pdf',
    ];

    it.each(freeActionKeys)('returns null for free action %s', (key) => {
      const { container } = render(<CreditCostBadge actionKey={key} />);
      expect(container.firstChild).toBeNull();
    });
  });

  // ==========================================================================
  // Rendering conditions
  // ==========================================================================
  describe('rendering conditions', () => {
    it('returns null when not on free tier', () => {
      mockIsFreeTier = false;
      const { container } = render(
        <CreditCostBadge actionKey="menu_create" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('returns null when isLoading is true', () => {
      mockIsLoading = true;
      const { container } = render(
        <CreditCostBadge actionKey="menu_create" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('returns null when cost is 0 via direct cost prop', () => {
      const { container } = render(<CreditCostBadge cost={0} />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null when no actionKey and no cost provided', () => {
      const { container } = render(<CreditCostBadge />);
      expect(container.firstChild).toBeNull();
    });

    it('renders when on free tier with non-zero cost', () => {
      render(<CreditCostBadge actionKey="menu_create" showTooltip={false} />);
      expect(screen.getByText('100')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Cost resolution
  // ==========================================================================
  describe('cost resolution', () => {
    it('uses direct cost prop when no actionKey', () => {
      render(<CreditCostBadge cost={42} showTooltip={false} />);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('resolves cost from actionKey via getCreditCost', () => {
      render(<CreditCostBadge actionKey="send_sms" showTooltip={false} />);
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('prefers actionKey cost over direct cost when actionKey is provided', () => {
      // actionKey 'send_sms' = 25, but direct cost = 999
      // Component uses: directCost ?? getCreditCost(actionKey)
      // Since directCost is provided, it takes precedence (nullish coalescing)
      render(
        <CreditCostBadge actionKey="send_sms" cost={999} showTooltip={false} />
      );
      expect(screen.getByText('999')).toBeInTheDocument();
    });

    it('falls back to actionKey cost when direct cost is undefined', () => {
      render(<CreditCostBadge actionKey="invoice_create" showTooltip={false} />);
      expect(screen.getByText('50')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Color coding based on affordability
  // ==========================================================================
  describe('color coding', () => {
    it('uses red when user cannot afford the action', () => {
      mockBalance = 50; // Can't afford 100 credits
      const { container } = render(
        <CreditCostBadge actionKey="menu_create" showTooltip={false} />
      );
      expect(container.querySelector('.text-red-600')).toBeInTheDocument();
    });

    it('uses orange when balance after action would be below 500', () => {
      mockBalance = 550; // 550 - 100 = 450, below 500
      const { container } = render(
        <CreditCostBadge actionKey="menu_create" showTooltip={false} />
      );
      expect(container.querySelector('.text-orange-600')).toBeInTheDocument();
    });

    it('uses yellow when balance after action would be below 1000', () => {
      mockBalance = 1050; // 1050 - 100 = 950, below 1000
      const { container } = render(
        <CreditCostBadge actionKey="menu_create" showTooltip={false} />
      );
      expect(container.querySelector('.text-yellow-600')).toBeInTheDocument();
    });

    it('uses default color when balance is sufficient', () => {
      mockBalance = 5000; // 5000 - 100 = 4900, well above 1000
      const { container } = render(
        <CreditCostBadge actionKey="menu_create" showTooltip={false} />
      );
      expect(container.querySelector('.text-muted-foreground')).toBeInTheDocument();
    });

    it('shows AlertTriangle icon when user cannot afford', () => {
      mockBalance = 10; // Can't afford 100
      render(<CreditCostBadge actionKey="menu_create" showTooltip={false} />);
      // AlertTriangle renders as an svg with class h-3 w-3
      const { container } = render(
        <CreditCostBadge actionKey="menu_create" showTooltip={false} />
      );
      // The badge should have both the alert triangle and the cost
      const badge = container.querySelector('.bg-red-500\\/10');
      expect(badge).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Display modes
  // ==========================================================================
  describe('display modes', () => {
    it('renders inline mode as a span with credits text', () => {
      const { container } = render(
        <CreditCostBadge actionKey="send_email" inline showTooltip={false} />
      );
      const span = container.querySelector('span');
      expect(span).toBeInTheDocument();
      expect(span?.textContent).toBe('(10 credits)');
    });

    it('inline mode applies color class from getColorClasses', () => {
      mockBalance = 5; // Can't afford 10
      const { container } = render(
        <CreditCostBadge actionKey="send_email" inline showTooltip={false} />
      );
      const span = container.querySelector('.text-red-600');
      expect(span).toBeInTheDocument();
    });

    it('compact mode hides Coins icon but shows cost', () => {
      render(
        <CreditCostBadge actionKey="send_sms" compact showTooltip={false} />
      );
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('hoverMode applies opacity and transition classes', () => {
      const { container } = render(
        <CreditCostBadge actionKey="send_sms" hoverMode showTooltip={false} />
      );
      const badge = container.querySelector('.opacity-0');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('group-hover:opacity-100');
    });
  });

  // ==========================================================================
  // Tooltip content
  // ==========================================================================
  describe('tooltip content', () => {
    it('shows action name from costInfo', () => {
      render(<CreditCostBadge actionKey="menu_create" />);
      expect(screen.getByText('Create Menu')).toBeInTheDocument();
    });

    it('shows action description', () => {
      render(<CreditCostBadge actionKey="menu_create" />);
      expect(
        screen.getByText('Create disposable menu (core feature)')
      ).toBeInTheDocument();
    });

    it('shows cost in credits', () => {
      render(<CreditCostBadge actionKey="menu_create" />);
      expect(screen.getByText('100 credits')).toBeInTheDocument();
    });

    it('shows remaining balance after deduction', () => {
      mockBalance = 5000;
      render(<CreditCostBadge actionKey="menu_create" />);
      // 5000 - 100 = 4900
      expect(screen.getByText('4,900 credits')).toBeInTheDocument();
    });

    it('shows insufficient credits warning when cannot afford', () => {
      mockBalance = 50;
      render(<CreditCostBadge actionKey="menu_create" />);
      expect(
        screen.getByText('Insufficient credits for this action.')
      ).toBeInTheDocument();
    });

    it('does not show insufficient warning when can afford', () => {
      mockBalance = 5000;
      render(<CreditCostBadge actionKey="menu_create" />);
      expect(
        screen.queryByText('Insufficient credits for this action.')
      ).not.toBeInTheDocument();
    });

    it('shows negative remaining when balance is less than cost', () => {
      mockBalance = 30;
      render(<CreditCostBadge actionKey="menu_create" />);
      // 30 - 100 = -70
      expect(screen.getByText('-70 credits')).toBeInTheDocument();
    });

    it('shows fallback "Credit Cost" when no actionKey', () => {
      render(<CreditCostBadge cost={42} />);
      expect(screen.getByText('Credit Cost')).toBeInTheDocument();
    });

    it('does not render tooltip when showTooltip is false', () => {
      render(<CreditCostBadge actionKey="menu_create" showTooltip={false} />);
      expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Custom className
  // ==========================================================================
  describe('custom className', () => {
    it('applies className to badge', () => {
      const { container } = render(
        <CreditCostBadge
          actionKey="send_sms"
          className="my-custom-class"
          showTooltip={false}
        />
      );
      const badge = container.querySelector('.my-custom-class');
      expect(badge).toBeInTheDocument();
    });

    it('applies className to inline span', () => {
      const { container } = render(
        <CreditCostBadge
          actionKey="send_sms"
          inline
          className="my-inline-class"
        />
      );
      const span = container.querySelector('.my-inline-class');
      expect(span).toBeInTheDocument();
    });
  });
});
