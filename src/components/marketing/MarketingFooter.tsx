import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FOOTER_SECTIONS = [
  {
    title: "PRODUCT",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Demo", href: "/demo" },
      { label: "Integrations", href: "/integrations" },
    ]
  },
  {
    title: "COMPANY",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
      { label: "Press", href: "/press" },
    ]
  },
  {
    title: "RESOURCES",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Support", href: "/support" },
      { label: "API Docs", href: "/docs" },
      { label: "Status", href: "/status" },
    ]
  },
  {
    title: "LEGAL",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Security", href: "/security" },
      { label: "Cookie", href: "/cookie" },
    ]
  },
  {
    title: "LOGIN",
    links: [
      { label: "All Portals", href: "/login" },
      { label: "Customer Login", href: "/customer/login" },
      { label: "Business Login", href: "/saas/login" },
      { label: "Admin Login", href: "/super-admin/login" },
    ]
  }
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-[hsl(var(--marketing-border))] mt-20 bg-[hsl(var(--marketing-bg-subtle))]">
      <div className="container mx-auto px-4 py-12">

        {/* Desktop Grid View (Hidden on Mobile) */}
        <div className="hidden md:grid md:grid-cols-5 gap-8 mb-8">
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="font-bold mb-4 text-[hsl(var(--marketing-text))]">{section.title}</h3>
              <ul className="space-y-2 text-sm text-[hsl(var(--marketing-text-light))]">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.href} className="hover:text-[hsl(var(--marketing-primary))] transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Mobile Accordion View (Hidden on Desktop) */}
        <div className="md:hidden mb-8">
          <Accordion type="single" collapsible className="w-full">
            {FOOTER_SECTIONS.map((section) => (
              <AccordionItem key={section.title} value={section.title} className="border-b border-[hsl(var(--marketing-border))]">
                <AccordionTrigger className="text-[hsl(var(--marketing-text))] font-bold hover:no-underline">
                  {section.title}
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-3 pt-2 pb-4 text-sm text-[hsl(var(--marketing-text-light))]">
                    {section.links.map((link) => (
                      <li key={link.label}>
                        <Link to={link.href} className="block hover:text-[hsl(var(--marketing-primary))] transition-colors">
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

        <div className="pt-8 border-t border-[hsl(var(--marketing-border))]">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-[hsl(var(--marketing-text-light))] text-center md:text-left">
              <p>© 2025 FloraIQ. All rights reserved.</p>
              <p className="mt-1">Smart Cannabis Operations Platform</p>
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

