import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Gift, Truck, Shield, Clock } from "lucide-react";
import { toast } from "sonner";

const FirstVisitorPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [countdown, setCountdown] = useState(3600); // 60 minutes
  const discountCode = "FIRST10FREE";

  useEffect(() => {
    // Premium approach: Only show once per 30 days, 45-second delay, NO exit intent
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return undefined;
    };

    const popupShown = getCookie("discount_popup_shown");
    const codeUsed = getCookie("discount_code_used");

    if (popupShown || codeUsed) {
      return;
    }

    // Show after 45 seconds (premium timing)
    const timer = setTimeout(() => {
      setIsOpen(true);
      // Set cookie for 30 days
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `discount_popup_shown=true; expires=${expires}; path=/; SameSite=Lax`;
    }, 45000); // 45 seconds

    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (isOpen && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isOpen, countdown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleGetCode = () => {
    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Cookie-based email deduplication (30-day tracking)
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
    };

    const usedEmailsStr = getCookie("used_discount_emails") || "[]";
    const usedEmails = JSON.parse(decodeURIComponent(usedEmailsStr));
    
    if (usedEmails.includes(email)) {
      toast.error("This email has already been used for a discount");
      return;
    }

    usedEmails.push(email);
    
    // Set cookies with 30-day expiry
    const expires30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `used_discount_emails=${encodeURIComponent(JSON.stringify(usedEmails))}; expires=${expires30Days}; path=/`;
    document.cookie = `discount_email_provided=${encodeURIComponent(email)}; expires=${expires30Days}; path=/`;
    document.cookie = `device_discount_used=${encodeURIComponent(navigator.userAgent)}; expires=${expires30Days}; path=/`;

    setShowCode(true);
    toast.success("Discount code revealed! Use at checkout");
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(discountCode);
    toast.success("Code copied to clipboard!");
  };

  const handleClose = () => {
    setIsOpen(false);
    // Set dismissal cookie for 30 days
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `discount_popup_shown=true; expires=${expires}; path=/; SameSite=Lax`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Welcome - Get 10% Off</DialogTitle>
        <DialogDescription className="sr-only">Join our community and get 10% off plus free delivery on your first order</DialogDescription>
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-all hover:rotate-90"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="bg-gradient-to-br from-background via-background to-primary/5 p-8 text-center">
          <div className="mb-4">
            <Gift className="w-12 h-12 mx-auto text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-2">Welcome to Our Community</h2>
          <div className="inline-block bg-primary/10 text-primary px-6 py-3 rounded-full text-xl font-bold my-4 border border-primary/20">
            10% OFF + FREE DELIVERY
          </div>
          <p className="text-muted-foreground">Join 10,000+ members enjoying exclusive benefits</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 font-bold">✓</span>
              </div>
              <span>Member-exclusive pricing on all products</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Truck className="w-3 h-3 text-primary" />
              </div>
              <span>Free delivery, always</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-3 h-3 text-primary" />
              </div>
              <span>Track all your orders effortlessly</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-3 h-3 text-primary" />
              </div>
              <span>Early access to new products</span>
            </div>
          </div>

          {!showCode ? (
            <div className="space-y-3 pt-2">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleGetCode()}
                className="h-12"
              />
              <Button onClick={handleGetCode} className="w-full h-12 text-lg font-bold">
                Become a Member
              </Button>
            </div>
          ) : (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Your exclusive member code:</p>
              <div className="text-2xl font-bold text-primary tracking-wider">
                {discountCode}
              </div>
              <Button onClick={handleCopyCode} variant="outline" className="w-full">
                Copy Code
              </Button>
              <p className="text-xs text-primary font-semibold">Use at checkout for 10% off</p>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground pt-2">
            Free shipping • Secure checkout • Premium quality
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FirstVisitorPopup;
