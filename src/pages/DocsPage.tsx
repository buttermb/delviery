import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Book from "lucide-react/dist/esm/icons/book";
import Code2 from "lucide-react/dist/esm/icons/code-2";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Shield from "lucide-react/dist/esm/icons/shield";
import Zap from "lucide-react/dist/esm/icons/zap";
import { Link } from "react-router-dom";

export default function DocsPage() {
  const docSections = [
    {
      icon: Zap,
      title: "Getting Started",
      description: "Quick start guide and initial setup",
      href: "/docs/getting-started",
    },
    {
      icon: Code2,
      title: "API Reference",
      description: "Complete API endpoint documentation",
      href: "/docs/api-reference",
    },
    {
      icon: FileText,
      title: "Guides",
      description: "Step-by-step tutorials and best practices",
      href: "/docs/guides/webhooks",
    },
    {
      icon: Shield,
      title: "Security",
      description: "Authentication and security best practices",
      href: "/docs/security",
    },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title="API Documentation - FloraIQ"
        description="Complete API documentation for FloraIQ. RESTful endpoints, authentication, and integration guides."
      />

      <MarketingNav />

      <section className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              API Documentation
            </h1>
            <p className="text-xl text-muted-foreground">
              Everything you need to integrate with FloraIQ
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {docSections.map((section) => {
              const Icon = section.icon;
              return (
                <Link key={section.title} to={section.href}>
                  <Card className="h-full hover:shadow-lg transition-all hover:border-primary/50">
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle className="text-lg">{section.title}</CardTitle>
                      </div>
                      <CardDescription>{section.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>

          <Card className="bg-card border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Book className="h-5 w-5 text-primary" />
                Comprehensive API Documentation
              </CardTitle>
              <CardDescription>
                Access over 60 REST API endpoints for complete control of your FloraIQ tenant. Build custom integrations, automate workflows, and extend functionality.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary mb-1">60+</div>
                  <div className="text-sm text-muted-foreground">API Endpoints</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary mb-1">10+</div>
                  <div className="text-sm text-muted-foreground">Integration Guides</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary mb-1">3</div>
                  <div className="text-sm text-muted-foreground">Code Languages</div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Link to="/docs/getting-started">
                  <Button className="gap-2">
                    Get Started
                    <Zap className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/docs/api-reference">
                  <Button variant="outline" className="gap-2">
                    View API Reference
                    <Code2 className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
