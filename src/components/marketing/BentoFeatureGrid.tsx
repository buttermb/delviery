/**
 * FeatureGrid - Clean 3-column grid (Flowhub style)
 * Large white cards, soft shadows, indigo icons
 */

import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import Truck from "lucide-react/dist/esm/icons/truck";
import FileCheck from "lucide-react/dist/esm/icons/file-check";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import Users from "lucide-react/dist/esm/icons/users";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";

export function BentoFeatureGrid() {
  const features = [
    {
      title: "Live Inventory Management",
      description: "Real-time sync across your warehouse, sales floor, and e-commerce channels. Never oversell again.",
      icon: BarChart3,
    },
    {
      title: "Compliant Delivery Routing",
      description: "Automated route optimization that adheres to state cannabis delivery regulations and timelines.",
      icon: Truck,
    },
    {
      title: "METRC Integration",
      description: "Two-way synchronization with METRC. Automated manifest creation and package tag tracking.",
      icon: FileCheck,
    },
    {
      title: "Mobile Driver App",
      description: "Give your drivers everything they need: digital manifests, turn-by-turn navigation, and ID scanning.",
      icon: Smartphone,
    },
    {
      title: "Customer CRM",
      description: "Track preferences, order history, and documentation for every dispensary client securely.",
      icon: Users,
    },
    {
      title: "Automated Invoicing",
      description: "Generate compliant invoices and collect payments digitally. Streamline your AR process.",
      icon: CreditCard,
    },
  ];

  return (
    <section className="py-32 bg-[hsl(var(--marketing-bg))]">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-text))] mb-6">
            Everything you need to <br /> scale your distribution
          </h2>
          <p className="text-xl text-[hsl(var(--marketing-text-light))]">
            Purpose-built tools for the complexities of cannabis logistics.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white p-10 rounded-2xl shadow-sm border border-[hsl(var(--marketing-border))] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="w-14 h-14 rounded-xl bg-[hsl(var(--marketing-primary))]/5 flex items-center justify-center mb-6 group-hover:bg-[hsl(var(--marketing-primary))]/10 transition-colors">
                <feature.icon className="w-7 h-7 text-[hsl(var(--marketing-primary))]" />
              </div>
              <h3 className="text-2xl font-bold text-[hsl(var(--marketing-text))] mb-3">
                {feature.title}
              </h3>
              <p className="text-[hsl(var(--marketing-text-light))] leading-relaxed text-lg">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
