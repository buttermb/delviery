/**
 * StoreSettings Component Tests
 * Tests for marketplace store settings page
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/test/utils/test-utils";

// Mock useTenantAdminAuth
vi.mock("@/contexts/TenantAdminAuthContext", () => ({
    useTenantAdminAuth: () => ({
        tenant: {
            id: "tenant-123",
            business_name: "Test Dispensary",
        },
    }),
}));

// Mock supabase with factory function (no top-level variable refs)
vi.mock("@/integrations/supabase/client", () => {
    const maybeSingle = vi.fn().mockResolvedValue({
        data: {
            id: "profile-1",
            tenant_id: "tenant-123",
            business_name: "Test Dispensary",
            business_description: "A great store",
            logo_url: null,
            cover_image_url: null,
            marketplace_status: "active",
            can_sell: true,
            shipping_states: ["CA", "NY"],
            shipping_policy: "Ships in 2 days",
            return_policy: "30 day returns",
            created_at: "2024-01-01",
            updated_at: "2024-01-01",
        },
        error: null,
    });

    return {
        supabase: {
            from: vi.fn(() => ({
                select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
                update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle })) })) })),
                insert: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle })) })),
            })),
            storage: {
                from: () => ({
                    upload: vi.fn().mockResolvedValue({ error: null }),
                    getPublicUrl: () => ({ data: { publicUrl: "https://example.com/test.jpg" } }),
                }),
            },
        },
    };
});

// Mock image compression
vi.mock("@/lib/utils/image-compression", () => ({
    compressImage: vi.fn((file: File) => Promise.resolve(file)),
    isCompressibleImage: vi.fn(() => true),
    COMPRESSION_PRESETS: {
        profile: { maxSizeMB: 1, maxWidthOrHeight: 1024 },
        cover: { maxSizeMB: 2, maxWidthOrHeight: 1920 },
    },
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
    },
}));

// Mock humanizeError
vi.mock("@/lib/humanizeError", () => ({
    humanizeError: (_err: unknown, fallback: string) => fallback,
}));

import StoreSettings from "@/pages/admin/marketplace/StoreSettings";

describe("StoreSettings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders store settings page after loading", async () => {
        render(<StoreSettings />);

        await waitFor(() => {
            expect(screen.getByText("Store Settings")).toBeInTheDocument();
        });

        expect(screen.getByText("Save Changes")).toBeInTheDocument();
    });

    it("renders all three tab triggers", async () => {
        render(<StoreSettings />);

        await waitFor(() => {
            expect(screen.getByText("General")).toBeInTheDocument();
        });

        expect(screen.getByText("Branding")).toBeInTheDocument();
        expect(screen.getByText("Policies")).toBeInTheDocument();
    });

    it("renders general tab with business name and description", async () => {
        render(<StoreSettings />);

        await waitFor(() => {
            expect(screen.getByLabelText("Business Name")).toBeInTheDocument();
        });

        const nameInput = screen.getByLabelText("Business Name");
        expect(nameInput).toHaveValue("Test Dispensary");

        expect(screen.getByLabelText("Description")).toBeInTheDocument();
    });

    it("disables save button when no changes are made", async () => {
        render(<StoreSettings />);

        await waitFor(() => {
            expect(screen.getByText("Save Changes")).toBeInTheDocument();
        });

        const saveButton = screen.getByRole("button", { name: /save store settings/i });
        expect(saveButton).toBeDisabled();
    });

    it("enables save button after making a change", async () => {
        render(<StoreSettings />);

        await waitFor(() => {
            expect(screen.getByLabelText("Business Name")).toBeInTheDocument();
        });

        const nameInput = screen.getByLabelText("Business Name");
        fireEvent.change(nameInput, { target: { value: "Updated Store" } });

        const saveButton = screen.getByRole("button", { name: /save store settings/i });
        expect(saveButton).not.toBeDisabled();
    });

    it("shows character count for business name", async () => {
        render(<StoreSettings />);

        await waitFor(() => {
            expect(screen.getByText(/\/100$/)).toBeInTheDocument();
        });
    });

    it("shows character count for description", async () => {
        render(<StoreSettings />);

        await waitFor(() => {
            expect(screen.getByText(/\/2000$/)).toBeInTheDocument();
        });
    });

    it("renders store visibility toggle with active state", async () => {
        render(<StoreSettings />);

        await waitFor(() => {
            expect(screen.getByText("Store Visibility")).toBeInTheDocument();
        });

        expect(screen.getByText("Active")).toBeInTheDocument();
        expect(screen.getByLabelText("Toggle store visibility")).toBeInTheDocument();
    });

    it("does not render payments tab", async () => {
        render(<StoreSettings />);

        await waitFor(() => {
            expect(screen.getByText("Store Settings")).toBeInTheDocument();
        });

        expect(screen.queryByText("Payments")).not.toBeInTheDocument();
    });

    it("has aria labels on interactive elements", async () => {
        render(<StoreSettings />);

        await waitFor(() => {
            expect(screen.getByText("Store Settings")).toBeInTheDocument();
        });

        expect(screen.getByLabelText("Save store settings")).toBeInTheDocument();
        expect(screen.getByLabelText("Toggle store visibility")).toBeInTheDocument();
    });

    it("renders page description text", async () => {
        render(<StoreSettings />);

        await waitFor(() => {
            expect(
                screen.getByText("Configure your public storefront appearance and policies.")
            ).toBeInTheDocument();
        });
    });

    it("has maxLength attribute on business name input", async () => {
        render(<StoreSettings />);

        await waitFor(() => {
            expect(screen.getByLabelText("Business Name")).toBeInTheDocument();
        });

        const nameInput = screen.getByLabelText("Business Name");
        expect(nameInput).toHaveAttribute("maxlength", "100");
    });

    it("has maxLength attribute on description textarea", async () => {
        render(<StoreSettings />);

        await waitFor(() => {
            expect(screen.getByLabelText("Description")).toBeInTheDocument();
        });

        const descInput = screen.getByLabelText("Description");
        expect(descInput).toHaveAttribute("maxlength", "2000");
    });
});
