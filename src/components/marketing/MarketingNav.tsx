import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export function MarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="border-b border-[hsl(var(--marketing-border))] backdrop-blur-sm sticky top-0 z-50 bg-white/80">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold text-[hsl(var(--marketing-text))]">
          Dev<span className="text-[hsl(var(--marketing-primary))]">Panel</span>
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/features" className="text-sm hover:text-[hsl(var(--marketing-primary))] transition-colors">
            Features
          </Link>
          <Link to="/pricing" className="text-sm hover:text-[hsl(var(--marketing-primary))] transition-colors">
            Pricing
          </Link>
          <Link to="/about" className="text-sm hover:text-[hsl(var(--marketing-primary))] transition-colors">
            About
          </Link>
          <Link to="/contact" className="text-sm hover:text-[hsl(var(--marketing-primary))] transition-colors">
            Contact
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/admin/login" className="hidden md:block">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link to="/signup">
            <Button size="sm" className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white">
              Start Free →
            </Button>
          </Link>
          
          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[hsl(var(--marketing-border))] bg-white">
          <div className="container mx-auto px-4 py-4 space-y-4">
            <Link
              to="/features"
              className="block text-sm hover:text-[hsl(var(--marketing-primary))] transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link
              to="/pricing"
              className="block text-sm hover:text-[hsl(var(--marketing-primary))] transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              to="/about"
              className="block text-sm hover:text-[hsl(var(--marketing-primary))] transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <Link
              to="/contact"
              className="block text-sm hover:text-[hsl(var(--marketing-primary))] transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </Link>
            <div className="pt-4 border-t border-[hsl(var(--marketing-border))] space-y-2">
              <Link to="/admin/login" className="block">
                <Button variant="ghost" size="sm" className="w-full">Sign In</Button>
              </Link>
              <Link to="/signup" className="block">
                <Button size="sm" className="w-full bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white">
                  Start Free Trial
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

