/**
 * Marketing Landing Page
 * Public marketing site for SAAS platform
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Check, ArrowRight, Zap, Shield, BarChart, Users, 
  Globe, Lock, TrendingUp, Star, Menu
} from 'lucide-react';

export default function MarketingLanding() {
  const features = [
    {
      icon: Menu,
      title: 'Disposable Menus',
      description: 'Encrypted, burnable menus with advanced security',
    },
    {
      icon: Users,
      title: 'Customer Management',
      description: 'Complete CRM for B2B and retail customers',
    },
    {
      icon: BarChart,
      title: 'Analytics & Insights',
      description: 'Real-time dashboards and performance metrics',
    },
    {
      icon: Shield,
      title: 'Compliance Ready',
      description: 'Built for cannabis industry regulations',
    },
    {
      icon: Zap,
      title: 'Fast & Reliable',
      description: '99.9% uptime with real-time updates',
    },
    {
      icon: Globe,
      title: 'White-Label',
      description: 'Brand it as your own (Enterprise)',
    },
  ];

  const plans = [
    {
      name: 'Starter',
      price: 99,
      description: 'Perfect for small operations',
      features: [
        '50 Customers',
        '3 Disposable Menus',
        '100 Products',
        '2 Locations',
        '3 Team Members',
        'Email Support',
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Professional',
      price: 299,
      description: 'For growing businesses',
      features: [
        '500 Customers',
        'Unlimited Menus',
        'Unlimited Products',
        '10 Locations',
        '10 Team Members',
        'API Access',
        'Priority Support',
      ],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 799,
      description: 'For large-scale operations',
      features: [
        'Unlimited Everything',
        'White-Label Branding',
        'Custom Domain',
        'Advanced Analytics',
        'Dedicated Support',
        'Custom Integrations',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Menu className="h-6 w-6 text-emerald-600" />
            <span className="text-xl font-bold">CannabisCRM</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/saas/signup">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/saas/signup">
              <Button>Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
          Wholesale Cannabis CRM
          <br />
          Built for Operations
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Complete platform for managing customers, menus, inventory, and orders.
          Built with security and compliance in mind.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/saas/signup">
            <Button size="lg" className="text-lg px-8">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="text-lg px-8">
            Watch Demo
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          14-day free trial • No credit card required • Cancel anytime
        </p>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything You Need to Run Your Operation
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <Card key={idx} className="p-6 hover:shadow-lg transition-shadow">
              <feature.icon className="h-12 w-12 text-emerald-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground">
            Choose the plan that fits your business
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, idx) => (
            <Card
              key={idx}
              className={`p-8 ${plan.popular ? 'border-emerald-500 border-2 shadow-lg' : ''}`}
            >
              {plan.popular && (
                <div className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-full w-fit mb-4">
                  MOST POPULAR
                </div>
              )}
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <p className="text-muted-foreground mb-4">{plan.description}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, fIdx) => (
                  <li key={fIdx} className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-emerald-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link to="/saas/signup" className="block">
                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  size="lg"
                >
                  {plan.cta}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Social Proof */}
      <section className="bg-muted py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-8">Trusted by Cannabis Operations</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[1, 2, 3].map((idx) => (
              <Card key={idx} className="p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">
                  "This platform transformed our operations. Everything we need in one place."
                </p>
                <p className="font-semibold">— Business Owner</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="p-12 text-center bg-gradient-to-r from-emerald-600 to-blue-600 text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of operations running on CannabisCRM
          </p>
          <Link to="/saas/signup">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Menu className="h-6 w-6 text-emerald-600" />
                <span className="text-xl font-bold">CannabisCRM</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Complete platform for wholesale cannabis operations.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/features">Features</Link></li>
                <li><Link to="/pricing">Pricing</Link></li>
                <li><Link to="/integrations">Integrations</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/about">About</Link></li>
                <li><Link to="/contact">Contact</Link></li>
                <li><Link to="/careers">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/terms">Terms</Link></li>
                <li><Link to="/privacy">Privacy</Link></li>
                <li><Link to="/security">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            © 2024 CannabisCRM. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

