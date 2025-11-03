import { Link } from "react-router-dom";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[hsl(var(--marketing-border))] mt-20 bg-[hsl(var(--marketing-bg-subtle))]">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-5 gap-8 mb-8">
          {/* Product */}
          <div>
            <h3 className="font-bold mb-4 text-[hsl(var(--marketing-text))]">PRODUCT</h3>
            <ul className="space-y-2 text-sm text-[hsl(var(--marketing-text-light))]">
              <li>
                <Link to="/features" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/demo" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Demo
                </Link>
              </li>
              <li>
                <Link to="/integrations" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Integrations
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-bold mb-4 text-[hsl(var(--marketing-text))]">COMPANY</h3>
            <ul className="space-y-2 text-sm text-[hsl(var(--marketing-text-light))]">
              <li>
                <Link to="/about" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/careers" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/press" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Press
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-bold mb-4 text-[hsl(var(--marketing-text))]">RESOURCES</h3>
            <ul className="space-y-2 text-sm text-[hsl(var(--marketing-text-light))]">
              <li>
                <Link to="/blog" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/support" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/docs" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  API Docs
                </Link>
              </li>
              <li>
                <Link to="/status" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Status
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-bold mb-4 text-[hsl(var(--marketing-text))]">LEGAL</h3>
            <ul className="space-y-2 text-sm text-[hsl(var(--marketing-text-light))]">
              <li>
                <Link to="/privacy" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Terms
                </Link>
              </li>
              <li>
                <Link to="/security" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Security
                </Link>
              </li>
              <li>
                <Link to="/cookie" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Cookie
                </Link>
              </li>
            </ul>
          </div>

          {/* Login */}
          <div>
            <h3 className="font-bold mb-4 text-[hsl(var(--marketing-text))]">LOGIN</h3>
            <ul className="space-y-2 text-sm text-[hsl(var(--marketing-text-light))]">
              <li>
                <Link to="/login" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  All Portals
                </Link>
              </li>
              <li>
                <Link to="/customer/login" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Customer Login
                </Link>
              </li>
              <li>
                <Link to="/willysbo/admin/login" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Business Login
                </Link>
              </li>
              <li>
                <Link to="/super-admin/login" className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                  Admin Login
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[hsl(var(--marketing-border))]">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-[hsl(var(--marketing-text-light))]">
              <p>© 2024 DevPanel. All rights reserved.</p>
              <p className="mt-1">Modern CRM for Wholesale Distributors</p>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--marketing-text-light))] hover:text-[hsl(var(--marketing-primary))] transition-colors">
                Twitter
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--marketing-text-light))] hover:text-[hsl(var(--marketing-primary))] transition-colors">
                LinkedIn
              </a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--marketing-text-light))] hover:text-[hsl(var(--marketing-primary))] transition-colors">
                Facebook
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--marketing-text-light))] hover:text-[hsl(var(--marketing-primary))] transition-colors">
                YouTube
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

