import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import {
  Clock,
  CreditCard,
  Check,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    price: 99,
    period: "month",
    description: "Perfect for small businesses",
    features: [
      "50 customers",
      "3 disposable menus",
      "100 products",
      "2 locations",
      "3 team members",
      "Email support",
      "Mobile app access",
    ],
    popular: false,
  },
  {
    name: "Professional",
    price: 199,
    period: "month",
    description: "For growing businesses",
    features: [
      "200 customers",
      "10 disposable menus",
      "500 products",
      "5 locations",
      "10 team members",
      "Priority support",
      "Advanced analytics",
      "API access",
      "Custom branding",
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    price: 499,
    period: "month",
    description: "For large operations",
    features: [
      "Unlimited customers",
      "Unlimited menus",
      "Unlimited products",
      "Unlimited locations",
      "Unlimited team members",
      "24/7 phone support",
      "White-label options",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
    ],
    popular: false,
  },
];

export default function TrialExpiredPage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, logout } = useTenantAdminAuth();

  const handleSelectPlan = (planName: string) => {
    navigate(`/${tenantSlug}/admin/billing?plan=${planName.toLowerCase()}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/saas/login');
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-red-50 to-orange-50">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mx-auto w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
            <Clock className="h-10 w-10 text-red-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
            Your Trial Has Ended
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Choose a plan to continue using {tenant?.business_name || "your account"}
          </p>
          <p className="text-sm text-gray-500">
            💎 All plans include 2% platform fee on sales
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${
                plan.popular
                  ? "border-2 border-[hsl(var(--tenant-primary))] shadow-xl scale-105"
                  : "border-gray-200"
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[hsl(var(--tenant-primary))] text-white px-4 py-1">
                  ⭐ Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl font-bold mb-2">
                  {plan.name}
                </CardTitle>
                <p className="text-sm text-gray-600 mb-4">
                  {plan.description}
                </p>
                <div className="mb-4">
                  <span className="text-5xl font-bold">
                    ${plan.price}
                  </span>
                  <span className="text-gray-600 ml-2">
                    /{plan.period}
                  </span>
                </div>
                <Button
                  onClick={() => handleSelectPlan(plan.name)}
                  className={
                    plan.popular
                      ? "w-full bg-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary))]/90 text-white"
                      : "w-full"
                  }
                  variant={plan.popular ? "default" : "outline"}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Select {plan.name}
                </Button>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Benefits Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Why Upgrade?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Grow Your Business</h3>
                  <p className="text-sm text-gray-600">
                    Manage more customers, products, and locations
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Advanced Features</h3>
                  <p className="text-sm text-gray-600">
                    Access analytics, API, and custom branding
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Priority Support</h3>
                  <p className="text-sm text-gray-600">
                    Get help faster with dedicated support
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-1">Can I cancel anytime?</h4>
              <p className="text-sm text-gray-600">
                Yes! You can cancel your subscription at any time. No long-term contracts.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">What payment methods do you accept?</h4>
              <p className="text-sm text-gray-600">
                We accept all major credit cards via Stripe secure payment processing.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">What happens to my data if I don't upgrade?</h4>
              <p className="text-sm text-gray-600">
                Your data is safe! We'll keep it for 30 days. You can reactivate anytime within this period.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Logout Option */}
        <div className="text-center mt-8">
          <Button variant="ghost" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
