/**
 * Financial Command Center
 * 
 * The unified financial hub that replaces fragmented panels.
 * One powerful dashboard with 4 zones for instant financial clarity.
 * 
 * Consolidates:
 * - Executive Dashboard
 * - Hotbox Command Center
 * - Financial pages
 * - Reports overview
 */

import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { RefreshCw, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { SEOHead } from '@/components/SEOHead';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

// Financial Components
import { queryKeys } from '@/lib/queryKeys';
import {
  QuickStatsHeader,
  CashFlowPulse,
  ARCommand,
  FrontedInventoryZone,
  PerformancePulse
} from '@/components/financial';

// Mobile Collapsible Section
interface MobileSectionProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function MobileSection({ title, icon, badge, defaultOpen = false, children }: MobileSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="md:hidden">
      <CollapsibleTrigger className="w-full">
        <div className={cn(
          "flex items-center justify-between p-4 rounded-lg transition-all",
          "bg-zinc-900/80 border border-zinc-800/50 backdrop-blur-xl",
          isOpen && "rounded-b-none border-b-0"
        )}>
          <div className="flex items-center gap-3">
            {icon}
            <span className="font-medium text-zinc-200">{title}</span>
            {badge}
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={cn(
          "p-4 pt-0 rounded-b-lg",
          "bg-zinc-900/80 border border-t-0 border-zinc-800/50 backdrop-blur-xl"
        )}>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function FinancialCommandCenter() {
  const { tenant, admin } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const queryClient = useQueryClient();
  const cashFlowRef = useRef<HTMLDivElement>(null);
  const arRef = useRef<HTMLDivElement>(null);
  const frontedRef = useRef<HTMLDivElement>(null);
  const performanceRef = useRef<HTMLDivElement>(null);

  // Enable realtime sync for financial data
  useRealtimeSync({
    tenantId: tenant?.id,
    tables: ['wholesale_orders', 'wholesale_payments', 'wholesale_clients', 'fronted_inventory'],
    enabled: !!tenant?.id
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.financialCommandCenter.quickStats() });
    queryClient.invalidateQueries({ queryKey: queryKeys.financialCommandCenter.cashFlowPulse() });
    queryClient.invalidateQueries({ queryKey: queryKeys.financialCommandCenter.arCommand() });
    queryClient.invalidateQueries({ queryKey: queryKeys.financialCommandCenter.frontedInventory() });
    queryClient.invalidateQueries({ queryKey: queryKeys.financialCommandCenter.performancePulse() });
  };

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleStatClick = (stat: 'cash' | 'pnl' | 'ar' | 'fronted' | 'alerts') => {
    switch (stat) {
      case 'cash':
      case 'pnl':
        scrollToSection(cashFlowRef);
        break;
      case 'ar':
        scrollToSection(arRef);
        break;
      case 'fronted':
        scrollToSection(frontedRef);
        break;
      case 'alerts':
        scrollToSection(arRef);
        break;
    }
  };

  const userName = admin?.name || admin?.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-dvh bg-zinc-950" data-dark-panel>
      <SEOHead 
        title="Financial Command Center" 
        description="Your unified financial dashboard - cash flow, AR, inventory, performance"
      />

      {/* Page Header - Compact */}
      <div className="px-4 md:px-6 py-4 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-zinc-100">
              {greeting}, {userName}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-zinc-700 hover:bg-zinc-800"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-8 sm:w-8 border-zinc-700 hover:bg-zinc-800"
              onClick={() => navigateToAdmin('settings')}
              aria-label="Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats Header - Sticky below page header */}
      <QuickStatsHeader onStatClick={handleStatClick} />

      {/* Desktop Layout - Organized Bento Grid */}
      <div className="hidden md:block px-4 lg:px-6 py-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Row 1: Cash Flow (wide) + AR Command (narrow) */}
          <div className="grid grid-cols-12 gap-4">
            <div ref={cashFlowRef} className="col-span-7 scroll-mt-32">
              <CashFlowPulse />
            </div>
            <div ref={arRef} className="col-span-5 scroll-mt-32">
              <ARCommand />
            </div>
          </div>

          {/* Row 2: Fronted Inventory (wide) + Performance (narrow) */}
          <div className="grid grid-cols-12 gap-4">
            <div ref={frontedRef} className="col-span-7 scroll-mt-32">
              <FrontedInventoryZone />
            </div>
            <div ref={performanceRef} className="col-span-5 scroll-mt-32">
              <PerformancePulse />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout - Collapsible Sections */}
      <div className="md:hidden p-4 space-y-3">
        {/* Cash Flow - Default Open */}
        <MobileSection
          title="Today's Cash Flow"
          defaultOpen={true}
        >
          <CashFlowPulse />
        </MobileSection>

        {/* AR - Badge for count */}
        <MobileSection
          title="Needs Action"
        >
          <ARCommand />
        </MobileSection>

        {/* Fronted Inventory */}
        <MobileSection
          title="Fronted Inventory"
        >
          <FrontedInventoryZone />
        </MobileSection>

        {/* Performance */}
        <MobileSection
          title="This Month"
        >
          <PerformancePulse />
        </MobileSection>
      </div>

      {/* Footer Attribution */}
      <div className="text-center py-6 text-xs text-zinc-600">
        Financial Command Center • Powered by FloraIQ
      </div>
    </div>
  );
}

