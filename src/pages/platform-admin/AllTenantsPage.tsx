import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, LogIn } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useNavigate } from 'react-router-dom';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { queryKeys } from '@/lib/queryKeys';

export default function AllTenantsPage() {
    const { isPlatformAdmin, isLoading: authLoading } = usePlatformAdmin();
    const navigate = useNavigate();

    const { data: tenants = [], isLoading } = useQuery({
        queryKey: queryKeys.superAdminTools.allTenantsPage(),
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tenants')
                .select('id, business_name, slug, subscription_plan, subscription_status, created_at')
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) throw error;
            return data;
        },
        enabled: isPlatformAdmin,
    });

    const accessMutation = useMutation({
        mutationFn: async (tenantId: string) => {
            const { data, error } = await supabase.rpc('admin_grant_tenant_access', {
                target_tenant_id: tenantId
            });
            if (error) throw error;
            return data as { success: boolean; slug: string };
        },
        onSuccess: (data) => {
            toast.success("Access Granted", { description: "Redirecting to tenant dashboard..." });
            // Force a hard reload to ensure auth context picks up the new tenant
            window.location.href = `/${data.slug}/admin/dashboard`;
        },
        onError: (error) => {
            toast.error("Access Failed", { description: humanizeError(error) });
        }
    });

    if (authLoading || isLoading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isPlatformAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                <ShieldAlert className="h-16 w-16 text-destructive" />
                <h2 className="text-2xl font-bold">Access Denied</h2>
                <p className="text-muted-foreground">You do not have permission to view this page.</p>
                <Button onClick={() => navigate('/')}>Return Home</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Platform Tenants"
                description="Manage all organizations on the platform."
            />

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Business Name</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tenants.map((tenant) => (
                            <TableRow key={tenant.id}>
                                <TableCell className="font-medium">{tenant.business_name}</TableCell>
                                <TableCell className="font-mono text-xs">{tenant.slug}</TableCell>
                                <TableCell><Badge variant="outline" className="capitalize">{tenant.subscription_plan}</Badge></TableCell>
                                <TableCell>
                                    <Badge variant={tenant.subscription_status === 'active' ? 'default' : 'secondary'}>
                                        {tenant.subscription_status}
                                    </Badge>
                                </TableCell>
                                <TableCell>{formatSmartDate(tenant.created_at)}</TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => accessMutation.mutate(tenant.id)}
                                        disabled={accessMutation.isPending}
                                    >
                                        {accessMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                                        Access
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
