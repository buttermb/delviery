/**
 * Top Navigation Component
 * Main horizontal navigation bar for super admin panel
 * Fixed at top, 64px height, with backdrop blur
 */

import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  DollarSign,
  BarChart3,
  Settings,
  Mail,
  Shield,
  Search,
  Bell,
  ChevronDown,
  User,
  Moon,
  LogOut,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  TrendingUp,
  PieChart,
  LineChart,
  Receipt,
  CreditCard,
  Activity,
  Target,
  Zap,
  Brain,
  TrendingDown,
  FileText,
  Database,
  Code,
  Webhook,
  FileSearch,
  Clock,
  Flag,
  Send,
  MessageSquare,
  Megaphone,
  ShieldCheck,
  Lock,
  Eye,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NavItem } from './NavItem';
import { NavDropdown } from './NavDropdown';
import { MegaMenu } from './MegaMenu';
import { MenuSection } from './MenuSection';
import { MenuItem } from './MenuItem';
import { QuickAction } from './QuickAction';
import { MetricCard } from './MetricCard';
import { SystemStatusIndicator } from '../SystemStatusIndicator';
import { useSuperAdminAuth } from '@/contexts/SuperAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';

interface TopNavProps {
  onCommandPaletteOpen?: () => void;
  onNotificationsOpen?: () => void;
  unreadNotifications?: number;
  atRiskCount?: number;
  securityAlerts?: number;
  systemStatus?: 'healthy' | 'warning' | 'critical';
  className?: string;
}

export function TopNav({
  onCommandPaletteOpen,
  onNotificationsOpen,
  unreadNotifications = 0,
  atRiskCount = 0,
  securityAlerts = 0,
  systemStatus = 'healthy',
  className,
}: TopNavProps) {
  const { superAdmin, logout } = useSuperAdminAuth();
  const env = import.meta.env.MODE === 'production' ? 'production' : 'development';

  // Get admin initials for avatar
  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'SA';
  };

  const adminName = (superAdmin as any)?.full_name || superAdmin?.email || 'Super Admin';
  const adminEmail = superAdmin?.email || '';
  const adminInitials = getInitials((superAdmin as any)?.full_name, superAdmin?.email);

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 h-16 z-50',
        'backdrop-blur-lg bg-background/80 border-b',
        'flex items-center justify-between px-4 md:px-6',
        className
      )}
    >
      {/* Left Section */}
      <div className="flex items-center gap-2 md:gap-6">
        {/* Logo */}
        <Link to="/super-admin/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">F</span>
          </div>
          <span className="font-bold text-lg">FloraIQ</span>
          <Badge variant="outline" className="ml-2 text-[10px]">ADMIN</Badge>
        </Link>

        {/* Primary Navigation - Hidden on mobile, shown on tablet+ */}
        <div className="hidden md:flex items-center gap-1 overflow-x-auto flex-1 max-w-[60vw]">
          {/* Platform Overview */}
          <NavItem
            icon={LayoutDashboard}
            label="Platform"
            to="/super-admin/dashboard"
            shortcut="⌘1"
          />

          {/* Tenants Mega Menu */}
          <NavDropdown
            icon={Building2}
            label="Tenants"
            badge={atRiskCount > 0 ? atRiskCount : undefined}
            shortcut="⌘2"
          >
            <MegaMenu columns={3}>
              <MenuSection title="Management">
                <MenuItem
                  icon={LayoutDashboard}
                  label="All Tenants"
                  to="/super-admin/tenants"
                />
                <MenuItem
                  icon={User}
                  label="Create Tenant"
                  to="/super-admin/tenants/new"
                />
                <MenuItem
                  icon={AlertTriangle}
                  label="At Risk"
                  to="/super-admin/tenants/at-risk"
                  badge={atRiskCount > 0 ? atRiskCount : undefined}
                />
                <MenuItem
                  icon={DollarSign}
                  label="Active Trials"
                  to="/super-admin/tenants/trials"
                />
                <MenuItem
                  icon={XCircle}
                  label="Churned"
                  to="/super-admin/tenants/churned"
                />
              </MenuSection>

              <MenuSection title="Operations">
                <MenuItem
                  icon={User}
                  label="User Management"
                  to="/super-admin/tenants/users"
                />
                <MenuItem
                  icon={Settings}
                  label="Feature Control"
                  to="/super-admin/tenants/features"
                />
                <MenuItem
                  icon={BarChart3}
                  label="Usage Analytics"
                  to="/super-admin/tenants/usage"
                />
                <MenuItem
                  icon={FileText}
                  label="Audit Logs"
                  to="/super-admin/audit-logs"
                />
              </MenuSection>

              <MenuSection title="Quick Actions">
                <QuickAction
                  icon={Search}
                  label="Find Tenant"
                  onClick={() => onCommandPaletteOpen?.()}
                  shortcut="⌘K"
                />
                <QuickAction
                  icon={Download}
                  label="Export Data"
                  onClick={async () => {
                    try {
                      // Fetch all tenants
                      const { data: tenants, error } = await supabase
                        .from('tenants')
                        .select('id, business_name, subscription_status, subscription_plan, mrr, created_at')
                        .order('created_at', { ascending: false });

                      if (error) throw error;

                      // Convert to CSV
                      const headers = ['ID', 'Business Name', 'Status', 'Plan', 'MRR', 'Created At'];
                      const rows = tenants?.map((t) => [
                        t.id,
                        t.business_name || '',
                        t.subscription_status || '',
                        t.subscription_plan || '',
                        (t.mrr as number) || 0,
                        t.created_at || '',
                      ]) || [];

                      const csv = [
                        headers.join(','),
                        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
                      ].join('\n');

                      // Download
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `tenants-export-${new Date().toISOString().split('T')[0]}.csv`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                      
                      toast({
                        title: 'Export successful',
                        description: 'Tenant data exported to CSV',
                      });
                    } catch (error: unknown) {
                      logger.error('Export failed', error, { component: 'TopNav' });
                      toast({
                        variant: 'destructive',
                        title: 'Export failed',
                        description: 'Failed to export tenant data. Please try again.',
                      });
                    }
                  }}
                />
                <QuickAction
                  icon={RefreshCw}
                  label="Sync All"
                  onClick={() => {
                    // Trigger a page refresh to sync all data
                    window.location.reload();
                  }}
                />
              </MenuSection>
            </MegaMenu>
          </NavDropdown>

          {/* Revenue & Billing */}
          <NavDropdown icon={DollarSign} label="Revenue" shortcut="⌘3">
            <MegaMenu columns={2}>
              <MenuSection title="Financial">
                <MenuItem
                  icon={TrendingUp}
                  label="Revenue Overview"
                  to="/super-admin/revenue-analytics"
                />
                <MenuItem
                  icon={BarChart3}
                  label="MRR Analysis"
                  to="/super-admin/revenue-analytics"
                />
                <MenuItem
                  icon={PieChart}
                  label="ARR Tracking"
                  to="/super-admin/revenue-analytics"
                />
                <MenuItem
                  icon={LineChart}
                  label="Forecasting"
                  to="/super-admin/revenue-analytics"
                />
                <MenuItem
                  icon={Receipt}
                  label="Invoices"
                  to="/super-admin/billing/invoices"
                />
                <MenuItem
                  icon={CreditCard}
                  label="Payments"
                  to="/super-admin/billing/payments"
                />
              </MenuSection>

              <MenuSection title="Metrics">
                <MetricCard
                  label="MRR"
                  value="$45,280"
                  change="+12.5%"
                  trend="up"
                />
                <MetricCard
                  label="Churn Rate"
                  value="2.3%"
                  change="-0.5%"
                  trend="down"
                />
                <MetricCard
                  label="ARPU"
                  value="$180"
                  change="+5%"
                  trend="up"
                />
              </MenuSection>
            </MegaMenu>
          </NavDropdown>

          {/* Analytics */}
          <NavDropdown icon={BarChart3} label="Analytics" shortcut="⌘4">
            <MegaMenu columns={2}>
              <MenuSection title="Reports">
                <MenuItem
                  icon={TrendingUp}
                  label="Growth Metrics"
                  to="/super-admin/analytics"
                />
                <MenuItem
                  icon={User}
                  label="Cohort Analysis"
                  to="/super-admin/analytics"
                />
                <MenuItem
                  icon={Activity}
                  label="Engagement"
                  to="/super-admin/analytics"
                />
                <MenuItem
                  icon={Target}
                  label="Conversion Rates"
                  to="/super-admin/analytics"
                />
                <MenuItem
                  icon={Zap}
                  label="Performance"
                  to="/super-admin/analytics"
                />
              </MenuSection>

              <MenuSection title="Business Intelligence">
                <MenuItem
                  icon={Brain}
                  label="AI Insights"
                  to="/super-admin/analytics"
                />
                <MenuItem
                  icon={TrendingDown}
                  label="Churn Analysis"
                  to="/super-admin/analytics"
                />
                <MenuItem
                  icon={DollarSign}
                  label="LTV Calculator"
                  to="/super-admin/analytics"
                />
                <MenuItem
                  icon={FileText}
                  label="Custom Reports"
                  to="/super-admin/report-builder"
                />
              </MenuSection>
            </MegaMenu>
          </NavDropdown>

          {/* Operations */}
          <NavDropdown icon={Settings} label="Operations" shortcut="⌘5">
            <MegaMenu columns={2}>
              <MenuSection title="System">
                <MenuItem
                  icon={Activity}
                  label="System Health"
                  to="/super-admin/monitoring"
                />
                <MenuItem
                  icon={Database}
                  label="Data Explorer"
                  to="/super-admin/data-explorer"
                />
                <MenuItem
                  icon={Code}
                  label="API Usage"
                  to="/super-admin/api-usage"
                />
                <MenuItem
                  icon={Webhook}
                  label="Webhooks"
                  to="/super-admin/webhooks"
                />
                <MenuItem
                  icon={FileSearch}
                  label="Audit Logs"
                  to="/super-admin/audit-logs"
                />
              </MenuSection>

              <MenuSection title="Automation">
                <MenuItem
                  icon={Zap}
                  label="Workflows"
                  to="/super-admin/workflows"
                />
                <MenuItem
                  icon={Clock}
                  label="Scheduled Jobs"
                  to="/super-admin/workflows"
                />
                <MenuItem
                  icon={Bell}
                  label="Alert Rules"
                  to="/super-admin/monitoring"
                />
                <MenuItem
                  icon={Flag}
                  label="Feature Flags"
                  to="/super-admin/feature-flags"
                />
              </MenuSection>
            </MegaMenu>
          </NavDropdown>

          {/* Communication */}
          <NavDropdown icon={Mail} label="Comms" shortcut="⌘6">
            <MenuSection title="">
              <MenuItem
                icon={Send}
                label="Email Campaigns"
                to="/super-admin/communication"
              />
              <MenuItem
                icon={MessageSquare}
                label="Messages"
                to="/super-admin/communication"
              />
              <MenuItem
                icon={Megaphone}
                label="Announcements"
                to="/super-admin/communication"
              />
              <MenuItem
                icon={Bell}
                label="Notifications"
                to="/super-admin/communication"
              />
              <MenuItem
                icon={FileText}
                label="Templates"
                to="/super-admin/communication"
              />
            </MenuSection>
          </NavDropdown>

          {/* Security */}
          <NavDropdown
            icon={Shield}
            label="Security"
            badge={securityAlerts > 0 ? securityAlerts : undefined}
            shortcut="⌘7"
          >
            <MenuSection title="">
              <MenuItem
                icon={ShieldCheck}
                label="Overview"
                to="/super-admin/security"
              />
              <MenuItem
                icon={Lock}
                label="Access Control"
                to="/super-admin/security"
              />
              <MenuItem
                icon={Eye}
                label="Active Sessions"
                to="/super-admin/security"
              />
              <MenuItem
                icon={AlertTriangle}
                label="Incidents"
                to="/super-admin/security"
                badge={securityAlerts > 0 ? securityAlerts : undefined}
              />
              <MenuItem
                icon={FileSearch}
                label="Audit Trail"
                to="/super-admin/audit-logs"
              />
              <MenuItem
                icon={Key}
                label="API Keys"
                to="/super-admin/security"
              />
            </MenuSection>
          </NavDropdown>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 md:gap-3 ml-auto">
        {/* Mobile Menu Button - Only on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => onCommandPaletteOpen?.()}
        >
          <Search className="h-5 w-5" />
        </Button>

        {/* Command Palette Trigger - Desktop */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onCommandPaletteOpen?.()}
          className="gap-2 min-w-[200px] hidden lg:flex"
        >
          <Search className="h-4 w-4" />
          <span className="text-muted-foreground">Quick search...</span>
          <kbd className="ml-auto hidden lg:inline">⌘K</kbd>
        </Button>

        {/* Environment Indicator */}
        <Badge
          variant={env === 'production' ? 'destructive' : 'secondary'}
          className="hidden sm:flex"
        >
          {env === 'production' ? '🔴 PROD' : '🟡 DEV'}
        </Badge>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => onNotificationsOpen?.()}
        >
          <Bell className="h-5 w-5" />
          {unreadNotifications > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </Badge>
          )}
        </Button>

        {/* System Status */}
        <div className="hidden sm:block">
          <SystemStatusIndicator status={systemStatus} />
        </div>

        {/* Admin Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={(superAdmin as any)?.avatar_url} />
                <AvatarFallback>{adminInitials}</AvatarFallback>
              </Avatar>
              <div className="text-left hidden xl:block">
                <div className="text-sm font-medium">{adminName}</div>
                <div className="text-xs text-muted-foreground">Super Admin</div>
              </div>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Preferences
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Shield className="mr-2 h-4 w-4" />
              Security
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Moon className="mr-2 h-4 w-4" />
              Toggle Theme
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => logout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}

