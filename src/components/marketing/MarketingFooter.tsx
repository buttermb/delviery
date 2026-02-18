import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import FloraIQLogo from "@/components/FloraIQLogo";

const FOOTER_SECTIONS = [
  {
    title: "PRODUCT",
    links: [
      { label: "Inventory Management", href: "/features" },
      { label: "Order Fulfillment", href: "/features" },
      { label: "Delivery Logistics", href: "/features" },
      { label: "Mobile App", href: "/features" },
      { label: "Integrations", href: "/integrations" },
    ]
  },
  {
    title: "SOLUTIONS",
    links: [
      { label: "For Distributors", href: "/demo" },
      { label: "For Brands", href: "/demo" },
      { label: "Client CRM", href: "/features" },
      { label: "Compliance", href: "/security" },
    ]
  },
  {
    title: "COMPANY",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
      { label: "Blog", href: "/blog" },
    ]
  },
  {
    title: "SUPPORT",
    links: [
      { label: "Help Center", href: "/support" },
      { label: "API Documentation", href: "/docs" },
      { label: "System Status", href: "/status" },
      { label: "Login", href: "/login" },
    ]
  }
];

export function MarketingFooter() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 text-slate-600 pt-20 pb-12 font-sans">
      <div className="container mx-auto px-4">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 mb-16">
          {/* Logo Column */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <FloraIQLogo size="lg" />
            </div>
            <p className="text-slate-500 text-lg mb-6 max-w-sm leading-relaxed">
              The operating system for modern cannabis distribution. Secure, compliant, and built for scale.
            </p>
            <div className="flex gap-4" role="list" aria-label="Social media links">
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="Follow us on X (Twitter)" className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-[hsl(var(--marketing-primary))] hover:text-white hover:border-[hsl(var(--marketing-primary))] transition-all duration-300 shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="Follow us on LinkedIn" className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-[hsl(var(--marketing-primary))] hover:text-white hover:border-[hsl(var(--marketing-primary))] transition-all duration-300 shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Follow us on Instagram" className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-[hsl(var(--marketing-primary))] hover:text-white hover:border-[hsl(var(--marketing-primary))] transition-all duration-300 shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 0 1-2.88 0 1.441 1.441 0 0 1 2.88 0z" /></svg>
              </a>
            </div>
          </div>

          {/* Links Columns (Desktop) */}
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title} className="hidden md:block">
              <h4 className="font-bold mb-6 text-slate-900 tracking-wider text-sm">
                {section.title}
              </h4>
              <ul className="space-y-4">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-slate-500 hover:text-[hsl(var(--marketing-primary))] transition-colors text-base font-medium"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Mobile Accordion */}
          <div className="md:hidden col-span-1">
            <Accordion type="single" collapsible className="w-full border-none">
              {FOOTER_SECTIONS.map((section) => (
                <AccordionItem key={section.title} value={section.title} className="border-b border-slate-200">
                  <AccordionTrigger className="text-slate-900 font-bold hover:no-underline hover:text-[hsl(var(--marketing-primary))]">
                    {section.title}
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-3 pt-2 pb-4">
                      {section.links.map((link) => (
                        <li key={link.label}>
                          <Link to={link.href} className="block text-slate-500 hover:text-[hsl(var(--marketing-primary))]">
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-400">
          <div className="font-medium">
            &copy; {new Date().getFullYear()} FloraIQ Inc. All rights reserved.
          </div>
          <div className="flex gap-8">
            <Link to="/privacy" className="hover:text-[hsl(var(--marketing-primary))] transition-colors font-medium">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-[hsl(var(--marketing-primary))] transition-colors font-medium">Terms of Service</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
