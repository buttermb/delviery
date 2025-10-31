import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "signin" | "signup";
  onModeChange: (mode: "signin" | "signup") => void;
}

const AuthModal = ({ open, onOpenChange, mode, onModeChange }: AuthModalProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(email) || email.length > 255) {
      newErrors.email = "Invalid email format";
    }

    // Password security validation
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (!/[a-zA-Z]/.test(password)) {
      newErrors.password = "Password must contain at least one letter";
    } else if (!/[0-9]/.test(password)) {
      newErrors.password = "Password must contain at least one number";
    }

    if (mode === "signup") {
      // Full name validation
      if (!fullName || fullName.trim().length === 0) {
        newErrors.fullName = "Full name is required";
      } else if (fullName.trim().length > 100) {
        newErrors.fullName = "Full name must be less than 100 characters";
      }

      // Confirm password
      if (password !== confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }

      // Phone validation (required for signup)
      if (!phone) {
        newErrors.phone = "Phone number is required";
      } else {
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone.replace(/\D/g, ""))) {
          newErrors.phone = "Phone must be 10 digits";
        }
      }

      // Age confirmation
      if (!ageConfirmed) {
        newErrors.ageConfirmed = "You must confirm you are 21 or older";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        // Sign up the user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (signUpError) throw signUpError;

        // Create profile with all user info
        if (authData.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: authData.user.id,
              full_name: fullName.trim(),
              phone: phone.replace(/\D/g, ''),
            });

          if (profileError) {
            console.error('Profile creation error:', profileError);
            // Don't throw - user is created, profile can be updated later
          }
        }

        toast.success("Account created successfully! Please check your email to confirm.");
        onOpenChange(false);
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setFullName("");
        setPhone("");
        setAgeConfirmed(false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        
        if (!data.session) {
          throw new Error("Failed to create session");
        }

        toast.success("Signed in successfully!");
        setEmail("");
        setPassword("");
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {mode === "signin" ? "Sign In" : "Create Account"}
          </DialogTitle>
          <DialogDescription>
            {mode === "signin"
              ? "Sign in to your account to start ordering"
              : "Create an account to order premium products"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors({ ...errors, email: "" });
              }}
              className={cn("h-11 transition-colors", errors.email && "border-destructive focus-visible:ring-destructive")}
              autoFocus
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1.5 flex items-start gap-1">
                <span className="text-destructive">⚠</span>
                <span>{errors.email}</span>
              </p>
            )}
          </div>

          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setErrors({ ...errors, fullName: "" });
                  }}
                  className={cn("h-11 transition-colors", errors.fullName && "border-destructive focus-visible:ring-destructive")}
                />
                {errors.fullName && (
                  <p className="text-xs text-destructive mt-1.5 flex items-start gap-1">
                    <span className="text-destructive">⚠</span>
                    <span>{errors.fullName}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="numeric"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setErrors({ ...errors, phone: "" });
                  }}
                  className={cn("h-11 transition-colors", errors.phone && "border-destructive focus-visible:ring-destructive")}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive mt-1.5 flex items-start gap-1">
                    <span className="text-destructive">⚠</span>
                    <span>{errors.phone}</span>
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors({ ...errors, password: "" });
                }}
                className={cn("h-11 pr-10 transition-colors", errors.password && "border-destructive focus-visible:ring-destructive")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive mt-1.5 flex items-start gap-1">
                <span className="text-destructive">⚠</span>
                <span>{errors.password}</span>
              </p>
            )}
            {mode === "signup" && !errors.password && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Must be at least 8 characters with a letter and number
              </p>
            )}
          </div>

          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrors({ ...errors, confirmPassword: "" });
                }}
                className={cn("h-11 transition-colors", errors.confirmPassword && "border-destructive focus-visible:ring-destructive")}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive mt-1.5 flex items-start gap-1">
                  <span className="text-destructive">⚠</span>
                  <span>{errors.confirmPassword}</span>
                </p>
              )}
            </div>
          )}

          {mode === "signup" && (
            <div className="space-y-2">
              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-muted/30">
                <Checkbox
                  id="age"
                  checked={ageConfirmed}
                  onCheckedChange={(checked) => {
                    setAgeConfirmed(checked as boolean);
                    setErrors({ ...errors, ageConfirmed: "" });
                  }}
                  className="mt-0.5"
                />
                <Label htmlFor="age" className="text-sm font-normal cursor-pointer leading-relaxed">
                  I confirm I am 21 years or older
                </Label>
              </div>
              {errors.ageConfirmed && (
                <p className="text-xs text-destructive mt-1.5 flex items-start gap-1">
                  <span className="text-destructive">⚠</span>
                  <span>{errors.ageConfirmed}</span>
                </p>
              )}
            </div>
          )}

          <Button type="submit" variant="hero" className="w-full h-11 text-base font-medium" disabled={loading}>
            {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </Button>

          <div className="text-center text-sm">
            {mode === "signin" ? (
              <span>
                Don't have an account?{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => onModeChange("signup")}
                >
                  Sign up
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => onModeChange("signin")}
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
