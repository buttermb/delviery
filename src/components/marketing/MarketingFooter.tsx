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
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="Follow us on X (Twitter)" className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-[hsl(var(--marketing-primary))] hover:text-white hover:border-[hsl(var(--marketing-primary))] transition-all font-bold duration-300 shadow-sm">X</a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="Follow us on LinkedIn" className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-[hsl(var(--marketing-primary))] hover:text-white hover:border-[hsl(var(--marketing-primary))] transition-all font-bold duration-300 shadow-sm">Li</a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Follow us on Instagram" className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-[hsl(var(--marketing-primary))] hover:text-white hover:border-[hsl(var(--marketing-primary))] transition-all font-bold duration-300 shadow-sm">Ig</a>
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
