import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Book, Code2, FileText, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export default function DocsPage() {
  const docSections = [
    {
      icon: Zap,
      title: "Getting Started",
      description: "Quick start guide and initial setup",
      links: ["Installation", "Authentication", "Your First API Call"],
    },
    {
      icon: Code2,
      title: "API Reference",
      description: "Complete API endpoint documentation",
      links: ["Products", "Orders", "Customers", "Inventory"],
    },
    {
      icon: FileText,
      title: "Guides",
      description: "Step-by-step tutorials and best practices",
      links: ["Webhook Setup", "Bulk Operations", "Advanced Filtering"],
    },
    {
      icon: Shield,
      title: "Security",
      description: "Authentication and security best practices",
      links: ["API Keys", "OAuth 2.0", "Rate Limiting"],
    },
  ];

  return (
    <div className="min-h-screen bg-[hsl(var(--marketing-bg))]">
      <SEOHead 
        title="API Documentation - DevPanel"
        description="Complete API documentation for DevPanel. RESTful endpoints, authentication, and integration guides."
      />
      
      <MarketingNav />

      <section className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              API Documentation
            </h1>
            <p className="text-xl text-[hsl(var(--marketing-text-light))]">
              Everything you need to integrate with DevPanel
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {docSections.map((section) => {
              const Icon = section.icon;
              return (
                <Card key={section.title}>
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-lg bg-[hsl(var(--marketing-accent))]/10 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-[hsl(var(--marketing-accent))]" />
                      </div>
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                    </div>
                    <CardDescription>{section.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {section.links.map((link) => (
                        <li key={link}>
                          <a
                            href="#"
                            className="text-sm text-[hsl(var(--marketing-primary))] hover:underline"
                          >
                            {link}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="bg-[hsl(var(--marketing-bg-subtle))]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Book className="h-5 w-5" />
                API Documentation Coming Soon
              </CardTitle>
              <CardDescription>
                Our comprehensive API documentation is currently being prepared. In the meantime, Enterprise customers have access to our REST API endpoints.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[hsl(var(--marketing-text-light))] mb-4">
                Want early access to our API documentation?
              </p>
              <Link
                to="/contact"
                className="inline-block text-[hsl(var(--marketing-primary))] hover:underline"
              >
                Contact our sales team →
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
