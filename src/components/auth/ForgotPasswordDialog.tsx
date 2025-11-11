import { useState } from "react";
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
import { Loader2, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { requestSuperAdminPasswordReset, requestTenantAdminPasswordReset, requestCustomerPasswordReset } from "@/utils/passwordReset";

interface ForgotPasswordDialogProps {
  userType: "super_admin" | "tenant_admin" | "customer";
  tenantSlug?: string;
  trigger?: React.ReactNode;
}

export function ForgotPasswordDialog({ userType, tenantSlug, trigger }: ForgotPasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          <button className="text-sm text-muted-foreground hover:text-foreground">
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
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Reset Link
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

