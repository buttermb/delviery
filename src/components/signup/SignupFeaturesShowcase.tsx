import { Card, CardContent } from '@/components/ui/card';
import {
  Users,
  FileText,
  Package,
  Smartphone,
  Shield,
  Zap,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Up to 50 customers',
    description: 'Manage your customer relationships',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: FileText,
    title: '3 disposable menus',
    description: 'Create shareable product catalogs',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  {
    icon: Package,
    title: '100 products',
    description: 'Build your product catalog',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: Smartphone,
    title: 'Mobile app access',
    description: 'Manage on the go',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  {
    icon: Zap,
    title: 'Real-time updates',
    description: 'Instant notifications',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
  {
    icon: Shield,
    title: 'Enterprise security',
    description: 'Bank-level encryption',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
];

export function SignupFeaturesShowcase() {
  return (
    <div className="space-y-6">
      {/* Pricing Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3">
              <Sparkles className="h-4 w-4" />
              14-Day Free Trial
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-4xl font-bold">$99</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">After trial ends</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Full access during trial</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features Grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4">What's Included</h3>
        <div className="grid grid-cols-1 gap-3">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="hover:shadow-md transition-shadow duration-200"
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${feature.bgColor} flex items-center justify-center flex-shrink-0`}>
                    <feature.icon className={`h-5 w-5 ${feature.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm mb-1">{feature.title}</h4>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Trust Indicators */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">SOC 2 Type II Certified</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">GDPR & CCPA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">99.9% Uptime SLA</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

