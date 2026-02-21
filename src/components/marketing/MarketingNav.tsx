import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import FloraIQLogo from "@/components/FloraIQLogo";

export function MarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 transition-all bg-[hsl(var(--marketing-bg))] ${isScrolled ? 'border-b border-[hsl(var(--marketing-border))] shadow-sm' : ''
        }`}
      aria-label="Main navigation"
    >
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-sticky focus:px-4 focus:py-2 focus:bg-[hsl(var(--marketing-primary))] focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <FloraIQLogo size="lg" />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <Link to="/features" className="text-sm text-[hsl(var(--marketing-text-light))] hover:text-[hsl(var(--marketing-text))] transition-colors">
            Features
          </Link>
          <Link to="/pricing" className="text-sm text-[hsl(var(--marketing-text-light))] hover:text-[hsl(var(--marketing-text))] transition-colors">
            Pricing
          </Link>
          <Link to="/about" className="text-sm text-[hsl(var(--marketing-text-light))] hover:text-[hsl(var(--marketing-text))] transition-colors">
            About
          </Link>
          <Link to="/contact" className="text-sm text-[hsl(var(--marketing-text-light))] hover:text-[hsl(var(--marketing-text))] transition-colors">
            Contact
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm" className="text-sm text-[hsl(var(--marketing-text))] hover:bg-[hsl(var(--marketing-primary))]/10 hover:text-[hsl(var(--marketing-primary))]">
              Login
            </Button>
          </Link>
          <Link to="/signup?plan=free">
            <Button size="sm" className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white font-semibold rounded-lg">
              Start Free
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center gap-2">
          <Link to="/signup?plan=free">
            <Button size="sm" className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white text-xs px-3 h-9 rounded-lg">
              Start Free
            </Button>
          </Link>
          <button
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[hsl(var(--marketing-text))]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg))]">
          <div className="container mx-auto px-4 py-4 space-y-1">
            <Link
              to="/features"
              className="block py-3 px-4 text-base font-medium rounded-lg hover:bg-[hsl(var(--marketing-bg-subtle))] text-[hsl(var(--marketing-text))]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link
              to="/pricing"
              className="block py-3 px-4 text-base font-medium rounded-lg hover:bg-[hsl(var(--marketing-bg-subtle))] text-[hsl(var(--marketing-text))]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              to="/about"
              className="block py-3 px-4 text-base font-medium rounded-lg hover:bg-[hsl(var(--marketing-bg-subtle))] text-[hsl(var(--marketing-text))]"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <Link
              to="/contact"
              className="block py-3 px-4 text-base font-medium rounded-lg hover:bg-[hsl(var(--marketing-bg-subtle))] text-[hsl(var(--marketing-text))]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </Link>
            <div className="pt-4 mt-4 border-t border-[hsl(var(--marketing-border))] space-y-3">
              <Link to="/login" className="block" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" size="lg" className="w-full rounded-lg border-[hsl(var(--marketing-border))]">
                  Login
                </Button>
              </Link>
              <Link to="/signup?plan=free" className="block" onClick={() => setMobileMenuOpen(false)}>
                <Button size="lg" className="w-full rounded-lg bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white">
                  Start Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
