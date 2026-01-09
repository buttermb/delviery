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
  Coins,
} from 'lucide-react';
import { PLAN_CONFIG, type PlanKey } from '@/config/planPricing';

interface SignupFeaturesShowcaseProps {
  plan?: 'free' | 'starter' | 'professional' | 'enterprise';
}

// Features for FREE tier - emphasize the generous free offering
const freeFeatures = [
  {
    icon: Coins,
    title: '500 free credits/month',
    description: 'Actions use credits, reset monthly',
    color: 'text-white',
    bgColor: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
  },
  {
    icon: Users,
    title: 'Up to 50 customers',
    description: 'Manage your customer relationships',
    color: 'text-white',
    bgColor: 'bg-gradient-to-br from-blue-500 to-blue-600',
  },
  {
    icon: FileText,
    title: '1 menu per day',
    description: 'Create shareable product catalogs',
    color: 'text-white',
    bgColor: 'bg-gradient-to-br from-purple-500 to-purple-600',
  },
  {
    icon: Package,
    title: '25 products',
    description: 'Build your product catalog',
    color: 'text-white',
    bgColor: 'bg-gradient-to-br from-orange-500 to-orange-600',
  },
];

// Features for paid tiers
const paidFeatures = [
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

export function SignupFeaturesShowcase({ plan = 'free' }: SignupFeaturesShowcaseProps) {
  const isFreePlan = plan === 'free';
  const features = isFreePlan ? freeFeatures : paidFeatures;
  const planConfig = PLAN_CONFIG[plan as PlanKey] || PLAN_CONFIG.starter;

  return (
    <div className="space-y-6">
      {/* Pricing Card - Dynamic based on plan */}
      <Card className={`relative overflow-hidden border shadow-md ${isFreePlan
        ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
        : 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
        }`}>
        <CardContent className="pt-6 relative z-10">
          <div className="text-center mb-4">
            {isFreePlan ? (
              <>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-sm font-medium mb-3">
                  <Sparkles className="h-4 w-4" />
                  FREE Forever
                </div>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold text-emerald-600 dark:text-emerald-400">$0</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">No credit card ever</p>
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-sm font-medium mb-3">
                  <Sparkles className="h-4 w-4" />
                  14-Day Free Trial
                </div>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold text-blue-600 dark:text-blue-400">${planConfig.priceMonthly}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">After trial ends</p>
                </div>
              </>
            )}
          </div>
          <div className="space-y-2 text-sm">
            {isFreePlan ? (
              <>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span>500 credits every month</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span>All core features included</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span>Upgrade anytime for more</span>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Features Grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">What's Included</h3>
        <div className="grid grid-cols-1 gap-3">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="hover:shadow-md transition-all duration-200 border border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-900"
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg ${feature.bgColor.replace('bg-gradient-to-br', 'bg').replace('to-', 'bg-').split(' ')[0]} bg-opacity-10 flex items-center justify-center flex-shrink-0`}>
                    <feature.icon className={`h-5 w-5 ${feature.bgColor.includes('emerald') ? 'text-emerald-600' : feature.bgColor.includes('blue') ? 'text-blue-600' : feature.bgColor.includes('purple') ? 'text-purple-600' : feature.bgColor.includes('orange') ? 'text-orange-600' : 'text-slate-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm mb-1 text-slate-900 dark:text-white">{feature.title}</h4>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Trust Indicators */}
      <Card className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
        <CardContent className="pt-6">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-400" />
              <span className="text-muted-foreground font-medium">SOC 2 Type II Certified</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-400" />
              <span className="text-muted-foreground font-medium">GDPR & CCPA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-400" />
              <span className="text-muted-foreground font-medium">99.9% Uptime SLA</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
