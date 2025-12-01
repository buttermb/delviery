/**
 * Tenant Quick Actions Menu
 * Inline dropdown for common tenant management tasks
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    MoreVertical,
    LogIn,
    Ticket,
    Mail,
    CreditCard,
    Ban,
    CheckCircle,
    Eye,
    TrendingUp,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_KEYS } from '@/constants/storageKeys';

interface TenantQuickActionsProps {
    tenant: {
        id: string;
        business_name: string;
        slug: string;
        subscription_status: string;
        open_tickets_count?: number;
    };
    onViewDetails?: () => void;
    onRefresh?: () => void;
}

export function TenantQuickActions({ tenant, onViewDetails, onRefresh }: TenantQuickActionsProps) {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleLoginAsTenant = async () => {
        setIsLoading(true);
        try {
            // Set tenant context via localStorage (UI state only)
            localStorage.setItem(STORAGE_KEYS.SUPER_ADMIN_TENANT_ID, tenant.id);
            localStorage.setItem('impersonating_tenant', 'true');
            localStorage.setItem('impersonation_timestamp', Date.now().toString());

            toast({
                title: 'Logged in as tenant',
                description: `You are now viewing as ${tenant.business_name}`,
            });

            // Navigate to tenant's admin dashboard
            navigate(`/${tenant.slug}/admin/dashboard`);
        } catch (error) {
            toast({
                title: 'Failed to login',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewSupport = () => {
        // Navigate to support page with tenant filter
        navigate(`/saas/admin/support?tenant=${tenant.id}`);
    };

    const handleSendEmail = () => {
        // Open notification dialog pre-filled with this tenant
        toast({
            title: 'Send Email',
            description: 'Email dialog will open here',
        });
    };

    const handleChangePlan = () => {
        // Open plan change dialog
        toast({
            title: 'Change Plan',
            description: 'Plan change dialog will open here',
        });
    };

    const handleToggleSuspend = async () => {
        const isSuspended = tenant.subscription_status === 'suspended';
        const action = isSuspended ? 'unsuspend' : 'suspend';

        if (!confirm(`Are you sure you want to ${action} ${tenant.business_name}?`)) {
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('tenants')
                .update({
                    subscription_status: isSuspended ? 'active' : 'suspended',
                    suspended_at: isSuspended ? null : new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', tenant.id);

            if (error) throw error;

            toast({
                title: `Tenant ${action}ed`,
                description: `${tenant.business_name} has been ${action}ed`,
            });

            onRefresh?.();
        } catch (error) {
            toast({
                title: `Failed to ${action}`,
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const isSuspended = tenant.subscription_status === 'suspended';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={isLoading}
                    className="h-8 w-8 p-0"
                >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {onViewDetails && (
                    <DropdownMenuItem onClick={onViewDetails}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                    </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={handleLoginAsTenant}>
                    <LogIn className="mr-2 h-4 w-4" />
                    Login as Tenant
                    <kbd className="ml-auto text-xs text-muted-foreground">J</kbd>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleViewSupport}>
                    <Ticket className="mr-2 h-4 w-4" />
                    Support Tickets
                    {tenant.open_tickets_count !== undefined && tenant.open_tickets_count > 0 && (
                        <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-xs">
                            {tenant.open_tickets_count}
                        </Badge>
                    )}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={handleSendEmail}>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Email
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleChangePlan}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Change Plan
                </DropdownMenuItem>

                <DropdownMenuItem>
                    <CreditCard className="mr-2 h-4 w-4" />
                    View Billing
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    onClick={handleToggleSuspend}
                    className={isSuspended ? 'text-green-600' : 'text-destructive'}
                >
                    {isSuspended ? (
                        <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Unsuspend
                        </>
                    ) : (
                        <>
                            <Ban className="mr-2 h-4 w-4" />
                            Suspend
                        </>
                    )}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
