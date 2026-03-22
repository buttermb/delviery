/**
 * AddPaymentMethodDialog Tests
 * Verifies tenant_id validation and correct API call behavior
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
    supabase: {
        functions: {
            invoke: vi.fn(),
        },
    },
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock sonner
vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

import { AddPaymentMethodDialog } from "@/components/billing/AddPaymentMethodDialog";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

const mockInvoke = vi.mocked(supabase.functions.invoke);
const mockLogger = vi.mocked(logger);
const mockToast = vi.mocked(toast);

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}

describe("AddPaymentMethodDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders dialog when open", () => {
        render(
            <AddPaymentMethodDialog
                open={true}
                onOpenChange={vi.fn()}
                tenantId="tenant-123"
            />,
            { wrapper: createWrapper() },
        );

        expect(screen.getByRole("heading", { name: /Add Payment Method/ })).toBeInTheDocument();
        expect(
            screen.getByText(/Add a payment method to ensure uninterrupted service/),
        ).toBeInTheDocument();
    });

    it("does not render dialog when closed", () => {
        render(
            <AddPaymentMethodDialog
                open={false}
                onOpenChange={vi.fn()}
                tenantId="tenant-123"
            />,
            { wrapper: createWrapper() },
        );

        expect(screen.queryByText("Add Payment Method")).not.toBeInTheDocument();
    });

    it("disables submit button when tenantId is empty", () => {
        render(
            <AddPaymentMethodDialog
                open={true}
                onOpenChange={vi.fn()}
                tenantId=""
            />,
            { wrapper: createWrapper() },
        );

        const submitButton = screen.getByRole("button", { name: "Add Payment Method" });
        expect(submitButton).toBeDisabled();
    });

    it("does not call API when tenantId is empty", async () => {
        const user = userEvent.setup();

        render(
            <AddPaymentMethodDialog
                open={true}
                onOpenChange={vi.fn()}
                tenantId=""
            />,
            { wrapper: createWrapper() },
        );

        const submitButton = screen.getByRole("button", { name: "Add Payment Method" });
        await user.click(submitButton);

        expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("passes correct tenant_id to create-setup-session", async () => {
        const user = userEvent.setup();
        mockInvoke.mockResolvedValue({
            data: { url: "https://checkout.stripe.com/test" },
            error: null,
        });

        // Mock window.location to prevent navigation
        const originalLocation = window.location;
        Object.defineProperty(window, "location", {
            writable: true,
            value: { ...originalLocation, href: "http://localhost:3000/billing" },
        });

        render(
            <AddPaymentMethodDialog
                open={true}
                onOpenChange={vi.fn()}
                tenantId="tenant-abc-123"
            />,
            { wrapper: createWrapper() },
        );

        const submitButton = screen.getByRole("button", { name: "Add Payment Method" });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockInvoke).toHaveBeenCalledWith("create-setup-session", {
                body: {
                    tenant_id: "tenant-abc-123",
                    return_url: "http://localhost:3000/billing",
                },
            });
        });

        // Restore window.location
        Object.defineProperty(window, "location", {
            writable: true,
            value: originalLocation,
        });
    });

    it("shows error toast when API call fails", async () => {
        const user = userEvent.setup();
        mockInvoke.mockResolvedValue({
            data: null,
            error: new Error("Network error"),
        });

        render(
            <AddPaymentMethodDialog
                open={true}
                onOpenChange={vi.fn()}
                tenantId="tenant-123"
            />,
            { wrapper: createWrapper() },
        );

        const submitButton = screen.getByRole("button", { name: "Add Payment Method" });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockLogger.error).toHaveBeenCalledWith(
                "Failed to create payment setup session",
                expect.anything(),
                expect.objectContaining({ component: "AddPaymentMethodDialog", tenantId: "tenant-123" }),
            );
            expect(mockToast.error).toHaveBeenCalledWith("Error", {
                description: "Failed to set up payment method. Please try again.",
            });
        });
    });

    it("shows error toast when no URL is returned", async () => {
        const user = userEvent.setup();
        mockInvoke.mockResolvedValue({
            data: { url: null },
            error: null,
        });

        render(
            <AddPaymentMethodDialog
                open={true}
                onOpenChange={vi.fn()}
                tenantId="tenant-123"
            />,
            { wrapper: createWrapper() },
        );

        const submitButton = screen.getByRole("button", { name: "Add Payment Method" });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalled();
        });
    });

    it("calls onSuccess before redirecting", async () => {
        const user = userEvent.setup();
        const onSuccess = vi.fn();
        mockInvoke.mockResolvedValue({
            data: { url: "https://checkout.stripe.com/test" },
            error: null,
        });

        const originalLocation = window.location;
        Object.defineProperty(window, "location", {
            writable: true,
            value: { ...originalLocation, href: "http://localhost:3000/billing" },
        });

        render(
            <AddPaymentMethodDialog
                open={true}
                onOpenChange={vi.fn()}
                tenantId="tenant-123"
                onSuccess={onSuccess}
            />,
            { wrapper: createWrapper() },
        );

        const submitButton = screen.getByRole("button", { name: "Add Payment Method" });
        await user.click(submitButton);

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalled();
        });

        Object.defineProperty(window, "location", {
            writable: true,
            value: originalLocation,
        });
    });

    it("calls onOpenChange when Remind Me Later is clicked", async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();

        render(
            <AddPaymentMethodDialog
                open={true}
                onOpenChange={onOpenChange}
                tenantId="tenant-123"
            />,
            { wrapper: createWrapper() },
        );

        const laterButton = screen.getByRole("button", { name: "Remind Me Later" });
        await user.click(laterButton);

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
