import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock } from "lucide-react";

export default function StatusPage() {
  const services = [
    { name: "API", status: "operational", uptime: "99.99%" },
    { name: "Web Application", status: "operational", uptime: "99.98%" },
    { name: "Database", status: "operational", uptime: "99.99%" },
    { name: "File Storage", status: "operational", uptime: "99.97%" },
    { name: "Authentication", status: "operational", uptime: "100%" },
  ];

  return (
    <div className="min-h-dvh bg-[hsl(var(--marketing-bg))]">
      <SEOHead 
        title="System Status - DevPanel"
        description="Current status and uptime for all DevPanel services"
      />
      
      <MarketingNav />

      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              System Status
            </h1>
            <p className="text-xl text-[hsl(var(--marketing-text-light))]">
              Real-time status of DevPanel services
            </p>
          </div>

          <Card className="mb-8 border-green-500/20 bg-green-500/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <CardTitle className="text-green-600 dark:text-green-400">
                    All Systems Operational
                  </CardTitle>
                  <CardDescription>
                    All services are running smoothly
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Status</CardTitle>
              <CardDescription>Current status of all platform services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {services.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between py-3 border-b border-[hsl(var(--marketing-border))] last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-[hsl(var(--marketing-text))]">
                        {service.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-[hsl(var(--marketing-text-light))]">
                        {service.uptime} uptime
                      </span>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        Operational
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-8 bg-[hsl(var(--marketing-bg-subtle))]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Incident History
              </CardTitle>
              <CardDescription>Past 90 days</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-[hsl(var(--marketing-text-light))]">
                No incidents reported in the past 90 days.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
