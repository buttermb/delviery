import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Users,
    ShieldAlert,
    LogOut,
    Wallet
} from 'lucide-react';

export function PlatformSidebar() {
    const location = useLocation();
    const navigate = useNavigate();

    const navItems = [
        { title: 'Tenants', href: '/platform/tenants', icon: Users },
        { title: 'Financials', href: '/platform/financials', icon: Wallet },
        { title: 'Payout Approvals', href: '/platform/payouts', icon: ShieldAlert },
    ];

    const isActive = (href: string) => location.pathname === href;

    return (
        <div className="w-64 h-dvh bg-card border-r flex flex-col fixed left-0 top-0 z-40">
            <div className="p-6 border-b flex items-center gap-3">
                <div className="w-8 h-8 bg-destructive rounded-lg flex items-center justify-center text-destructive-foreground font-bold">P</div>
                <div>
                    <h2 className="font-bold text-sm">Platform Admin</h2>
                    <p className="text-xs text-muted-foreground">Super Access</p>
                </div>
            </div>

            <div className="flex-1 py-6 px-3 space-y-1">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                            isActive(item.href)
                                ? "bg-primary text-primary-foreground font-medium"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                    >
                        <item.icon className="h-4 w-4" />
                        {item.title}
                    </Link>
                ))}
            </div>

            <div className="p-4 border-t">
                <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => navigate('/')}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Exit Platform Mode
                </Button>
            </div>
        </div>
    );
}
