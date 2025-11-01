import { ReactNode } from "react";
import { useAuthError } from "@/hooks/useAuthError";
import { AuthStatusBadge } from "@/components/auth/AuthStatusBadge";

interface AppShellProps {
  children: ReactNode;
}

/**
 * App Shell Component
 * Provides global auth error handling and status display
 */
export function AppShell({ children }: AppShellProps) {
  // Enable global auth error handling
  useAuthError();

  return (
    <>
      {/* Optional: Add auth status badge to header */}
      <div className="fixed top-4 right-4 z-50">
        <AuthStatusBadge />
      </div>
      {children}
    </>
  );
}

