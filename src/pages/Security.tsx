import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Key, Database, Eye, AlertTriangle, CheckCircle, Server } from "lucide-react";

export default function Security() {
  const securityFeatures = [
    {
      icon: Shield,
      title: "Enterprise-Grade Security",
      description: "Bank-level encryption and security protocols to protect your sensitive business data."
    },
    {
      icon: Lock,
      title: "256-bit SSL Encryption",
      description: "All data transmitted between your browser and our servers is encrypted using industry-standard SSL/TLS."
    },
    {
      icon: Key,
      title: "Multi-Factor Authentication",
      description: "Optional two-factor authentication adds an extra layer of security to user accounts."
    },
    {
      icon: Database,
      title: "Secure Data Storage",
      description: "Your data is stored in SOC 2 compliant data centers with automatic backups and disaster recovery."
    },
    {
      icon: Eye,
      title: "Privacy by Design",
      description: "We follow privacy-first principles and give you complete control over your data."
    },
    {
      icon: Server,
      title: "Regular Security Audits",
      description: "Third-party security audits and penetration testing to ensure the highest security standards."
    }
  ];

  const certifications = [
    {
      name: "SOC 2 Type II",
      description: "Certified for security, availability, and confidentiality"
    },
    {
      name: "GDPR Compliant",
      description: "Full compliance with European data protection regulations"
    },
    {
      name: "ISO 27001",
      description: "International standard for information security management"
    },
    {
      name: "PCI DSS",
      description: "Payment card industry data security standard compliant"
    }
  ];

  const bestPractices = [
    "End-to-end encryption for sensitive data",
    "Regular automated security updates",
    "Role-based access control (RBAC)",
    "Comprehensive audit logs",
    "DDoS protection and monitoring",
    "Secure API authentication",
    "Data anonymization where applicable",
    "24/7 security monitoring"
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Security & Compliance | DevPanel"
        description="Learn about DevPanel's enterprise-grade security measures, certifications, and commitment to protecting your business data."
      />
      
      <MarketingNav />

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4">Security & Compliance</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
              Your Data is
              <span className="block text-primary">Safe & Secure</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              We implement industry-leading security measures to protect your business data 
              and ensure compliance with global standards.
            </p>
          </div>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Comprehensive Security Features
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Multi-layered security architecture designed to protect your data at every level.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {securityFeatures.map((feature, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Certifications & Compliance
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We maintain the highest industry standards and certifications.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {certifications.map((cert, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="p-4 rounded-lg bg-primary/10 w-fit mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{cert.name}</h3>
                  <p className="text-sm text-muted-foreground">{cert.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Best Practices */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
                Security Best Practices
              </h2>
              <p className="text-muted-foreground">
                Our commitment to security goes beyond compliance.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {bestPractices.map((practice, index) => (
                <div key={index} className="flex items-start gap-3 p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">{practice}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Incident Response */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-orange-500/5 to-orange-500/10 border-orange-500/20">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-orange-500/10">
                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-3 text-foreground">
                      Security Incident Response
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      We have a dedicated security team monitoring systems 24/7. In the unlikely event 
                      of a security incident, we have established protocols to:
                    </p>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        Immediately contain and investigate the incident
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        Notify affected customers within 72 hours
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        Provide transparent communication and regular updates
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        Implement corrective measures to prevent recurrence
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Have Security Questions?
            </h2>
            <p className="text-muted-foreground mb-8">
              Our security team is here to answer any questions about our security measures, 
              compliance, or data protection policies.
            </p>
            <a href="mailto:security@devpanel.com" className="text-primary hover:underline font-medium">
              security@devpanel.com
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
