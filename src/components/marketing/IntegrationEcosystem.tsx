/**
 * IntegrationEcosystem - Clean integration showcase
 * Shows common, easy-to-integrate tools
 */

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Puzzle from "lucide-react/dist/esm/icons/puzzle";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import Zap from "lucide-react/dist/esm/icons/zap";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Sheet from "lucide-react/dist/esm/icons/sheet";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Mail from "lucide-react/dist/esm/icons/mail";
import Link2 from "lucide-react/dist/esm/icons/link-2";
import type LucideIcon from "lucide-react/dist/esm/icons/type lucide-icon";

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
    <section className="py-24 bg-white border-y border-[hsl(var(--marketing-border))]">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

          {/* Left: Text Content */}
          <div className="lg:w-1/2 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[hsl(var(--marketing-primary))]/10 text-[hsl(var(--marketing-primary))] text-sm font-bold mb-6">
              <Puzzle className="w-4 h-4" />
              <span>Integrations</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-text))] mb-6 leading-tight">
              Connects with tools <br />you already use
            </h2>
            <p className="text-xl text-[hsl(var(--marketing-text-light))] mb-10 leading-relaxed">
              FloraIQ integrates with popular business tools. Sync payments, automate workflows, and send notifications without any coding.
            </p>
            <Link to="/integrations">
              <Button
                size="lg"
                className="h-14 px-8 text-lg font-bold bg-[hsl(var(--marketing-secondary))] text-white hover:bg-[hsl(var(--marketing-primary))]/90 rounded-lg"
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
                    className="aspect-square bg-[hsl(var(--marketing-bg-subtle))] rounded-xl flex flex-col items-center justify-center p-4 hover:scale-105 transition-all duration-300 cursor-pointer border border-[hsl(var(--marketing-border))] hover:shadow-lg hover:bg-white"
                    role="listitem"
                  >
                    <Icon className="w-8 h-8 mb-2 text-[hsl(var(--marketing-primary))]" aria-hidden="true" />
                    <span className="font-semibold text-[hsl(var(--marketing-text))] text-center text-sm">{item.name}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 text-center lg:text-left">
              <p className="text-sm font-medium text-[hsl(var(--marketing-text-light))]">
                + REST API & Webhooks for custom integrations
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
