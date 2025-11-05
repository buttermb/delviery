import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function MarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show navbar at top of page
      if (currentScrollY < 10) {
        setIsVisible(true);
      } 
      // Hide when scrolling down, show when scrolling up
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    // Throttle scroll events for better performance
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [lastScrollY]);

  return (
    <motion.nav
      initial={{ y: 0, opacity: 1 }}
      animate={{ 
        y: isVisible ? 0 : -100,
        opacity: isVisible ? 1 : 0,
      }}
      transition={{ 
        duration: 0.3,
        ease: "easeInOut",
      }}
      className="border-b border-[hsl(var(--marketing-border))] backdrop-blur-sm sticky top-0 z-50 bg-[hsl(var(--marketing-bg))]/80"
    >
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

      {/* Mobile Menu with Animation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="md:hidden border-t border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg))] overflow-hidden"
          >
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
              <Link to="/login" className="block" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">
                  Login
                </Button>
              </Link>
              <Link to="/signup" className="block" onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="w-full bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white">
                  Start Free Trial
                </Button>
              </Link>
            </div>
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

