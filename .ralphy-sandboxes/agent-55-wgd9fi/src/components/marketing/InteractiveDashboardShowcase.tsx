/**
 * InteractiveDashboardShowcase - Clean dashboard preview
 * Simple product screenshot with stats, no animations
 */

import {
  TrendingUp,
  Package,
  Users,
  DollarSign,
} from 'lucide-react';

const stats = [
  { label: 'Orders Today', value: '1,247', icon: TrendingUp },
  { label: 'Products', value: '2,843', icon: Package },
  { label: 'Active Clients', value: '456', icon: Users },
  { label: 'Monthly Revenue', value: '$124K', icon: DollarSign },
];

export function InteractiveDashboardShowcase() {
  return (
    <section className="py-24 bg-[hsl(var(--marketing-bg))]">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))] tracking-tight">
              Your dashboard, simplified
            </h2>
            <p className="text-lg text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto">
              Everything you need to run your operation, all in one place.
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="p-6 rounded-xl bg-[hsl(var(--marketing-bg-subtle))] border border-[hsl(var(--marketing-border))]"
                >
                  <Icon className="w-6 h-6 text-[hsl(var(--marketing-primary))] mb-3" />
                  <div className="text-2xl font-bold text-[hsl(var(--marketing-text))] mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-[hsl(var(--marketing-text-light))]">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dashboard Preview */}
          <div className="rounded-xl border border-[hsl(var(--marketing-border))] overflow-hidden bg-[hsl(var(--marketing-bg-subtle))]">
            {/* Browser Chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg))]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-4">
                <div className="h-6 rounded bg-[hsl(var(--marketing-bg-subtle))] max-w-md mx-auto flex items-center justify-center text-xs text-[hsl(var(--marketing-text-light))]">
                  app.floraiq.com/dashboard
                </div>
              </div>
            </div>

            {/* Screenshot Placeholder */}
            <div className="aspect-[16/9] flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-xl bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-[hsl(var(--marketing-primary))]" />
                </div>
                <p className="text-[hsl(var(--marketing-text-light))]">
                  Dashboard screenshot goes here
                </p>
                <p className="text-sm text-[hsl(var(--marketing-text-light))] mt-2">
                  Replace with actual product screenshot
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
