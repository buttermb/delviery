import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FloraIQLogo from "@/components/FloraIQLogo";

export function MarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show nav when scrolled past threshold
      setIsScrolled(currentScrollY > 50);
      
      // Hide/show based on scroll direction
      if (currentScrollY < lastScrollY || currentScrollY < 100) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.nav
          className={`glass-nav border-b border-[hsl(var(--marketing-border))] sticky top-0 z-50 transition-all ${
            isScrolled ? 'shadow-md' : ''
          }`}
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <FloraIQLogo size="lg" />
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

        <div className="hidden md:flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm" className="text-sm">
              Login
            </Button>
          </Link>
          <Link to="/signup">
            <Button size="sm" className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white">
              Start Free →
            </Button>
          </Link>
        </div>

        <div className="flex md:hidden items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm" className="text-sm">
              Login
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
        <motion.div
          className="md:hidden border-t border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg))]"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="container mx-auto px-4 py-4 space-y-1 safe-area-bottom">
            <Link
              to="/features"
              className="block py-3 px-4 text-base font-medium rounded-xl hover:bg-[hsl(var(--marketing-bg-subtle))] hover:text-[hsl(var(--marketing-primary))] transition-colors touch-manipulation active:scale-[0.98]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link
              to="/pricing"
              className="block py-3 px-4 text-base font-medium rounded-xl hover:bg-[hsl(var(--marketing-bg-subtle))] hover:text-[hsl(var(--marketing-primary))] transition-colors touch-manipulation active:scale-[0.98]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              to="/about"
              className="block py-3 px-4 text-base font-medium rounded-xl hover:bg-[hsl(var(--marketing-bg-subtle))] hover:text-[hsl(var(--marketing-primary))] transition-colors touch-manipulation active:scale-[0.98]"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <Link
              to="/contact"
              className="block py-3 px-4 text-base font-medium rounded-xl hover:bg-[hsl(var(--marketing-bg-subtle))] hover:text-[hsl(var(--marketing-primary))] transition-colors touch-manipulation active:scale-[0.98]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </Link>
            <div className="pt-4 mt-4 border-t border-[hsl(var(--marketing-border))] space-y-3">
              <Link to="/login" className="block" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" size="lg" className="w-full min-h-[48px] rounded-xl touch-manipulation active:scale-[0.98]">
                  Login
                </Button>
              </Link>
              <Link to="/signup" className="block" onClick={() => setMobileMenuOpen(false)}>
                <Button size="lg" className="w-full min-h-[48px] rounded-xl bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white touch-manipulation active:scale-[0.98]">
                  Start Free Trial
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

