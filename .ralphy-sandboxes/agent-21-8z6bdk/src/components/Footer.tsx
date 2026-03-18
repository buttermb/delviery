import { Shield, Award, Lock, ChevronDown, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FloraIQLogo from "./FloraIQLogo";

const Footer = () => {
  const [legalOpen, setLegalOpen] = useState(false);
  const navigate = useNavigate();

  const handleScrollToSection = (sectionId: string) => {
    // If we're already on the home page, just scroll
    if (window.location.pathname === '/') {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // Navigate to home first, then scroll
      navigate('/');
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };
  
  return (
    <footer className="bg-background border-t border-border py-8 md:py-12">
      <div className="container px-4 mx-auto">
        {/* Compliance Badges Section */}
        <div className="mb-8 pb-8 border-b border-border">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-foreground">Licensed Vendors</p>
                <p className="text-xs text-muted-foreground">NY State Compliant</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-foreground">Lab Tested</p>
                <p className="text-xs text-muted-foreground">Third-Party Verified</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-foreground">21+ Only</p>
                <p className="text-xs text-muted-foreground">Age Verified</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="space-y-4">
            <FloraIQLogo size="xl" />
            <p className="text-sm text-muted-foreground">
              Smart cannabis operations platform. Premium products from licensed cultivators. Lab-tested. Fast delivery.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-black mb-4 uppercase tracking-wide text-foreground">Shop</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <button 
                  onClick={() => handleScrollToSection('products')} 
                  className="hover:text-primary transition-colors text-left"
                >
                  All Products
                </button>
              </li>
              <li>
                <Link 
                  to="/menu" 
                  className="hover:text-primary transition-colors"
                  onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0)}
                >
                  Menu
                </Link>
              </li>
              <li>
                <Link 
                  to="/track-order" 
                  className="hover:text-primary transition-colors"
                  onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0)}
                >
                  Track Order
                </Link>
              </li>
              <li>
                <Link 
                  to="/cart" 
                  className="hover:text-primary transition-colors"
                  onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0)}
                >
                  Cart
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-black mb-4 uppercase tracking-wide text-foreground">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0)} className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/partner-shops" onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0)} className="hover:text-primary transition-colors">Partner Shops</Link></li>
              <li><Link to="/become-courier" onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0)} className="hover:text-primary transition-colors">Become a Courier</Link></li>
              <li><Link to="/support" onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0)} className="hover:text-primary transition-colors">Support</Link></li>
            </ul>
          </div>

          {/* Support & Contact */}
          <div>
            <h3 className="font-black mb-4 uppercase tracking-wide text-foreground">Support</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/faq" onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0)} className="hover:text-primary transition-colors">FAQ</Link></li>
              <li><Link to="/track-order" onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0)} className="hover:text-primary transition-colors">Track Order</Link></li>
              <li><Link to="/terms" onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0)} className="hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0)} className="hover:text-primary transition-colors">Privacy Policy</Link></li>
            </ul>
            <div className="mt-4 pt-4 border-t border-border space-y-1">
              <p className="font-semibold text-foreground">Contact Us</p>
              <p className="text-xs text-muted-foreground">📞 (555) 123-4567</p>
              <p className="text-xs text-muted-foreground">📧 support@example.com</p>
              <p className="text-xs text-muted-foreground">🕐 8 AM - 10 PM Daily</p>
            </div>
          </div>
        </div>

        <div className="border-t pt-6 md:pt-8 space-y-4">
          {/* Legal Compliance Notice - Collapsible on Mobile */}
          <Collapsible open={legalOpen} onOpenChange={setLegalOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full flex items-center justify-between md:hidden"
              >
                <span className="text-sm font-semibold">Legal Information</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${legalOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="md:!block">
              <div className="bg-muted/50 border border-border rounded-lg p-4 mt-4 md:mt-0">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1 flex-shrink-0">21+</Badge>
                  <div className="text-[11px] text-muted-foreground space-y-2 leading-relaxed">
                    <p className="font-semibold text-foreground">Legal & Compliance Information:</p>
                    <p><strong>Licensed Cannabinoid Hemp Retailer</strong><br/>
                    NY Office of Cannabis Management License #[Pending]</p>
                    <p>All products are derived from hemp and contain less than 0.3% Delta-9 THC on a dry-weight basis, complying with federal and New York State regulations.</p>
                    <p><strong>Age Restriction:</strong> Must be 21+ with valid government ID. ID verification required at delivery.</p>
                    <p><strong>Health Notice:</strong> Products may produce intoxicating effects when heated or consumed. Do not use if pregnant, nursing, or operating vehicles/machinery. May result in positive drug test results.</p>
                    <p><strong>FDA Disclaimer:</strong> These statements have not been evaluated by the FDA. Not intended to diagnose, treat, cure, or prevent any disease.</p>
                    <p><strong>Customer Responsibility:</strong> You are responsible for knowing and complying with all applicable local laws and regulations.</p>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Copyright */}
          <div className="flex flex-col gap-4 text-sm text-muted-foreground">
            {/* Mobile Login Buttons - Prominent */}
            <div className="flex items-center justify-center gap-4 md:hidden py-3 border-t border-border">
              <Link 
                to="/super-admin/login" 
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors active:scale-95 touch-manipulation"
                aria-label="Super Admin Login"
              >
                <UserCog className="w-5 h-5" />
                <span className="text-xs font-medium">Super Admin</span>
              </Link>
            </div>

            {/* Desktop Layout */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-2">
              <div className="flex items-center gap-4">
                <p className="text-center md:text-left">© 2025 Premium Delivery Platform. All rights reserved.</p>
                
                {/* Desktop Hidden Button */}
                <div className="hidden md:flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity">
                  <Link 
                    to="/super-admin/login" 
                    className="p-1 hover:text-primary transition-colors"
                    title="Super Admin Login"
                    aria-label="Super Admin Login"
                  >
                    <UserCog className="w-4 h-4" />
                  </Link>
                </div>
              </div>
              <p className="text-xs font-semibold tracking-wider text-center md:text-right">© 2025 FloraIQ. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
