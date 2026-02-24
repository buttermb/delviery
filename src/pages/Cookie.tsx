import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cookie as CookieIcon, Info, CheckCircle } from "lucide-react";

export default function Cookie() {
  const cookieTypes = [
    {
      title: "Strictly Necessary Cookies",
      description: "These cookies are essential for the website to function properly. They enable core functionality such as security, network management, and accessibility.",
      examples: [
        "Authentication cookies",
        "Security tokens",
        "Load balancing cookies"
      ],
      canDisable: false
    },
    {
      title: "Performance Cookies",
      description: "These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.",
      examples: [
        "Google Analytics",
        "Page load time tracking",
        "Error logging"
      ],
      canDisable: true
    },
    {
      title: "Functional Cookies",
      description: "These cookies enable enhanced functionality and personalization, such as remembering your preferences and choices.",
      examples: [
        "Language preferences",
        "Theme settings",
        "Region selection"
      ],
      canDisable: true
    },
    {
      title: "Marketing Cookies",
      description: "These cookies track your online activity to help advertisers deliver more relevant advertising or limit how many times you see an ad.",
      examples: [
        "Social media integration",
        "Advertising networks",
        "Conversion tracking"
      ],
      canDisable: true
    }
  ];

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title="Cookie Policy | FloraIQ"
        description="Learn about how FloraIQ uses cookies and similar technologies to improve your experience on our website."
      />

      <MarketingNav />

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4">Cookie Policy</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
              Cookie Policy
            </h1>
            <p className="text-xl text-muted-foreground mb-4">
              Last updated: March 1, 2025
            </p>
            <p className="text-muted-foreground">
              This Cookie Policy explains how FloraIQ uses cookies and similar technologies to recognize you
              when you visit our website.
            </p>
          </div>
        </div>
      </section>

      {/* What Are Cookies */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="mb-8">
              <CardContent className="p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <CookieIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-3 text-foreground">
                      What Are Cookies?
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      Cookies are small text files that are placed on your computer or mobile device when you visit a website.
                      They are widely used to make websites work more efficiently and provide information to the site owners.
                    </p>
                    <p className="text-muted-foreground">
                      Cookies can be "persistent" or "session" cookies. Persistent cookies remain on your device after you
                      close your browser, while session cookies are deleted when you close your browser.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Cookie Types */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Types of Cookies We Use
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We use different types of cookies to run our website and improve your experience.
            </p>
          </div>

          <div className="max-w-5xl mx-auto space-y-6">
            {cookieTypes.map((type, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-semibold text-foreground">{type.title}</h3>
                    <Badge variant={type.canDisable ? "outline" : "default"}>
                      {type.canDisable ? "Optional" : "Required"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mb-4">{type.description}</p>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Examples:</p>
                    <ul className="space-y-1">
                      {type.examples.map((example, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                          {example}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Managing Cookies */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <Info className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-3 text-foreground">
                      How to Manage Cookies
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      Most web browsers allow you to control cookies through their settings preferences. However,
                      if you limit the ability of websites to set cookies, you may worsen your overall user experience.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-foreground mb-2">Browser Settings</p>
                        <p className="text-sm text-muted-foreground">
                          You can manage cookies in your browser settings. Each browser is different, so check your
                          browser's "Help" menu to learn how to change your cookie preferences.
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-2">Cookie Preferences</p>
                        <p className="text-sm text-muted-foreground">
                          When you first visit our website, you'll see a cookie consent banner where you can choose
                          which types of cookies to accept or reject.
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-2">Do Not Track</p>
                        <p className="text-sm text-muted-foreground">
                          Some browsers have a "Do Not Track" feature that lets you tell websites that you do not want
                          to have your online activities tracked. We respect Do Not Track signals.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Third-Party Cookies */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-foreground text-center">
              Third-Party Cookies
            </h2>
            <Card>
              <CardContent className="p-8">
                <p className="text-muted-foreground mb-4">
                  In addition to our own cookies, we may also use various third-party cookies to report usage
                  statistics, deliver advertisements, and provide enhanced functionality.
                </p>
                <p className="text-muted-foreground mb-4">
                  Third-party services we use include:
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    Google Analytics - for website analytics and performance monitoring
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    Stripe - for payment processing and fraud prevention
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    Intercom - for customer support and messaging
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Updates */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-8 text-center">
                <h2 className="text-2xl font-bold mb-4 text-foreground">
                  Changes to This Policy
                </h2>
                <p className="text-muted-foreground mb-6">
                  We may update this Cookie Policy from time to time to reflect changes in our practices or
                  for other operational, legal, or regulatory reasons. Please check this page periodically for updates.
                </p>
                <p className="text-sm text-muted-foreground">
                  If you have questions about our use of cookies, please contact us at{" "}
                  <a href="mailto:privacy@floraiq.com" className="text-primary hover:underline">
                    privacy@floraiq.com
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
