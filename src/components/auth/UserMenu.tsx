import { useNavigate } from 'react-router-dom';
import User from "lucide-react/dist/esm/icons/user";
import Settings from "lucide-react/dist/esm/icons/settings";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import Monitor from "lucide-react/dist/esm/icons/monitor";
import LogOut from "lucide-react/dist/esm/icons/log-out";
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCredits } from '@/hooks/useCredits';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return 'U';
}

function getDisplayName(name?: string, email?: string): string {
  if (name && name.trim()) {
    return name.trim();
  }
  return email || 'User';
}

export function UserMenu() {
  const { admin, tenant, logout } = useTenantAdminAuth();
  const { balance, isFreeTier } = useCredits();
  const navigate = useNavigate();

  const tenantSlug = tenant?.slug;
  const initials = getInitials(admin?.name, admin?.email);
  const displayName = getDisplayName(admin?.name, admin?.email);

  const handleNavigate = (path: string) => {
    if (tenantSlug) {
      navigate(`/${tenantSlug}/admin/${path}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    if (tenantSlug) {
      navigate(`/${tenantSlug}/admin/login`, { replace: true });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="User menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden md:inline-block max-w-[120px] truncate">
            {displayName}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            {admin?.email && (
              <p className="text-xs leading-none text-muted-foreground">
                {admin.email}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isFreeTier && (
          <>
            <div className="px-2 py-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Credits</span>
                <span className="font-medium">{balance.toLocaleString()}</span>
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleNavigate('profile')}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNavigate('settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNavigate('credits')}>
            <CreditCard className="mr-2 h-4 w-4" />
            Credits
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNavigate('sessions')}>
            <Monitor className="mr-2 h-4 w-4" />
            Sessions
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
