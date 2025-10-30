import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  Shield, 
  TrendingUp, 
  Users, 
  Zap, 
  CheckCircle,
  ArrowRight,
  Star
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

export default function MarketingHome() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background">
      <SEOHead 
        title="Business Management Platform | Complete Operations Solution"
        description="Transform your business with our all-in-one operations platform. Inventory, CRM, team management, and more in one powerful system."
      />
      
      {/* Navigation */}
      <nav className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/marketing" className="text-2xl font-bold">
            Business <span className="text-primary">Platform</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            <Link to="#features" className="text-sm hover:text-primary transition-colors">Features</Link>
            <Link to="#pricing" className="text-sm hover:text-primary transition-colors">Pricing</Link>
            <Link to="#testimonials" className="text-sm hover:text-primary transition-colors">Reviews</Link>
            <Link to="/about" className="text-sm hover:text-primary transition-colors">About</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/admin/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-primary/10 text-primary text-sm font-medium">
            🚀 The Complete Business Operations Platform
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
            Run Your Entire Business From One Platform
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Inventory management, customer relationships, team collaboration, and business intelligence—all in one powerful system built for modern businesses.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/signup">
              <Button size="lg" className="bg-primary hover:bg-primary/90 h-12 px-8">
                Start 14-Day Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="h-12 px-8">
                Schedule Demo
              </Button>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              No credit card required
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              Cancel anytime
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              Setup in 5 minutes
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20 bg-muted/30 rounded-3xl">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Everything You Need to Scale
            </h2>
            <p className="text-xl text-muted-foreground">
              Built by operators, for operators. 120+ features designed for growing businesses.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Package,
                title: "Inventory Management",
                description: "Real-time stock tracking, batch management, and automated reorder points. Multi-location support."
              },
              {
                icon: Shield,
                title: "Security & Compliance",
                description: "Enterprise-grade security, role-based access control, and compliance tracking. Stay audit-ready."
              },
              {
                icon: TrendingUp,
                title: "Advanced Analytics",
                description: "Sales forecasting, product performance, customer insights, and profitability analysis."
              },
              {
                icon: Users,
                title: "Complete CRM",
                description: "Customer profiles, purchase history, loyalty programs, and targeted marketing campaigns."
              },
              {
                icon: Zap,
                title: "Automation & Workflows",
                description: "Automated processes, smart notifications, and workflow optimization to save time."
              },
              {
                icon: CheckCircle,
                title: "Team Management",
                description: "Role-based permissions, activity logs, and performance tracking for your entire team."
              }
            ].map((feature, index) => (
              <div key={index} className="p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section id="pricing" className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-muted-foreground mb-12">
            Choose the plan that fits your business. All plans include 14-day free trial.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Starter",
                price: "$149",
                features: ["1 Location", "1,000 Products", "5 Team Members", "Basic Features"]
              },
              {
                name: "Professional",
                price: "$299",
                popular: true,
                features: ["3 Locations", "5,000 Products", "15 Team Members", "All Features + API"]
              },
              {
                name: "Enterprise",
                price: "$699",
                features: ["Unlimited Everything", "White-Label", "Priority Support", "Custom Integrations"]
              }
            ].map((plan, index) => (
              <div 
                key={index} 
                className={`p-6 rounded-2xl border ${
                  plan.popular 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border bg-card'
                }`}
              >
                {plan.popular && (
                  <div className="inline-block px-3 py-1 mb-4 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-2 mb-6 text-left">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to="/signup">
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          <Link to="/pricing" className="inline-block mt-8">
            <Button variant="ghost">
              View Full Pricing Details
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Social Proof */}
      <section id="testimonials" className="container mx-auto px-4 py-20 bg-muted/30 rounded-3xl">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Trusted by Growing Businesses
            </h2>
            <div className="flex items-center justify-center gap-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-6 w-6 fill-primary text-primary" />
              ))}
              <span className="ml-2 text-lg font-medium">4.9/5 from 200+ companies</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "Cut our operational costs by 40% in the first quarter. The automation features save us hours every day.",
                author: "Sarah M.",
                role: "Owner, Growing Retail Company"
              },
              {
                quote: "Customer satisfaction improved dramatically with better tracking and communication. Game changer for our business!",
                author: "Mike R.",
                role: "Operations Manager"
              },
              {
                quote: "Finally, a platform that understands small business operations. Switched from 5 different tools to just one.",
                author: "Jessica L.",
                role: "CEO, Service Company"
              }
            ].map((testimonial, index) => (
              <div key={index} className="p-6 rounded-2xl bg-card border border-border">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">"{testimonial.quote}"</p>
                <div className="font-medium">{testimonial.author}</div>
                <div className="text-sm text-muted-foreground">{testimonial.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center p-12 rounded-3xl bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Ready to Transform Your Operations?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join 200+ businesses already running on our platform.
          </p>
          <Link to="/signup">
            <Button size="lg" className="bg-primary hover:bg-primary/90 h-14 px-10 text-lg">
              Start Your Free 14-Day Trial
              <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-4">
            No credit card required • Cancel anytime • Setup in 5 minutes
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-20">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/features">Features</Link></li>
                <li><Link to="/pricing">Pricing</Link></li>
                <li><Link to="/integrations">Integrations</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/about">About</Link></li>
                <li><Link to="/blog">Blog</Link></li>
                <li><Link to="/contact">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/docs">Documentation</Link></li>
                <li><Link to="/support">Support</Link></li>
                <li><Link to="/faq">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/terms">Terms</Link></li>
                <li><Link to="/privacy">Privacy</Link></li>
                <li><Link to="/security">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border/40 text-center text-sm text-muted-foreground">
            <p>© 2025 Business Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
