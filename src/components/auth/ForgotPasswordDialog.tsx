import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Mail, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { requestSuperAdminPasswordReset, requestTenantAdminPasswordReset, requestCustomerPasswordReset } from "@/utils/passwordReset";
import { useCsrfToken } from "@/hooks/useCsrfToken";
import { logger } from "@/lib/logger";

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;
const COOLDOWN_MS = 30_000; // 30 second cooldown after hitting limit

interface ForgotPasswordDialogProps {
  userType: "super_admin" | "tenant_admin" | "customer";
  tenantSlug?: string;
  trigger?: React.ReactNode;
}

export function ForgotPasswordDialog({ userType, tenantSlug, trigger }: ForgotPasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const { validateToken } = useCsrfToken();

  const requestTimestamps = useRef<number[]>([]);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimer.current) {
        clearInterval(cooldownTimer.current);
      }
    };
  }, []);

  const startCooldown = useCallback(() => {
    setRateLimited(true);
    setCooldownRemaining(Math.ceil(COOLDOWN_MS / 1000));

    if (cooldownTimer.current) {
      clearInterval(cooldownTimer.current);
    }

    cooldownTimer.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          setRateLimited(false);
          if (cooldownTimer.current) {
            clearInterval(cooldownTimer.current);
            cooldownTimer.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const isRateLimited = useCallback((): boolean => {
    const now = Date.now();
    // Remove timestamps outside the window
    requestTimestamps.current = requestTimestamps.current.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );

    if (requestTimestamps.current.length >= MAX_REQUESTS_PER_WINDOW) {
      logger.debug("Password reset rate limit reached");
      startCooldown();
      return true;
    }

    return false;
  }, [startCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateToken()) {
      toast({
        variant: "destructive",
        title: "Security Error",
        description: "Invalid security token. Please refresh the page and try again.",
      });
      return;
    }

    if (isRateLimited()) {
      return;
    }

    // Track this request for rate limiting
    requestTimestamps.current.push(Date.now());

    setLoading(true);

    try {
      let result;
      if (userType === "super_admin") {
        result = await requestSuperAdminPasswordReset(email);
      } else if (userType === "tenant_admin") {
        if (!tenantSlug) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Tenant slug is required",
          });
          setLoading(false);
          return;
        }
        result = await requestTenantAdminPasswordReset(email, tenantSlug);
      } else {
        if (!tenantSlug) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Tenant slug is required",
          });
          setLoading(false);
          return;
        }
        result = await requestCustomerPasswordReset(email, tenantSlug);
      }

      if (result.success) {
        toast({
          title: "Reset Email Sent",
          description: result.message,
        });
        setOpen(false);
        setEmail("");
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message,
        });
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send reset email",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm">
            Forgot password?
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Enter your email address and we'll send you a link to reset your password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || rateLimited}
              inputMode="email"
              enterKeyHint="send"
              autoComplete="email"
            />
          </div>

          {rateLimited && (
            <div className="flex items-center gap-2 text-sm text-destructive" role="alert">
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span>Try again in {cooldownRemaining} seconds</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading || rateLimited}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Sending...
              </>
            ) : rateLimited ? (
              <>
                <Clock className="mr-2 h-4 w-4" aria-hidden="true" />
                Try again in {cooldownRemaining}s
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                Send Reset Link
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

