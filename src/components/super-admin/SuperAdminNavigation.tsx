/**
 * Super Admin Navigation Component
 * Quick navigation links for super admin pages
 * Can be used in header or as a dropdown menu
 */

import { Link, useLocation } from 'react-router-dom';
import Building2 from "lucide-react/dist/esm/icons/building-2";
import Activity from "lucide-react/dist/esm/icons/activity";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Database from "lucide-react/dist/esm/icons/database";
import Globe from "lucide-react/dist/esm/icons/globe";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Workflow from "lucide-react/dist/esm/icons/workflow";
import Mail from "lucide-react/dist/esm/icons/mail";
import Flag from "lucide-react/dist/esm/icons/flag";
import Wrench from "lucide-react/dist/esm/icons/wrench";
import Lock from "lucide-react/dist/esm/icons/lock";
import LayoutDashboard from "lucide-react/dist/esm/icons/layout-dashboard";
import Settings from "lucide-react/dist/esm/icons/settings";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navigationItems = [
  { title: 'Dashboard', url: '/super-admin/dashboard', icon: LayoutDashboard },
  { title: 'Tenants', url: '/super-admin/tenants', icon: Building2 },
  { title: 'Monitoring', url: '/super-admin/monitoring', icon: Activity },
  { title: 'Analytics', url: '/super-admin/analytics', icon: BarChart3 },
  { title: 'Revenue Analytics', url: '/super-admin/revenue-analytics', icon: TrendingUp },
  { title: 'Data Explorer', url: '/super-admin/data-explorer', icon: Database },
  { title: 'API Usage', url: '/super-admin/api-usage', icon: Globe },
  { title: 'Audit Logs', url: '/super-admin/audit-logs', icon: FileText },
  { title: 'Workflows', url: '/super-admin/workflows', icon: Workflow },
  { title: 'Communication', url: '/super-admin/communication', icon: Mail },
  { title: 'Feature Flags', url: '/super-admin/feature-flags', icon: Flag },
  { title: 'Report Builder', url: '/super-admin/report-builder', icon: BarChart3 },
  { title: 'Executive Dashboard', url: '/super-admin/executive-dashboard', icon: TrendingUp },
  { title: 'Security', url: '/super-admin/security', icon: Lock },
  { title: 'System Config', url: '/super-admin/system-config', icon: Settings },
  { title: 'Tools', url: '/super-admin/tools', icon: Wrench },
];

export function SuperAdminNavigation() {
  const location = useLocation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="text-[hsl(var(--super-admin-text))]/90 hover:text-[hsl(var(--super-admin-text))] hover:bg-white/10">
          <Activity className="h-4 w-4 mr-2" />
          Navigation
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-[hsl(var(--super-admin-surface))]/95 backdrop-blur-xl border-white/10">
        <DropdownMenuLabel className="text-[hsl(var(--super-admin-text))]">Super Admin</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + '/');
          return (
            <DropdownMenuItem key={item.url} asChild>
              <Link
                to={item.url}
                className={cn(
                  'flex items-center gap-2 cursor-pointer',
                  isActive && 'bg-[hsl(var(--super-admin-primary))]/20 text-[hsl(var(--super-admin-primary))]'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

