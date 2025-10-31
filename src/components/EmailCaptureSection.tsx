import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Gift } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

const EmailCaptureSection = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);
    
    // Store email in localStorage for now
    const subscribers = JSON.parse(localStorage.getItem("newsletter_subscribers") || "[]");
    if (!subscribers.includes(email)) {
      subscribers.push(email);
      localStorage.setItem("newsletter_subscribers", JSON.stringify(subscribers));
      toast.success("Thanks for subscribing! Check your inbox for a special offer 🎁");
      setEmail("");
    } else {
      toast.info("You're already subscribed!");
    }
    
    setLoading(false);
  };

  return (
    <section className="py-20 bg-gradient-to-br from-primary/10 via-accent/10 to-background">
      <div className="container px-4 mx-auto">
        <Card className="max-w-3xl mx-auto p-8 md:p-12 border-2 border-primary/20 shadow-elegant">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-primary flex items-center justify-center">
              <Gift className="w-8 h-8 text-white" />
            </div>
            
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                Get Exclusive Deals & Updates
              </h2>
              <p className="text-muted-foreground text-lg">
                Subscribe to our newsletter and get <span className="text-primary font-bold">15% OFF</span> your next order
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                />
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="h-12 px-8 font-bold"
                variant="hero"
              >
                {loading ? "Subscribing..." : "Subscribe"}
              </Button>
            </form>

            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                ✓ Exclusive discounts
              </span>
              <span className="flex items-center gap-1">
                ✓ New product alerts
              </span>
              <span className="flex items-center gap-1">
                ✓ Cannabis education
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              We respect your privacy. Unsubscribe at any time.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
};

export default EmailCaptureSection;
