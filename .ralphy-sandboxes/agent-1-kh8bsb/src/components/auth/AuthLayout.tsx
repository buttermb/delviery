import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import FloraIQLogo from '@/components/FloraIQLogo';

interface AuthLayoutProps {
  children: ReactNode;
  /** Optional background image URL */
  backgroundImage?: string;
  /** Show decorative background pattern (default: true) */
  showPattern?: boolean;
  /** Additional class names for the outer container */
  className?: string;
  /** Additional class names for the card wrapper */
  cardClassName?: string;
}

export function AuthLayout({
  children,
  backgroundImage,
  showPattern = true,
  className,
  cardClassName,
}: AuthLayoutProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-dvh flex-col items-center justify-between bg-background',
        className
      )}
    >
      {/* Background image */}
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10"
          style={{ backgroundImage: `url(${backgroundImage})` }}
          aria-hidden="true"
        />
      )}

      {/* Background pattern */}
      {showPattern && !backgroundImage && (
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0 opacity-[0.03]">
            <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id="auth-grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#auth-grid)" />
            </svg>
          </div>
          {/* Decorative gradient blobs */}
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent/5 blur-3xl" />
        </div>
      )}

      {/* Main content area */}
      <main id="main-content" tabIndex={-1} className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-8 focus:outline-none">
        {/* Logo */}
        <div className="mb-8">
          <FloraIQLogo size="lg" />
        </div>

        {/* Auth card */}
        <Card
          className={cn(
            'w-full max-w-md border-border/50 bg-card/95 p-6 shadow-lg backdrop-blur-sm sm:p-8',
            cardClassName
          )}
        >
          {children}
        </Card>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md flex-col items-center gap-2 px-4 py-4 sm:flex-row sm:justify-center sm:gap-4">
          <a
            href="/terms"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Terms of Service
          </a>
          <span className="hidden text-muted-foreground/50 sm:inline" aria-hidden="true">
            &middot;
          </span>
          <a
            href="/privacy"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Privacy Policy
          </a>
          <span className="hidden text-muted-foreground/50 sm:inline" aria-hidden="true">
            &middot;
          </span>
          <a
            href="/support"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Support
          </a>
        </div>
      </footer>
    </div>
  );
}
