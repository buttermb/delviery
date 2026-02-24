/**
 * Marketing Landing Page
 * Public marketing site for SAAS platform
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import FloraIQLogo from '@/components/FloraIQLogo';
import {
  Check, ArrowRight, Zap, Shield,
  Globe, Lock, TrendingUp, Star, Activity, Users
} from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function MarketingLanding() {
  const faqs = [
    {
      question: "Why is a credit card required for the free tier?",
      answer: "We require a credit card to verify your identity and prevent fraud. You will not be charged unless you choose to upgrade to a paid plan. Your security is our top priority."
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes, absolutely. There are no long-term contracts or cancellation fees. You can cancel your subscription at any time directly from your dashboard."
    },
    {
      question: "Is my data secure?",
      answer: "We use enterprise-grade encryption and security measures to protect your data. We are fully compliant with industry standards and regulations."
    },
    {
      question: "What happens after my trial ends?",
      answer: "If you're on a paid plan trial, you can choose to continue with the subscription or switch to our free tier. Your data will be preserved."
    }
  ];
  const features = [
    {
      icon: Shield,
      title: 'Secure Digital Menus',
      description: 'Protect your business with encrypted, burnable menus that keep your pricing discrete and secure.',
    },
    {
      icon: Users,
      title: 'Built-in CRM',
      description: 'Stop using spreadsheets. Manage all your retail and B2B customers in one organized, secure system.',
    },
    {
      icon: Activity,
      title: 'Real-Time Inventory',
      description: 'Never oversell again. Track stock levels across multiple locations with live updates and low-stock alerts.',
    },
    {
      icon: Lock, // Changed from Shield to avoid duplicate if Shield is used above, or keep inconsistent icons if preferred. Using Lock for variety.
      title: '100% Compliance Ready',
      description: 'Stay on the right side of regulations with built-in compliance features designed for the cannabis industry.',
    },
    {
      icon: Zap,
      title: 'Zero Downtime',
      description: 'Keep your operation runnning 24/7 with our 99.9% uptime guarantee and instant cloud backups.',
    },
    {
      icon: Globe, // Keeping Globe
      title: 'White-Label Enterprise',
      description: 'Scale your brand, not ours. Fully customizable interface for large-scale operations.',
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
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="absolute top-4 right-4">
          <Link
            to="/saas/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Platform Admin Login
          </Link>
        </div>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FloraIQLogo size="md" />
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
        <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent leading-tight">
          Scale Your Cannabis Operations<br />with Confidence
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Eliminate manual errors, track inventory in real-time, and stay compliant—all in one secure platform.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link to="/saas/signup">
            <Button size="lg" className="text-lg px-8 h-12">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="text-lg px-8 h-12">
            Watch Demo
          </Button>
        </div>
        <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            Includes Free Credit Tier • <span className="text-muted-foreground font-normal">Credit card required for safety verification</span>
          </p>
          <div className="flex items-center gap-4 text-xs opacity-80">
            <span className="flex items-center"><Check className="h-3 w-3 mr-1" /> Cancel anytime</span>
            <span className="flex items-center"><Check className="h-3 w-3 mr-1" /> 14-day free trial</span>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="border-y bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-sm font-medium text-muted-foreground mb-6">TRUSTED BY FORWARD-THINKING CANNABIS BRANDS</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Placeholders for logos - in a real app these would be SVGs */}
            <div className="flex items-center gap-2 font-bold text-lg"><Globe className="h-5 w-5" /> GreenLeaf</div>
            <div className="flex items-center gap-2 font-bold text-lg"><Zap className="h-5 w-5" /> HighTide</div>
            <div className="flex items-center gap-2 font-bold text-lg"><Shield className="h-5 w-5" /> SecureCanna</div>
            <div className="flex items-center gap-2 font-bold text-lg"><Star className="h-5 w-5" /> TopShelf</div>
            <div className="flex items-center gap-2 font-bold text-lg"><Activity className="h-5 w-5" /> FlowState</div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="container mx-auto px-4 py-20 bg-muted/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">Is your operation stuck in spreadsheets?</h2>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div className="bg-background p-6 rounded-xl shadow-sm border">
              <div className="bg-red-100 dark:bg-red-900/20 w-10 h-10 rounded-lg flex items-center justify-center mb-4">
                <Lock className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-semibold mb-2">Security Risks</h3>
              <p className="text-sm text-muted-foreground">Manual data entry and unsecured spreadsheets leave your sensitive customer data vulnerable to leaks.</p>
            </div>
            <div className="bg-background p-6 rounded-xl shadow-sm border">
              <div className="bg-orange-100 dark:bg-orange-900/20 w-10 h-10 rounded-lg flex items-center justify-center mb-4">
                <Activity className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="font-semibold mb-2">Inventory Chaos</h3>
              <p className="text-sm text-muted-foreground">Overselling products because inventory didn't sync fast enough? That's a surefire way to lose customers.</p>
            </div>
            <div className="bg-background p-6 rounded-xl shadow-sm border">
              <div className="bg-blue-100 dark:bg-blue-900/20 w-10 h-10 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold mb-2">Growth Ceiling</h3>
              <p className="text-sm text-muted-foreground">You can't scale when you're buried in admin work. Automate the busywork and focus on expansion.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything You Need to Run Your Operation
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <Card key={idx} className="p-6 hover:shadow-lg transition-shadow">
              <feature.icon className="h-12 w-12 text-primary mb-4" />
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
              className={`p-8 ${plan.popular ? 'border-primary border-2 shadow-lg' : ''}`}
            >
              {plan.popular && (
                <div className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full w-fit mb-4">
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
                    <Check className="h-5 w-5 text-primary" />
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
                    <Star key={i} className="h-5 w-5 fill-primary text-primary" />
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

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">Everything you need to know about the platform and billing</p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="p-12 text-center bg-gradient-primary text-primary-foreground">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of operations running on FloraIQ
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
                <FloraIQLogo size="md" />
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
            © 2025 FloraIQ. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

