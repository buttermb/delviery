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
import { RefreshCw, Maximize2, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { SEOHead } from '@/components/SEOHead';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

// Financial Components
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
  icon: React.ReactNode;
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
    queryClient.invalidateQueries({ queryKey: ['financial-quick-stats'] });
    queryClient.invalidateQueries({ queryKey: ['financial-cash-flow-pulse'] });
    queryClient.invalidateQueries({ queryKey: ['financial-ar-command'] });
    queryClient.invalidateQueries({ queryKey: ['financial-fronted-inventory'] });
    queryClient.invalidateQueries({ queryKey: ['financial-performance-pulse'] });
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
    <>
      <SEOHead 
        title="Financial Command Center" 
        description="Your unified financial dashboard - cash flow, AR, inventory, performance"
      />

      {/* Quick Stats Header - Sticky */}
      <QuickStatsHeader onStatClick={handleStatClick} />

      <div className="min-h-screen bg-zinc-950">
        {/* Page Header */}
        <div className="px-4 md:px-6 py-6 border-b border-zinc-800/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-zinc-100">
                {greeting}, {userName}
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                Financial Command Center • {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 hover:bg-zinc-800"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 hover:bg-zinc-800"
                onClick={() => navigateToAdmin('settings')}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop Layout - 2 Column Grid */}
        <div className="hidden md:block p-6">
          <div className="grid grid-cols-5 gap-6">
            {/* Left Column (60%) - Zone A & C */}
            <div className="col-span-3 space-y-6">
              {/* Zone A: Cash Flow Pulse */}
              <div ref={cashFlowRef} className="scroll-mt-20">
                <CashFlowPulse />
              </div>

              {/* Zone C: Fronted Inventory */}
              <div ref={frontedRef} className="scroll-mt-20">
                <FrontedInventoryZone />
              </div>
            </div>

            {/* Right Column (40%) - Zone B & D */}
            <div className="col-span-2 space-y-6">
              {/* Zone B: AR Command */}
              <div ref={arRef} className="scroll-mt-20">
                <ARCommand />
              </div>

              {/* Zone D: Performance Pulse */}
              <div ref={performanceRef} className="scroll-mt-20">
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
            icon={<span className="text-lg">💰</span>}
            defaultOpen={true}
          >
            <CashFlowPulse />
          </MobileSection>

          {/* AR - Badge for count */}
          <MobileSection
            title="Needs Action"
            icon={<span className="text-lg">🚨</span>}
          >
            <ARCommand />
          </MobileSection>

          {/* Fronted Inventory */}
          <MobileSection
            title="Fronted Inventory"
            icon={<span className="text-lg">📦</span>}
          >
            <FrontedInventoryZone />
          </MobileSection>

          {/* Performance */}
          <MobileSection
            title="This Month"
            icon={<span className="text-lg">📈</span>}
          >
            <PerformancePulse />
          </MobileSection>
        </div>

        {/* Footer Attribution */}
        <div className="text-center py-8 text-xs text-zinc-600">
          Financial Command Center • Powered by FloraIQ
        </div>
      </div>
    </>
  );
}

