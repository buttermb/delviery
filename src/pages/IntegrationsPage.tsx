import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Code2 from "lucide-react/dist/esm/icons/code-2";
import Database from "lucide-react/dist/esm/icons/database";
import Webhook from "lucide-react/dist/esm/icons/webhook";
import Zap from "lucide-react/dist/esm/icons/zap";
import Key from "lucide-react/dist/esm/icons/key";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "react-router-dom";

export default function IntegrationsPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const integrations = [
    {
      icon: Database,
      name: "REST API",
      description: "Full REST API access for custom integrations",
      status: "Available",
    },
    {
      icon: Webhook,
      name: "Webhooks",
      description: "Real-time event notifications to your systems",
      status: "Available",
    },
    {
      icon: Zap,
      name: "Zapier",
      description: "Connect with 5,000+ apps via Zapier",
      status: "Coming Soon",
    },
    {
      icon: Code2,
      name: "JavaScript SDK",
      description: "Easy-to-use SDK for web applications",
      status: "In Development",
    },
  ];

  return (
    <div className="min-h-dvh bg-[hsl(var(--marketing-bg))]">
      <SEOHead
        title="Integrations - FloraIQ"
        description="Connect FloraIQ with your favorite tools and platforms. REST API, Webhooks, and more."
      />

      <MarketingNav />

      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              Integrations
            </h1>
            <p className="text-xl text-[hsl(var(--marketing-text-light))]">
              Connect FloraIQ with the tools you already use
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {integrations.map((integration) => {
              const Icon = integration.icon;
              return (
                <Card key={integration.name}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-[hsl(var(--marketing-accent))]/10 flex items-center justify-center">
                          <Icon className="h-6 w-6 text-[hsl(var(--marketing-accent))]" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{integration.name}</CardTitle>
                          <span className="text-xs text-[hsl(var(--marketing-text-light))]">
                            {integration.status}
                          </span>
                        </div>
                      </div>
                      {integration.status === "Available" && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{integration.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="bg-[hsl(var(--marketing-bg-subtle))]">
            <CardHeader>
              <CardTitle>Need a Custom Integration?</CardTitle>
              <CardDescription>
                Our API makes it easy to build custom integrations with your existing systems
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-4">
              <Link to="/docs" className="flex-1">
                <Button variant="outline" className="w-full">
                  <Code2 className="mr-2 h-4 w-4" />
                  View API Docs
                </Button>
              </Link>
              <Link to={tenantSlug ? `/${tenantSlug}/admin/api-access` : "/admin/api-access"} className="flex-1">
                <Button variant="outline" className="w-full">
                  <Key className="mr-2 h-4 w-4" />
                  Manage API Keys
                </Button>
              </Link>
              <Link to="/contact" className="flex-1">
                <Button className="w-full bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white">
                  Contact Sales
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section >

      <MarketingFooter />
    </div >
  );
}
