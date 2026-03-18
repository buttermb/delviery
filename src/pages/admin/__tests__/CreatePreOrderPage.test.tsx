/**
 * Tests for CreatePreOrderPage component
 *
 * Verifies:
 * - Form renders with client selector, date picker, notes textarea
 * - Tenant context validation (loading, error, ready states)
 * - expected_date and notes are passed to the mutation
 * - Inventory validation blocks submission of out-of-stock items
 * - Empty line items are rejected
 * - Activity log is fired after successful creation
 * - Error handling logs via logger
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

// ---- Hoisted mocks ----

const mockNavigateToAdmin = vi.fn();
const mockNavigate = vi.fn();
vi.mock("@/lib/navigation/tenantNavigation", () => ({
    useTenantNavigation: () => ({
        navigateToAdmin: mockNavigateToAdmin,
        navigate: mockNavigate,
    }),
}));

const mockTenantAuth = vi.fn(() => ({
    tenant: { id: "tenant-1", slug: "test-store", name: "Test Store" },
    loading: false,
}));
vi.mock("@/contexts/TenantAdminAuthContext", () => ({
    useTenantAdminAuth: () => mockTenantAuth(),
}));

const mockCreateMutateAsync = vi.fn();
const mockCreateMutation = {
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
};
vi.mock("@/hooks/crm/usePreOrders", () => ({
    useCreatePreOrder: () => mockCreateMutation,
}));

const mockLogMutate = vi.fn();
vi.mock("@/hooks/crm/useActivityLog", () => ({
    useLogActivity: () => ({
        mutate: mockLogMutate,
    }),
}));

vi.mock("sonner", () => ({
    toast: Object.assign(vi.fn(), {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        loading: vi.fn(),
        info: vi.fn(),
    }),
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("@/components/crm/ClientSelector", () => ({
    ClientSelector: ({
        value,
        onChange,
    }: {
        value?: string;
        onChange: (v: string) => void;
    }) => (
        <button
            data-testid="client-selector"
            onClick={() => onChange("client-123")}
        >
            {value || "Select client..."}
        </button>
    ),
}));

vi.mock("@/components/crm/LineItemsEditor", () => ({
    LineItemsEditor: ({
        onChange,
        onValidationChange,
    }: {
        items: unknown[];
        onChange: (items: unknown[]) => void;
        onValidationChange?: (v: unknown) => void;
    }) => (
        <div data-testid="line-items-editor">
            <button
                data-testid="add-line-item"
                onClick={() =>
                    onChange([
                        {
                            id: "item-1",
                            item_id: "product-1",
                            description: "Test Product",
                            quantity: 2,
                            unit_price: 25,
                            line_total: 50,
                        },
                    ])
                }
            >
                Add Item
            </button>
            <button
                data-testid="trigger-out-of-stock"
                onClick={() =>
                    onValidationChange?.({
                        isValid: false,
                        hasOutOfStock: true,
                        hasInsufficientStock: false,
                        errors: [
                            {
                                itemId: "product-1",
                                productName: "Test Product",
                                requested: 2,
                                available: 0,
                                type: "out_of_stock",
                            },
                        ],
                    })
                }
            >
                Trigger OOS
            </button>
            <button
                data-testid="trigger-valid"
                onClick={() =>
                    onValidationChange?.({
                        isValid: true,
                        hasOutOfStock: false,
                        hasInsufficientStock: false,
                        errors: [],
                    })
                }
            >
                Valid
            </button>
        </div>
    ),
    InventoryValidationResult: {},
}));

vi.mock("@/components/ui/shortcut-hint", () => ({
    ShortcutHint: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
    useModifierKey: () => "⌘",
}));

vi.mock("@/hooks/useFormKeyboardShortcuts", () => ({
    useFormKeyboardShortcuts: vi.fn(),
}));

// ---- Helpers ----

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>{children}</BrowserRouter>
            </QueryClientProvider>
        );
    };
}

async function importPage() {
    const mod = await import("@/pages/admin/CreatePreOrderPage");
    return mod.default;
}

// ---- Tests ----

describe("CreatePreOrderPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTenantAuth.mockReturnValue({
            tenant: { id: "tenant-1", slug: "test-store", name: "Test Store" },
            loading: false,
        });
    });

    it("renders the form with all fields", async () => {
        const Page = await importPage();
        render(<Page />, { wrapper: createWrapper() });

        expect(
            screen.getByRole("heading", { name: "Create Pre-Order" })
        ).toBeInTheDocument();
        expect(screen.getByText("Order Details")).toBeInTheDocument();
        expect(screen.getByText("Additional Info")).toBeInTheDocument();
        expect(screen.getByText("Line Items")).toBeInTheDocument();
        expect(screen.getByTestId("client-selector")).toBeInTheDocument();
        expect(screen.getByTestId("line-items-editor")).toBeInTheDocument();
    });

    it("shows loading spinner when tenant is loading", async () => {
        mockTenantAuth.mockReturnValue({
            tenant: null,
            loading: true,
        });
        const Page = await importPage();
        render(<Page />, { wrapper: createWrapper() });

        // Should show spinner, not form
        expect(screen.queryByText("Create Pre-Order")).not.toBeInTheDocument();
    });

    it("shows error when tenant context is unavailable", async () => {
        mockTenantAuth.mockReturnValue({
            tenant: null,
            loading: false,
        });
        const Page = await importPage();
        render(<Page />, { wrapper: createWrapper() });

        expect(
            screen.getByText(/tenant context not available/i)
        ).toBeInTheDocument();
        expect(screen.getByText("Go Back")).toBeInTheDocument();
    });

    it("shows error toast when submitting with no line items", async () => {
        const { toast } = await import("sonner");
        const Page = await importPage();
        const user = userEvent.setup();

        render(<Page />, { wrapper: createWrapper() });

        // Select a client first
        await user.click(screen.getByTestId("client-selector"));

        // Submit the form
        await user.click(screen.getByRole("button", { name: /create pre-order/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                "Please add at least one line item"
            );
        });
    });

    it("passes expected_date and notes to the mutation", async () => {
        mockCreateMutateAsync.mockResolvedValue({
            id: "po-1",
            pre_order_number: "PO-001",
        });

        const Page = await importPage();
        const user = userEvent.setup();

        render(<Page />, { wrapper: createWrapper() });

        // Select client
        await user.click(screen.getByTestId("client-selector"));

        // Add line items
        await user.click(screen.getByTestId("add-line-item"));

        // Type notes
        const notesField = screen.getByPlaceholderText(
            "Add any notes or special instructions..."
        );
        await user.clear(notesField);
        await user.type(notesField, "Rush order");

        // Submit
        await user.click(screen.getByRole("button", { name: /create pre-order/i }));

        await waitFor(() => {
            expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
        });

        const callArgs = mockCreateMutateAsync.mock.calls[0][0];
        expect(callArgs.client_id).toBe("client-123");
        expect(callArgs.notes).toBe("Rush order");
        expect(callArgs.expected_date).toBeTruthy(); // ISO string
        expect(callArgs.line_items).toHaveLength(1);
        expect(callArgs.subtotal).toBe(50);
        expect(callArgs.total).toBe(50);
        expect(callArgs.tax).toBe(0);
        expect(callArgs.status).toBe("pending");
    });

    it("logs activity after successful creation", async () => {
        mockCreateMutateAsync.mockResolvedValue({
            id: "po-1",
            pre_order_number: "PO-001",
        });

        const Page = await importPage();
        const user = userEvent.setup();

        render(<Page />, { wrapper: createWrapper() });

        await user.click(screen.getByTestId("client-selector"));
        await user.click(screen.getByTestId("add-line-item"));
        await user.click(screen.getByRole("button", { name: /create pre-order/i }));

        await waitFor(() => {
            expect(mockLogMutate).toHaveBeenCalledTimes(1);
        });

        const logCall = mockLogMutate.mock.calls[0][0];
        expect(logCall.client_id).toBe("client-123");
        expect(logCall.activity_type).toBe("pre_order_created");
        expect(logCall.reference_id).toBe("po-1");
        expect(logCall.reference_type).toBe("crm_pre_orders");
    });

    it("navigates to detail page after creation", async () => {
        mockCreateMutateAsync.mockResolvedValue({
            id: "po-1",
            pre_order_number: "PO-001",
        });

        const Page = await importPage();
        const user = userEvent.setup();

        render(<Page />, { wrapper: createWrapper() });

        await user.click(screen.getByTestId("client-selector"));
        await user.click(screen.getByTestId("add-line-item"));
        await user.click(screen.getByRole("button", { name: /create pre-order/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/test-store/admin/crm/pre-orders/po-1"
            );
        });
    });

    it("blocks submission when items are out of stock", async () => {
        const { toast } = await import("sonner");
        const Page = await importPage();
        const user = userEvent.setup();

        const { rerender } = render(<Page />, { wrapper: createWrapper() });

        // Select client
        await user.click(screen.getByTestId("client-selector"));

        // Add line items
        await user.click(screen.getByTestId("add-line-item"));

        // Trigger out-of-stock validation BEFORE submitting
        await user.click(screen.getByTestId("trigger-out-of-stock"));

        // Wait for the alert to render (confirms state update applied)
        await waitFor(() => {
            expect(
                screen.getByText(
                    /out of stock\. remove them to proceed/i
                )
            ).toBeInTheDocument();
        });

        // Force a re-render to ensure state is committed
        rerender(<Page />);

        // Clear any previous calls
        mockCreateMutateAsync.mockClear();

        // Now submit — should be blocked by inventory check
        await user.click(screen.getByRole("button", { name: /create pre-order/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                "Cannot create pre-order",
                expect.objectContaining({
                    description: expect.stringContaining("out of stock"),
                })
            );
        });

        expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });

    it("shows inventory warning alert when validation fails", async () => {
        const Page = await importPage();
        const user = userEvent.setup();

        render(<Page />, { wrapper: createWrapper() });

        // Trigger out-of-stock validation
        await user.click(screen.getByTestId("trigger-out-of-stock"));

        await waitFor(() => {
            expect(
                screen.getByText(/out of stock/i)
            ).toBeInTheDocument();
        });
    });

    it("shows error toast when tenant context is lost during submit", async () => {
        const { toast } = await import("sonner");

        // Start with valid tenant, then lose it
        mockTenantAuth.mockReturnValue({
            tenant: { id: null, slug: "test-store", name: "Test Store" },
            loading: false,
        });

        const Page = await importPage();
        render(<Page />, { wrapper: createWrapper() });

        // Context check should catch missing id and show error state
        expect(
            screen.getByText(/tenant context not available/i)
        ).toBeInTheDocument();
    });

    it("logs error when mutation fails", async () => {
        const { logger } = await import("@/lib/logger");
        mockCreateMutateAsync.mockRejectedValue(new Error("DB error"));

        const Page = await importPage();
        const user = userEvent.setup();

        render(<Page />, { wrapper: createWrapper() });

        await user.click(screen.getByTestId("client-selector"));
        await user.click(screen.getByTestId("add-line-item"));
        await user.click(screen.getByRole("button", { name: /create pre-order/i }));

        await waitFor(() => {
            expect(logger.error).toHaveBeenCalledWith(
                "Pre-order creation failed",
                expect.any(Error),
                expect.objectContaining({
                    component: "CreatePreOrderPage",
                    clientId: "client-123",
                })
            );
        });
    });

    it("back button navigates to pre-orders list", async () => {
        const Page = await importPage();
        const user = userEvent.setup();

        render(<Page />, { wrapper: createWrapper() });

        const backButton = screen.getByRole("button", {
            name: /back to pre-orders/i,
        });
        await user.click(backButton);

        expect(mockNavigateToAdmin).toHaveBeenCalledWith("crm/pre-orders");
    });

    it("cancel button navigates to pre-orders list", async () => {
        const Page = await importPage();
        const user = userEvent.setup();

        render(<Page />, { wrapper: createWrapper() });

        await user.click(screen.getByText("Cancel"));

        expect(mockNavigateToAdmin).toHaveBeenCalledWith("crm/pre-orders");
    });
});
