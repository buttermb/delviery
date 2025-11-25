import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';

export function TeamActivityWidget() {
    const { tenant } = useTenantAdminAuth();

    const { data: team, isLoading } = useQuery({
        queryKey: ['hotbox-team', tenant?.id],
        queryFn: async () => {
            if (!tenant?.id) return [];

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Fetch team members with their activity
            const { data: members, error } = await supabase
                .from('tenant_users')
                .select(`
          id,
          email,
          name,
          role,
          status,
          user_id
        `)
                .eq('tenant_id', tenant.id)
                .eq('status', 'active')
                .limit(10);

            if (error || !members) return [];

            // For each team member, get their activity for today
            const teamWithActivity = await Promise.all(
                members.map(async (member) => {
                    // Get deliveries count for drivers
                    const { count: deliveries } = await supabase
                        .from('deliveries')
                        .select('*', { count: 'exact', head: true })
                        .eq('tenant_id', tenant.id)
                        .eq('courier_id', member.user_id || member.id)
                        .gte('created_at', today.toISOString());

                    // Get orders processed (for sales roles)
                    const { count: ordersProcessed } = await supabase
                        .from('orders')
                        .select('*', { count: 'exact', head: true })
                        .eq('tenant_id', tenant.id)
                        .gte('created_at', today.toISOString());

                    return {
                        id: member.id,
                        name: member.name || member.email?.split('@')[0] || 'Team Member',
                        role: member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : 'Member',
                        status: 'active' as const, // We already filtered for active
                        deliveries: deliveries || 0,
                        sales: Math.floor((ordersProcessed || 0) / Math.max(1, members.length)),
                        avatar: '👤',
                    };
                })
            );

            return teamWithActivity;
        },
        enabled: !!tenant?.id,
        staleTime: 60 * 1000, // 1 minute
    });

    if (isLoading || !team || team.length === 0) return null;

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <span className="text-xl">👥</span> TEAM TODAY
                    <Badge variant="outline" className="text-xs ml-auto">
                        {team.length} active
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {team.slice(0, 5).map((member) => (
                        <div
                            key={member.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{member.avatar}</span>
                                <div>
                                    <div className="font-medium">{member.name}</div>
                                    <div className="text-sm text-muted-foreground">{member.role}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                                    {member.status === 'active' ? '🟢 Active' : '🟡 Away'}
                                </Badge>
                                <div className="text-sm text-muted-foreground">
                                    {member.deliveries > 0 && `${member.deliveries} deliveries`}
                                    {member.deliveries === 0 && member.sales > 0 && `${member.sales} orders`}
                                </div>
                            </div>
                        </div>
                    ))}
                    {team.length > 5 && (
                        <div className="text-center text-sm text-muted-foreground pt-2">
                            +{team.length - 5} more team members
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
