import { useState } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
} from '@/components/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard,
  Receipt,
  TrendingUp,
  Download,
  Plus,
  Check,
  Star,
  Zap,
  Crown,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  price: number;
  features: string[];
  popular?: boolean;
  current?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    features: ['Up to 100 products', 'Basic analytics', '1 team member', 'Email support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    features: ['Up to 1,000 products', 'Advanced analytics', '5 team members', 'Priority support', 'Custom branding'],
    popular: true,
    current: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199,
    features: ['Unlimited products', 'Full analytics suite', 'Unlimited team', 'Dedicated support', 'API access', 'Custom integrations'],
  },
];

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
}

const MOCK_INVOICES: Invoice[] = [
  { id: 'INV-001', date: '2024-01-01', amount: 79, status: 'paid' },
  { id: 'INV-002', date: '2024-02-01', amount: 79, status: 'paid' },
  { id: 'INV-003', date: '2024-03-01', amount: 79, status: 'pending' },
];

export default function BillingSettings() {
  const { tenant } = useTenantAdminAuth();
  const [selectedPlan, setSelectedPlan] = useState('pro');

  const usage = {
    products: { current: 247, limit: 1000 },
    customers: { current: 89, limit: 500 },
    menus: { current: 12, limit: 50 },
  };

  const trialDaysLeft = tenant?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isTrialing = tenant?.subscription_status === 'trial';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground mt-1">
          Manage your subscription, payment methods, and invoices
        </p>
      </div>

      {/* Trial Banner */}
      {isTrialing && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  {trialDaysLeft} days left in trial
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Upgrade now to keep all features
                </p>
              </div>
            </div>
            <Button className="bg-amber-600 hover:bg-amber-700">
              Upgrade Now
            </Button>
          </div>
        </div>
      )}

      {/* Current Plan & Usage */}
      <SettingsSection
        title="Current Plan"
        description="Your active subscription and usage"
        icon={Crown}
      >
        <SettingsCard>
          <div className="flex items-start justify-between pb-6 border-b">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">Pro Plan</h3>
                <Badge variant="secondary">Current</Badge>
              </div>
              <p className="text-2xl font-bold mt-2">
                $79<span className="text-sm font-normal text-muted-foreground">/month</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Billed monthly • Next billing: March 1, 2024
              </p>
            </div>
            <Button variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              Manage Subscription
            </Button>
          </div>

          {/* Usage Meters */}
          <div className="pt-6 space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">Usage This Month</h4>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Products</span>
                  <span className="text-muted-foreground">
                    {usage.products.current} / {usage.products.limit}
                  </span>
                </div>
                <Progress value={(usage.products.current / usage.products.limit) * 100} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Customers</span>
                  <span className="text-muted-foreground">
                    {usage.customers.current} / {usage.customers.limit}
                  </span>
                </div>
                <Progress value={(usage.customers.current / usage.customers.limit) * 100} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Active Menus</span>
                  <span className="text-muted-foreground">
                    {usage.menus.current} / {usage.menus.limit}
                  </span>
                </div>
                <Progress value={(usage.menus.current / usage.menus.limit) * 100} className="h-2" />
              </div>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Available Plans */}
      <SettingsSection
        title="Available Plans"
        description="Compare plans and upgrade"
        icon={TrendingUp}
      >
        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'relative rounded-xl border p-6 transition-all cursor-pointer',
                plan.popular && 'border-primary shadow-lg shadow-primary/10',
                plan.current && 'bg-primary/5',
                !plan.current && 'hover:border-primary/50'
              )}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Star className="h-3 w-3 mr-1" /> Most Popular
                </Badge>
              )}
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-3xl font-bold mt-2">
                    ${plan.price}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                </div>
                
                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-emerald-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Button
                  className="w-full"
                  variant={plan.current ? 'secondary' : 'default'}
                  disabled={plan.current}
                >
                  {plan.current ? 'Current Plan' : 'Upgrade'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Payment Methods */}
      <SettingsSection
        title="Payment Methods"
        description="Manage your payment options"
        icon={CreditCard}
      >
        <SettingsCard>
          <div className="flex items-center justify-between pb-4 border-b">
            <div className="flex items-center gap-4">
              <div className="h-12 w-16 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white text-xs font-bold">
                VISA
              </div>
              <div>
                <p className="font-medium">•••• •••• •••• 4242</p>
                <p className="text-sm text-muted-foreground">Expires 12/25</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Default</Badge>
              <Button variant="ghost" size="sm">Edit</Button>
            </div>
          </div>
          
          <Button variant="outline" className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Add Payment Method
          </Button>
        </SettingsCard>
      </SettingsSection>

      {/* Invoices */}
      <SettingsSection
        title="Billing History"
        description="Download past invoices"
        icon={Receipt}
      >
        <SettingsCard>
          <div className="space-y-2">
            {MOCK_INVOICES.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between py-3 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{invoice.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(invoice.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium">${invoice.amount}</span>
                  <Badge
                    variant={
                      invoice.status === 'paid'
                        ? 'default'
                        : invoice.status === 'pending'
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {invoice.status}
                  </Badge>
                  <Button variant="ghost" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}

