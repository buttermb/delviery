import { useNavigate, useParams } from "react-router-dom";
import { TwoFactorVerification } from "@/components/auth/TwoFactorVerification";
import { toast } from "sonner";
import { Shield, Lock } from "lucide-react";
import { logger } from "@/lib/logger";
import { intendedDestinationUtils } from "@/hooks/useIntendedDestination";

type AuthPortal = "tenant-admin" | "super-admin" | "customer";

interface MFAChallengePageProps {
  portal: AuthPortal;
}

export default function MFAChallengePage({ portal }: MFAChallengePageProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const handleVerified = () => {
    logger.info("MFA verification successful", { portal });

    toast.success("Authentication Complete", {
      description: "You have been securely signed in.",
    });

    // Check for intended destination (user tried to access a protected page before login)
    const intendedDestination = intendedDestinationUtils.consume();
    if (intendedDestination) {
      logger.debug('[MFAChallenge] Redirecting to intended destination', { intendedDestination, portal });
      navigate(intendedDestination, { replace: true });
      return;
    }

    // Redirect to appropriate dashboard based on portal
    switch (portal) {
      case "tenant-admin":
        navigate(`/${tenantSlug}/admin/dashboard`, { replace: true });
        break;
      case "super-admin":
        navigate("/super-admin/dashboard", { replace: true });
        break;
      case "customer":
        navigate(`/${tenantSlug}/shop/dashboard`, { replace: true });
        break;
    }
  };

  const handleCancel = () => {
    // Redirect back to login
    switch (portal) {
      case "tenant-admin":
        navigate('/saas/login', { replace: true });
        break;
      case "super-admin":
        navigate("/super-admin/login", { replace: true });
        break;
      case "customer":
        navigate(`/${tenantSlug}/customer/login`, { replace: true });
        break;
    }
  };

  const getPortalTitle = () => {
    switch (portal) {
      case "tenant-admin":
        return "Admin Portal";
      case "super-admin":
        return "Platform Admin";
      case "customer":
        return "Customer Portal";
    }
  };

  const getGradientColors = () => {
    switch (portal) {
      case "tenant-admin":
        return "from-[hsl(var(--tenant-primary))] to-[hsl(var(--tenant-secondary))]";
      case "super-admin":
        return "from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))]";
      case "customer":
        return "from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))]";
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${getGradientColors()} mb-4 shadow-xl`}>
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Verify Your Identity
          </h1>
          <p className="text-slate-400 text-sm">
            {getPortalTitle()} requires two-factor authentication
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
          <TwoFactorVerification
            onVerified={handleVerified}
            onCancel={handleCancel}
          />
        </div>

        {/* Trust indicator */}
        <div className="mt-6 text-center">
          <p className="text-slate-500 text-xs inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Secure two-factor authentication
          </p>
        </div>
      </div>
    </div>
  );
}

