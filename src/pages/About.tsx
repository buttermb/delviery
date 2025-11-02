import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Target, Rocket, Shield, Zap } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card } from "@/components/ui/card";

export default function About() {
  const values = [
    {
      icon: Target,
      title: "Customer-First",
      description: "Every feature we build starts with customer feedback. Your success is our success.",
    },
    {
      icon: Rocket,
      title: "Innovation",
      description: "We're constantly improving DevPanel with new features and improvements based on industry needs.",
    },
    {
      icon: Shield,
      title: "Security & Privacy",
      description: "Your data is yours. Bank-level encryption, GDPR compliance, and regular security audits.",
    },
    {
      icon: Zap,
      title: "Reliability",
      description: "99.9% uptime. 24/7 monitoring. Always there when you need us.",
    },
  ];

  const team = [
    {
      name: "John Smith",
      role: "CEO & Co-Founder",
      photo: "/team/john.jpg",
    },
    {
      name: "Sarah Chen",
      role: "CTO",
      photo: "/team/sarah.jpg",
    },
    {
      name: "Mike Johnson",
      role: "VP Product",
      photo: "/team/mike.jpg",
    },
  ];

  return (
    <div className="min-h-screen bg-[hsl(var(--marketing-bg))]">
      <SEOHead 
        title="About Us - DevPanel | Our Mission, Story & Values"
        description="DevPanel was built by distributors, for distributors. Learn about our mission to modernize wholesale distribution and our team."
      />
      
      <MarketingNav />

      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          {/* Our Mission */}
          <div className="text-center mb-20">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-[hsl(var(--marketing-text))]">
              Our Mission
            </h1>
            <p className="text-xl text-[hsl(var(--marketing-text-light))] leading-relaxed mb-8">
              We're on a mission to modernize wholesale distribution. Wholesalers deserve better tools than outdated spreadsheets and clunky ERPs.
            </p>
            <p className="text-lg text-[hsl(var(--marketing-text))]">
              DevPanel was built by distributors, for distributors. We understand your challenges because we've lived them.
            </p>
          </div>

          <div className="border-t border-[hsl(var(--marketing-border))] pt-16 mb-16">
            {/* Our Story */}
            <h2 className="text-3xl font-bold mb-6 text-[hsl(var(--marketing-text))]">Our Story</h2>
            <div className="prose prose-lg max-w-none">
              <p className="text-[hsl(var(--marketing-text))] mb-4">
                Founded in 2023 by a team of wholesale distributors and software engineers who were frustrated with the lack of modern, affordable tools for wholesale businesses.
              </p>
              <p className="text-[hsl(var(--marketing-text))]">
                Today, DevPanel powers 400+ distributors processing $1.4M in orders monthly. We're proud to be helping wholesalers grow their businesses every day.
              </p>
            </div>
          </div>

          <div className="border-t border-[hsl(var(--marketing-border))] pt-16 mb-16">
            {/* Our Values */}
            <h2 className="text-3xl font-bold mb-8 text-[hsl(var(--marketing-text))]">Our Values</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {values.map((value, index) => (
                <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center mb-4">
                    <value.icon className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-[hsl(var(--marketing-text))]">{value.title}</h3>
                  <p className="text-[hsl(var(--marketing-text-light))]">{value.description}</p>
                </Card>
              ))}
            </div>
          </div>

          <div className="border-t border-[hsl(var(--marketing-border))] pt-16 mb-16">
            {/* The Team */}
            <h2 className="text-3xl font-bold mb-8 text-[hsl(var(--marketing-text))]">The Team</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {team.map((member, index) => (
                <div key={index} className="text-center">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-secondary))] mx-auto mb-4 flex items-center justify-center text-white text-4xl font-bold">
                    {member.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <h3 className="font-bold text-lg mb-1 text-[hsl(var(--marketing-text))]">{member.name}</h3>
                  <p className="text-sm text-[hsl(var(--marketing-text-light))]">{member.role}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link to="/careers">
                <Button variant="outline">
                  Meet the Full Team →
                </Button>
              </Link>
            </div>
          </div>

          <div className="border-t border-[hsl(var(--marketing-border))] pt-16">
            {/* Join Us */}
            <h2 className="text-3xl font-bold mb-4 text-[hsl(var(--marketing-text))]">Join Us</h2>
            <p className="text-[hsl(var(--marketing-text-light))] mb-6">
              We're always looking for talented people to join our team.
            </p>
            <Link to="/careers">
              <Button className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white">
                View Open Positions →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
