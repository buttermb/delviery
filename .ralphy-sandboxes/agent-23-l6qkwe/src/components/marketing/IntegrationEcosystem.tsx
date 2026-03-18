/**
 * IntegrationEcosystem - Clean integration showcase
 * Shows common, easy-to-integrate tools
 */

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Puzzle,
  CreditCard,
  BarChart3,
  Zap,
  MessageSquare,
  Sheet,
  Smartphone,
  ShoppingCart,
  Mail,
  Link2,
  type LucideIcon,
} from "lucide-react";

export function IntegrationEcosystem() {
  // Common, easy-to-integrate tools
  const integrations: { name: string; icon: LucideIcon }[] = [
    { name: "Stripe", icon: CreditCard },
    { name: "QuickBooks", icon: BarChart3 },
    { name: "Zapier", icon: Zap },
    { name: "Slack", icon: MessageSquare },
    { name: "Google Sheets", icon: Sheet },
    { name: "Twilio", icon: Smartphone },
    { name: "Shopify", icon: ShoppingCart },
    { name: "Mailchimp", icon: Mail },
    { name: "Webhook API", icon: Link2 },
  ];

  return (
    <div className="container mx-auto px-4">
      <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

        {/* Left: Text Content */}
        <div className="lg:w-1/2 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-bold mb-6 border border-emerald-100">
            <Puzzle className="w-4 h-4" />
            <span>Integrations</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
            Connects with tools <br />you already use
          </h2>
          <p className="text-xl text-slate-600 mb-10 leading-relaxed">
            FloraIQ integrates with popular business tools. Sync payments, automate workflows, and send notifications without any coding.
          </p>
          <Link to="/integrations">
            <Button
              size="lg"
              className="h-14 px-8 text-lg font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
            >
              See all integrations
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Right: Logo Grid */}
        <div className="lg:w-1/2 w-full">
          <div className="grid grid-cols-3 gap-4" role="list" aria-label="Integration partners">
            {integrations.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.name}
                  className="aspect-square bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center p-4 hover:scale-105 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-lg hover:border-emerald-200 group"
                  role="listitem"
                >
                  <Icon className="w-8 h-8 mb-3 text-slate-400 group-hover:text-emerald-600 transition-colors" aria-hidden="true" />
                  <span className="font-semibold text-slate-600 group-hover:text-emerald-900 text-center text-sm transition-colors">{item.name}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-8 text-center lg:text-left">
            <p className="text-sm font-medium text-slate-500">
              + REST API & Webhooks for custom integrations
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
