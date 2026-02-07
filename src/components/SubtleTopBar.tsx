import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const SubtleTopBar = () => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [email, setEmail] = useState("");
  const [showCode, setShowCode] = useState(false);

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return undefined;
  };

  const topBarDismissed = getCookie("top_bar_dismissed");
  const hasCode = getCookie("discount_code_used");

  if (isDismissed || topBarDismissed || hasCode) return null;

  const handleGetCode = () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email");
      return;
    }

    setShowCode(true);
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `discount_code_used=true; expires=${expires}; path=/; SameSite=Lax`;
    toast.success("Code copied to clipboard!");
    navigator.clipboard.writeText("FIRST10FREE");
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `top_bar_dismissed=true; expires=${expires}; path=/; SameSite=Lax`;
  };

  return (
    <div className="bg-primary/5 border-b border-primary/10">
      <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-3 relative">
        {!showCode ? (
          <>
            <span className="text-xs sm:text-sm">New member? Get 10% off</span>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleGetCode()}
              className="h-7 text-xs w-32 sm:w-40"
            />
            <Button onClick={handleGetCode} size="sm" className="h-7 text-xs px-3">
              Get Code
            </Button>
          </>
        ) : (
          <>
            <span className="text-xs sm:text-sm">Code: <span className="font-bold text-primary">FIRST10FREE</span></span>
            <span className="text-xs text-muted-foreground">✓ Copied</span>
          </>
        )}
        <button
          onClick={handleDismiss}
          className="absolute right-2 w-4 h-4 rounded-full hover:bg-muted/50 flex items-center justify-center"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default SubtleTopBar;
