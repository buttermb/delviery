/**
 * IntegrationEcosystem - Flowhub style
 * Clean, flat grid of integrations on light background
 */

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Puzzle } from "lucide-react";

export function IntegrationEcosystem() {
  // Placeholder logos - in a real app these would be SVGs
  const integrations = [
    "METRC", "LeafLogix", "Greenbits",
    "Dutchie", "Jane", "Weedmaps",
    "QuickBooks", "Sage", "OnFleet"
  ];

  return (
    <section className="py-32 bg-white border-y border-[hsl(var(--marketing-border))]">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

          {/* Left: Text Content */}
          <div className="lg:w-1/2 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[hsl(var(--marketing-primary))]/10 text-[hsl(var(--marketing-primary))] text-sm font-bold mb-6">
              <Puzzle className="w-4 h-4" />
              <span>Integrations</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-text))] mb-6 leading-tight">
              Connects with your <br /> everyday tools
            </h2>
            <p className="text-xl text-[hsl(var(--marketing-text-light))] mb-10 leading-relaxed">
              FloraIQ integrates seamlessly with the software you already use. Sync inventory, financials, and compliance data automatically.
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
            <div className="grid grid-cols-3 gap-6">
              {integrations.map((name, index) => (
                <div
                  key={index}
                  className="aspect-square bg-[hsl(var(--marketing-bg))] rounded-xl flex items-center justify-center p-6 grayscale opacity-70 hover:grayscale-0 hover:opacity-100 hover:scale-105 transition-all duration-300 cursor-pointer border border-transparent hover:border-[hsl(var(--marketing-border))] hover:shadow-lg hover:bg-white"
                >
                  {/* Placeholder for actual logo */}
                  <span className="font-bold text-[hsl(var(--marketing-text))] text-center text-sm">{name}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center lg:text-left">
              <p className="text-sm font-medium text-[hsl(var(--marketing-text-light))]">
                + over 50 more native integrations
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
