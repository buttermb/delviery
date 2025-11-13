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
    color: 'text-white',
    bgColor: 'bg-gradient-to-br from-blue-500 to-blue-600',
  },
  {
    icon: FileText,
    title: '3 disposable menus',
    description: 'Create shareable product catalogs',
    color: 'text-white',
    bgColor: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
  },
  {
    icon: Package,
    title: '100 products',
    description: 'Build your product catalog',
    color: 'text-white',
    bgColor: 'bg-gradient-to-br from-purple-500 to-purple-600',
  },
  {
    icon: Smartphone,
    title: 'Mobile app access',
    description: 'Manage on the go',
    color: 'text-white',
    bgColor: 'bg-gradient-to-br from-orange-500 to-orange-600',
  },
  {
    icon: Zap,
    title: 'Real-time updates',
    description: 'Instant notifications',
    color: 'text-white',
    bgColor: 'bg-gradient-to-br from-yellow-500 to-yellow-600',
  },
  {
    icon: Shield,
    title: 'Enterprise security',
    description: 'Bank-level encryption',
    color: 'text-white',
    bgColor: 'bg-gradient-to-br from-green-500 to-green-600',
  },
];

export function SignupFeaturesShowcase() {
  return (
    <div className="space-y-6">
      {/* Pricing Card */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-emerald-500/10 backdrop-blur-sm border-2 border-primary/20 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-emerald-500/5" />
        <CardContent className="pt-6 relative z-10">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium mb-3 shadow-lg animate-pulse" style={{ animationDuration: '3s' }}>
              <Sparkles className="h-4 w-4" />
              14-Day Free Trial
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">$79</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">After trial ends</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>Full access during trial</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features Grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">What's Included</h3>
        <div className="grid grid-cols-1 gap-3">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 border-transparent hover:border-primary/20 bg-card/50 backdrop-blur-sm"
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${feature.bgColor} flex items-center justify-center flex-shrink-0 shadow-lg`}>
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
      <Card className="bg-gradient-to-br from-muted/50 to-muted/30 backdrop-blur-sm border-2 border-primary/10">
        <CardContent className="pt-6">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-muted-foreground font-medium">SOC 2 Type II Certified</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-muted-foreground font-medium">GDPR & CCPA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-muted-foreground font-medium">99.9% Uptime SLA</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

