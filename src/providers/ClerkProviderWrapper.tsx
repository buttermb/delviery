import { logger } from '@/lib/logger';
/**
 * Clerk Provider Wrapper
 * Wraps the application with Clerk authentication provider
 * Handles theming and loading states
 */
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingFallback } from '@/components/LoadingFallback';

// Get Clerk publishable key from environment
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

interface ClerkProviderWrapperProps {
  children: ReactNode;
}

/**
 * ClerkProviderWrapper - Main authentication provider
 * 
 * Features:
 * - Automatic theme detection (light/dark)
 * - Custom routing integration with React Router
 * - Loading state handling
 * - Appearance customization matching app theme
 */
export function ClerkProviderWrapper({ children }: ClerkProviderWrapperProps) {
  const navigate = useNavigate();
  
  // If Clerk is not configured, render children without auth
  if (!CLERK_PUBLISHABLE_KEY) {
    logger.debug('[Clerk] No publishable key found. Auth features disabled.');
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      appearance={{
        baseTheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? dark : undefined,
        variables: {
          colorPrimary: 'hsl(142.1 76.2% 36.3%)', // emerald-600
          colorBackground: 'hsl(0 0% 100%)',
          colorInputBackground: 'hsl(0 0% 100%)',
          colorInputText: 'hsl(222.2 84% 4.9%)',
          colorText: 'hsl(222.2 84% 4.9%)',
          borderRadius: '0.5rem',
          fontFamily: 'Inter, system-ui, sans-serif',
        },
        elements: {
          // Card styling
          card: 'shadow-xl border border-border rounded-xl',
          // Form elements
          formButtonPrimary: 
            'bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-semibold shadow-lg transition-all',
          formFieldInput: 
            'border-2 border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg',
          formFieldLabel: 'text-foreground font-medium',
          // Social buttons
          socialButtonsBlockButton: 
            'border-2 border-input hover:bg-muted transition-colors rounded-lg',
          socialButtonsBlockButtonText: 'font-medium',
          // Header
          headerTitle: 'text-2xl font-bold text-foreground',
          headerSubtitle: 'text-muted-foreground',
          // Footer
          footerActionLink: 'text-primary hover:text-primary/80 font-medium',
          // Divider
          dividerLine: 'bg-border',
          dividerText: 'text-muted-foreground text-sm',
          // Identity preview
          identityPreviewText: 'text-foreground',
          identityPreviewEditButton: 'text-primary hover:text-primary/80',
          // User button
          userButtonPopoverCard: 'shadow-xl border border-border rounded-xl',
          userButtonPopoverActionButton: 'hover:bg-muted rounded-lg',
          userButtonPopoverActionButtonText: 'text-foreground',
          userButtonPopoverFooter: 'hidden',
          // Avatar
          avatarBox: 'ring-2 ring-primary/20',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}

/**
 * Hook to check if Clerk is configured
 */
export function useClerkConfigured(): boolean {
  return !!CLERK_PUBLISHABLE_KEY;
}

