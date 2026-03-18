/**
 * CouponManager Tests
 * Tests for marketplace coupon CRUD operations, form validation, and accessibility
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock dependencies before importing the component
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("@/contexts/TenantAdminAuthContext", () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: {
      id: "tenant-123",
      slug: "test-tenant",
      business_name: "Test Business",
    },
    loading: false,
    admin: { id: "admin-123", email: "admin@test.com" },
    tenantSlug: "test-tenant",
  }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/humanizeError", () => ({
  humanizeError: vi.fn().mockReturnValue("Something went wrong"),
}));

vi.mock("@/components/shared/ConfirmDeleteDialog", () => ({
  ConfirmDeleteDialog: ({
    open,
    onConfirm,
    itemName,
  }: {
    open: boolean;
    onConfirm: () => void;
    itemName: string;
    onOpenChange: (open: boolean) => void;
    isLoading: boolean;
  }) =>
    open ? (
      <div data-testid="confirm-delete-dialog">
        <span>Delete {itemName}?</span>
        <button onClick={onConfirm}>Confirm Delete</button>
      </div>
    ) : null,
}));

// Import after mocks
import CouponManager from "../CouponManager";
import { logger } from "@/lib/logger";

const mockCoupons = [
  {
    id: "coupon-1",
    store_id: "store-123",
    code: "SUMMER25",
    discount_type: "percentage",
    discount_value: 25,
    usage_limit: 100,
    used_count: 42,
    start_date: "2024-06-01",
    end_date: "2024-09-01T12:00:00",
    is_active: true,
    created_at: "2024-05-15T00:00:00Z",
    min_order_amount: null,
    max_discount_amount: null,
    description: null,
  },
  {
    id: "coupon-2",
    store_id: "store-123",
    code: "FLAT10",
    discount_type: "fixed_amount",
    discount_value: 10,
    usage_limit: null,
    used_count: null,
    start_date: null,
    end_date: null,
    is_active: false,
    created_at: "2024-04-10T00:00:00Z",
    min_order_amount: null,
    max_discount_amount: null,
    description: null,
  },
];

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={["/test-tenant/admin/marketplace/coupons"]}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

function setupMocks({
  store = { id: "store-123" } as { id: string } | null,
  coupons = mockCoupons,
  storeError = null as unknown,
  couponsError = null as unknown,
} = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "marketplace_stores") {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: store, error: storeError });
      return chain;
    }
    if (table === "marketplace_coupons") {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockResolvedValue({ data: coupons, error: couponsError });
      chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
      chain.delete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });
      return chain;
    }
    const defaultChain: Record<string, ReturnType<typeof vi.fn>> = {};
    defaultChain.select = vi.fn().mockReturnValue(defaultChain);
    defaultChain.eq = vi.fn().mockReturnValue(defaultChain);
    defaultChain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    return defaultChain;
  });
}

/** Wait for coupon data to appear (store query + coupons query both resolve) */
async function waitForCouponsToLoad() {
  await waitFor(
    () => {
      expect(screen.getByText("SUMMER25")).toBeInTheDocument();
    },
    { timeout: 3000 }
  );
}

describe("CouponManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  describe("Page Rendering", () => {
    it("should render page title and description", async () => {
      render(<CouponManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText("Coupons & Discounts")).toBeInTheDocument();
        expect(
          screen.getByText("Create and manage discount codes for your store.")
        ).toBeInTheDocument();
      });
    });

    it("should render create coupon button with aria-label", async () => {
      render(<CouponManager />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /create new coupon/i })
        ).toBeInTheDocument();
      });
    });

    it("should render table headers", async () => {
      render(<CouponManager />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText("Code")).toBeInTheDocument();
        expect(screen.getByText("Discount")).toBeInTheDocument();
        expect(screen.getByText("Usage")).toBeInTheDocument();
        expect(screen.getByText("Status")).toBeInTheDocument();
        expect(screen.getByText("Expiry")).toBeInTheDocument();
        expect(screen.getByText("Actions")).toBeInTheDocument();
      });
    });
  });

  describe("Coupon Display", () => {
    it("should display coupon codes after data loads", async () => {
      render(<CouponManager />, { wrapper });

      await waitForCouponsToLoad();
      expect(screen.getByText("FLAT10")).toBeInTheDocument();
    });

    it("should display percentage discount correctly", async () => {
      render(<CouponManager />, { wrapper });

      await waitForCouponsToLoad();
      expect(screen.getByText("25%")).toBeInTheDocument();
    });

    it("should display active/inactive badges", async () => {
      render(<CouponManager />, { wrapper });

      await waitForCouponsToLoad();
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("Inactive")).toBeInTheDocument();
    });

    it("should display expiry date when present", async () => {
      render(<CouponManager />, { wrapper });

      await waitForCouponsToLoad();
      // Date text is split by Calendar SVG icon, find by checking cell content
      const cells = screen.getAllByRole("cell");
      const expiryCell = cells.find((cell) =>
        cell.textContent?.includes("Sep 1, 2024")
      );
      expect(expiryCell).toBeTruthy();
    });

    it("should display 'Never' when no expiry date", async () => {
      render(<CouponManager />, { wrapper });

      await waitForCouponsToLoad();
      expect(screen.getByText("Never")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("should show contextual empty state when no coupons exist", async () => {
      setupMocks({ coupons: [] });

      render(<CouponManager />, { wrapper });

      await waitFor(
        () => {
          expect(screen.getByText("No coupons yet")).toBeInTheDocument();
          expect(
            screen.getByText(
              "Create your first discount code to attract customers."
            )
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Create Coupon Dialog", () => {
    it("should open dialog when create button is clicked", async () => {
      render(<CouponManager />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /create new coupon/i })
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", { name: /create new coupon/i })
      );

      await waitFor(() => {
        expect(screen.getByText("Create New Coupon")).toBeInTheDocument();
        expect(
          screen.getByText("Add a new discount code for your customers.")
        ).toBeInTheDocument();
      });
    });

    it("should show form fields in the dialog", async () => {
      render(<CouponManager />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /create new coupon/i })
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", { name: /create new coupon/i })
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText("SUMMER25")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("20")).toBeInTheDocument();
        expect(
          screen.getByPlaceholderText("Total uses (optional)")
        ).toBeInTheDocument();
      });
    });

    it("should validate required fields on submit", async () => {
      const user = userEvent.setup();
      render(<CouponManager />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /create new coupon/i })
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", { name: /create new coupon/i })
      );

      // Submit form without filling fields
      const dialog = await screen.findByRole("dialog");
      const submitButton = within(dialog).getByRole("button", {
        name: /create coupon/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/coupon code is required/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Delete Coupon", () => {
    it("should open delete confirmation dialog when delete button is clicked", async () => {
      const user = userEvent.setup();
      render(<CouponManager />, { wrapper });

      await waitForCouponsToLoad();

      await user.click(
        screen.getByRole("button", { name: /delete coupon SUMMER25/i })
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("confirm-delete-dialog")
        ).toBeInTheDocument();
        expect(screen.getByText("Delete SUMMER25?")).toBeInTheDocument();
      });
    });

    it("should call delete mutation when confirmed", async () => {
      const user = userEvent.setup();
      render(<CouponManager />, { wrapper });

      await waitForCouponsToLoad();

      await user.click(
        screen.getByRole("button", { name: /delete coupon SUMMER25/i })
      );

      const confirmButton = await screen.findByText("Confirm Delete");
      await user.click(confirmButton);

      await waitFor(() => {
        // Verify marketplace_coupons was called for the delete operation
        const couponCalls = mockFrom.mock.calls.filter(
          (call: string[]) => call[0] === "marketplace_coupons"
        );
        // At least the initial fetch + delete call
        expect(couponCalls.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe("Store ID Integration", () => {
    it("should fetch marketplace store by tenant_id first", async () => {
      render(<CouponManager />, { wrapper });

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith("marketplace_stores");
      });
    });

    it("should query coupons table after store loads", async () => {
      render(<CouponManager />, { wrapper });

      await waitFor(
        () => {
          expect(mockFrom).toHaveBeenCalledWith("marketplace_coupons");
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Error Handling", () => {
    it("should log errors when store fetch fails", async () => {
      setupMocks({ storeError: new Error("DB error"), store: null });

      render(<CouponManager />, { wrapper });

      await waitFor(
        () => {
          expect(logger.error).toHaveBeenCalledWith(
            "Failed to fetch marketplace store",
            expect.anything()
          );
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Accessibility", () => {
    it("should have aria-labels on delete buttons for each coupon", async () => {
      render(<CouponManager />, { wrapper });

      await waitForCouponsToLoad();

      expect(
        screen.getByRole("button", { name: /delete coupon SUMMER25/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /delete coupon FLAT10/i })
      ).toBeInTheDocument();
    });
  });

  describe("Null Safety", () => {
    it("should handle null used_count gracefully", async () => {
      setupMocks({
        coupons: [
          {
            ...mockCoupons[0],
            code: "NULLTEST",
            used_count: null,
            usage_limit: 50,
          },
        ],
      });

      render(<CouponManager />, { wrapper });

      await waitFor(
        () => {
          expect(screen.getByText("NULLTEST")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Should render "0 / 50" for null used_count
      const cells = screen.getAllByRole("cell");
      const usageCell = cells.find(
        (cell) => cell.textContent?.includes("0") && cell.textContent?.includes("50")
      );
      expect(usageCell).toBeTruthy();
    });

    it("should handle null is_active gracefully", async () => {
      setupMocks({
        coupons: [
          {
            ...mockCoupons[0],
            code: "NULLACTIVE",
            is_active: null,
          },
        ],
      });

      render(<CouponManager />, { wrapper });

      await waitFor(
        () => {
          expect(screen.getByText("NULLACTIVE")).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Null is_active should default to Inactive
      expect(screen.getByText("Inactive")).toBeInTheDocument();
    });
  });
});
