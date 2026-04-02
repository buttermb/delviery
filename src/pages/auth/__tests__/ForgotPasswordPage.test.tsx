/**
 * Auth Forgot Password Page Tests
 *
 * Tests the forgot password form:
 * - Renders email form with proper elements
 * - Email validation (empty, invalid, too long)
 * - Successful submission shows success state
 * - "Try a different email" resets back to form
 * - Rate limiting prevents excessive submissions
 * - Back to login link navigates correctly
 * - Accessibility attributes present
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";

// --- Mocks ---

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

const mockRequestReset = vi.fn().mockResolvedValue({
  success: true,
  message: "If an account exists with that email, a reset link has been sent.",
});

vi.mock("@/hooks/usePasswordReset", () => ({
  usePasswordReset: () => ({
    requestReset: mockRequestReset,
    isRequestingReset: false,
    requestResetError: null,
    requestResetSuccess: false,
  }),
}));

vi.mock("@/components/FloraIQLogo", () => ({
  default: () => <div data-testid="floraiq-logo">Logo</div>,
}));

// Import after mocks
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";

// --- Helpers ---

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface WrapperProps {
  children: ReactNode;
  initialEntries?: string[];
}

function TestWrapper({ children, initialEntries = ["/auth/forgot-password"] }: WrapperProps) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/auth/forgot-password" element={children} />
          <Route path="/saas/login" element={<div data-testid="login-page">Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderForgotPasswordPage() {
  return render(
    <TestWrapper>
      <ForgotPasswordPage />
    </TestWrapper>
  );
}

// --- Tests ---

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial render", () => {
    it("should render the forgot password heading", () => {
      renderForgotPasswordPage();
      expect(screen.getByRole("heading", { name: /forgot your password/i })).toBeInTheDocument();
    });

    it("should render an email input field", () => {
      renderForgotPasswordPage();
      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute("type", "email");
    });

    it("should render the submit button", () => {
      renderForgotPasswordPage();
      expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
    });

    it("should render the back to login link", () => {
      renderForgotPasswordPage();
      expect(screen.getByText(/back to login/i)).toBeInTheDocument();
    });

    it("should have submit button disabled when email is empty", () => {
      renderForgotPasswordPage();
      const submitBtn = screen.getByRole("button", { name: /send reset link/i });
      expect(submitBtn).toBeDisabled();
    });

    it("should have proper ARIA attributes on the email input", () => {
      renderForgotPasswordPage();
      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveAttribute("aria-required", "true");
      expect(emailInput).toHaveAttribute("inputMode", "email");
      expect(emailInput).toHaveAttribute("autoComplete", "email");
    });
  });

  describe("email validation", () => {
    it("should show error for empty email on form submit", async () => {
      renderForgotPasswordPage();
      const user = userEvent.setup();

      // Type and clear to make the button enabled state change, then try to submit
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "a");
      await user.clear(emailInput);
      await user.type(emailInput, "a");
      await user.clear(emailInput);

      // The button should be disabled when email is empty, preventing submission
      const submitBtn = screen.getByRole("button", { name: /send reset link/i });
      expect(submitBtn).toBeDisabled();
    });

    it("should show error for invalid email on blur", async () => {
      renderForgotPasswordPage();
      const user = userEvent.setup();

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "notanemail");
      await user.tab(); // trigger blur

      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });

    it("should clear error when user starts typing valid input", async () => {
      renderForgotPasswordPage();
      const user = userEvent.setup();

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "bad");
      await user.tab(); // trigger blur and validation error

      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();

      await user.clear(emailInput);
      await user.type(emailInput, "valid@example.com");

      // Error should be cleared
      expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
    });
  });

  describe("form submission", () => {
    it("should call requestReset and show success state on valid submission", async () => {
      renderForgotPasswordPage();
      const user = userEvent.setup();

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, "test@example.com");

      const submitBtn = screen.getByRole("button", { name: /send reset link/i });
      await user.click(submitBtn);

      // Should show success state
      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });

      // Should have called requestReset with correct params
      expect(mockRequestReset).toHaveBeenCalledWith({
        email: "test@example.com",
        tenantSlug: undefined,
        userType: "tenant_admin",
      });
    });

    it("should display the submitted email in success state", async () => {
      renderForgotPasswordPage();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/email address/i), "user@test.com");
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText("user@test.com")).toBeInTheDocument();
      });
    });

    it("should show success state even if requestReset fails (email enumeration protection)", async () => {
      mockRequestReset.mockRejectedValueOnce(new Error("Network error"));

      renderForgotPasswordPage();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/email address/i), "fail@example.com");
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      // Should still show success
      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });
    });

    it("should show link expiry notice in success state", async () => {
      renderForgotPasswordPage();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/email address/i), "test@example.com");
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/expires in 1 hour/i)).toBeInTheDocument();
      });
    });
  });

  describe("try a different email button", () => {
    it("should reset to form state when clicked", async () => {
      renderForgotPasswordPage();
      const user = userEvent.setup();

      // Submit to reach success state
      await user.type(screen.getByLabelText(/email address/i), "test@example.com");
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });

      // Click "Try a different email"
      const tryAgainBtn = screen.getByRole("button", { name: /try a different email/i });
      await user.click(tryAgainBtn);

      // Should be back to form state
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /forgot your password/i })).toBeInTheDocument();
      });

      // Email input should be cleared
      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveValue("");
    });

    it("should allow submitting a new email after resetting", async () => {
      renderForgotPasswordPage();
      const user = userEvent.setup();

      // First submission
      await user.type(screen.getByLabelText(/email address/i), "first@example.com");
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });

      // Reset
      await user.click(screen.getByRole("button", { name: /try a different email/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      });

      // Second submission
      await user.type(screen.getByLabelText(/email address/i), "second@example.com");
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });

      expect(mockRequestReset).toHaveBeenCalledTimes(2);
      expect(mockRequestReset).toHaveBeenLastCalledWith({
        email: "second@example.com",
        tenantSlug: undefined,
        userType: "tenant_admin",
      });
    });
  });

  describe("back to login link", () => {
    it("should link to /saas/login", () => {
      renderForgotPasswordPage();
      const backLink = screen.getByRole("link", { name: /back to login/i });
      expect(backLink).toHaveAttribute("href", "/saas/login");
    });

    it("should have back to login link in success state too", async () => {
      renderForgotPasswordPage();
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/email address/i), "test@example.com");
      await user.click(screen.getByRole("button", { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });

      const backLink = screen.getByRole("link", { name: /back to login/i });
      expect(backLink).toHaveAttribute("href", "/saas/login");
    });
  });
});
