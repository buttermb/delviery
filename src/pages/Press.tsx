import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Newspaper, Download, Mail } from "lucide-react";
import { Link } from "react-router-dom";

export default function Press() {
  const pressReleases = [
    {
      date: "March 15, 2025",
      title: "FloraIQ Raises $5M Series A to Transform Wholesale Distribution",
      category: "Funding",
      excerpt: "Leading B2B software platform secures funding to accelerate growth and product development."
    },
    {
      date: "February 10, 2025",
      title: "FloraIQ Surpasses 400 Active Distributors Milestone",
      category: "Company News",
      excerpt: "Platform reaches significant growth milestone, processing over $1.4M in orders monthly."
    },
    {
      date: "January 5, 2025",
      title: "FloraIQ Launches AI-Powered Analytics Dashboard",
      category: "Product Launch",
      excerpt: "New analytics features help distributors make data-driven decisions and optimize operations."
    }
  ];

  const mediaKit = [
    {
      title: "Company Logo Pack",
      description: "High-resolution logos in various formats (PNG, SVG)",
      fileSize: "2.4 MB"
    },
    {
      title: "Brand Guidelines",
      description: "Complete brand identity and usage guidelines",
      fileSize: "1.8 MB"
    },
    {
      title: "Product Screenshots",
      description: "High-quality product images and screenshots",
      fileSize: "5.2 MB"
    }
  ];

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title="Press & Media - Latest News | FloraIQ"
        description="Latest press releases, media coverage, and resources about FloraIQ. Download our media kit and stay updated with company news."
      />

      <MarketingNav />

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4">Press & Media</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
              FloraIQ in the News
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Stay updated with our latest announcements, product launches, and company milestones.
            </p>
          </div>
        </div>
      </section>

      {/* Press Releases */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Recent Press Releases
            </h2>
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            {pressReleases.map((release, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Newspaper className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{release.category}</Badge>
                        <span className="text-sm text-muted-foreground">{release.date}</span>
                      </div>
                      <h3 className="text-xl font-semibold mb-2">{release.title}</h3>
                      <p className="text-muted-foreground mb-4">{release.excerpt}</p>
                      <Button variant="link" className="p-0">
                        Read Full Release →
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Media Kit */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Media Kit
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Download our media kit for logos, brand assets, and product images.
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
            {mediaKit.map((item, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4">
                    <Download className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{item.fileSize}</span>
                    <Button size="sm" variant="outline">Download</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact for Press */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-8 text-center">
                <div className="p-4 rounded-lg bg-primary/10 w-fit mx-auto mb-4">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
                  Press Inquiries
                </h2>
                <p className="text-muted-foreground mb-6">
                  For media inquiries, interview requests, or more information about FloraIQ,
                  please reach out to our press team.
                </p>
                <Link to="/contact">
                  <Button size="lg">
                    Contact Press Team
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
