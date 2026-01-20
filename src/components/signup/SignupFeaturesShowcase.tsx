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
  variant?: 'default' | 'branding';
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

export function SignupFeaturesShowcase({ plan = 'free', variant = 'default' }: SignupFeaturesShowcaseProps) {
  const isFreePlan = plan === 'free';
  const features = isFreePlan ? freeFeatures : paidFeatures;
  const planConfig = PLAN_CONFIG[plan as PlanKey] || PLAN_CONFIG.starter;

  const isBranding = variant === 'branding';

  // Dynamic Styles
  const cardClasses = isBranding
    ? 'bg-white/10 backdrop-blur-xl border-white/10 text-white shadow-2xl'
    : isFreePlan ? 'bg-background/95 border-border' : 'bg-primary/5 border-primary/20';

  const textPrimary = isBranding ? 'text-white' : 'text-foreground';
  const textMuted = isBranding ? 'text-white/70' : 'text-muted-foreground';
  const pillClasses = isBranding ? 'bg-white/20 text-white border border-white/20' : 'bg-primary/10 text-primary';
  const iconColor = isBranding ? 'text-accent' : 'text-primary';
  const checkIconColor = isBranding ? 'text-accent' : 'text-primary';

  return (
    <div className="space-y-6">
      {/* Pricing Card - Dynamic based on plan */}
      <Card className={`relative overflow-hidden border shadow-sm transition-all duration-200 ${cardClasses}`}>
        <CardContent className="pt-6 relative z-10">
          <div className="text-center mb-6">
            {isFreePlan ? (
              <>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide mb-4 ${pillClasses}`}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Free Forever
                </div>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`text-4xl font-bold ${textPrimary}`}>$0</span>
                    <span className={`${textMuted} text-sm font-medium`}>/mo</span>
                  </div>
                  <p className={`text-xs ${textMuted}`}>No credit card required</p>
                </div>
              </>
            ) : (
              <>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide mb-4 ${pillClasses}`}>
                  <Sparkles className="h-3.5 w-3.5" />
                  14-Day Free Trial
                </div>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`text-4xl font-bold ${textPrimary}`}>${planConfig.priceMonthly}</span>
                    <span className={`${textMuted} text-sm font-medium`}>/mo</span>
                  </div>
                  <p className={`text-xs ${textMuted}`}>After trial period</p>
                </div>
              </>
            )}
          </div>
          <div className="space-y-3 text-sm">
            {isFreePlan ? (
              <>
                <div className={`flex items-center gap-3 ${textMuted}`}>
                  <CheckCircle2 className={`h-4 w-4 ${checkIconColor} shrink-0`} />
                  <span>500 free credits / month</span>
                </div>
                <div className={`flex items-center gap-3 ${textMuted}`}>
                  <CheckCircle2 className={`h-4 w-4 ${checkIconColor} shrink-0`} />
                  <span>All core features included</span>
                </div>
                <div className={`flex items-center gap-3 ${textMuted}`}>
                  <CheckCircle2 className={`h-4 w-4 ${checkIconColor} shrink-0`} />
                  <span>No credit card required</span>
                </div>
              </>
            ) : (
              <>
                <div className={`flex items-center gap-3 ${textMuted}`}>
                  <CheckCircle2 className={`h-4 w-4 ${checkIconColor} shrink-0`} />
                  <span>Full feature access</span>
                </div>
                <div className={`flex items-center gap-3 ${textMuted}`}>
                  <CheckCircle2 className={`h-4 w-4 ${checkIconColor} shrink-0`} />
                  <span>Priority support</span>
                </div>
                <div className={`flex items-center gap-3 ${textMuted}`}>
                  <CheckCircle2 className={`h-4 w-4 ${checkIconColor} shrink-0`} />
                  <span>Cancel anytime</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Features Grid */}
      <div>
        <h3 className={`text-lg font-semibold mb-4 ${textPrimary}`}>What's Included</h3>
        <div className="grid grid-cols-1 gap-3">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`flex items-start gap-4 p-3 rounded-lg border border-transparent transition-all ${isBranding
                  ? 'bg-white/5 hover:bg-white/10'
                  : 'bg-background/50 hover:bg-background hover:border-primary/20'
                }`}
            >
              <div className={`p-2 rounded-md ${isBranding ? 'bg-white/10 text-accent' : 'bg-primary/10 text-primary'}`}>
                <feature.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`font-medium text-sm ${textPrimary}`}>{feature.title}</h4>
                <p className={`text-xs mt-0.5 ${textMuted}`}>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust Indicators */}
      {/* Trust Indicators */}
      <Card className={`border shadow-sm ${isBranding ? 'bg-white/5 border-white/5' : 'bg-background/50 border-border'}`}>
        <CardContent className="pt-6">
          <div className="space-y-3 text-sm">
            <div className={`flex items-center gap-2 ${textMuted}`}>
              <Shield className={`h-5 w-5 ${iconColor}`} />
              <span className="font-medium">SOC 2 Type II Certified</span>
            </div>
            <div className={`flex items-center gap-2 ${textMuted}`}>
              <Shield className={`h-5 w-5 ${iconColor}`} />
              <span className="font-medium">GDPR & CCPA Compliant</span>
            </div>
            <div className={`flex items-center gap-2 ${textMuted}`}>
              <Shield className={`h-5 w-5 ${iconColor}`} />
              <span className="font-medium">99.9% Uptime SLA</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
