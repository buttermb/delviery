import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

export function TeamActivityWidget() {
    const { tenant } = useTenantAdminAuth();

    const { data: team, isLoading } = useQuery({
        queryKey: queryKeys.hotbox.team(tenant?.id),
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

            // For each team member, get their REAL activity for today
            const teamWithActivity = await Promise.all(
                members.map(async (member) => {
                    // Get deliveries count for this specific courier
                    const { count: deliveries } = await (supabase as any)
                        .from('deliveries')
                        .select('*', { count: 'exact', head: true })
                        .eq('tenant_id', tenant.id)
                        .eq('courier_id', member.user_id || member.id)
                        .gte('created_at', today.toISOString());

                    // Get POS transactions for this user (if they processed any)
                    const { count: posTransactions } = await supabase
                        .from('pos_transactions')
                        .select('*', { count: 'exact', head: true })
                        .eq('tenant_id', tenant.id)
                        .eq('cashier_id', member.user_id || member.id)
                        .gte('created_at', today.toISOString());

                    // Determine role-based activity
                    const isCourier = deliveries && deliveries > 0;
                    const isCashier = posTransactions && posTransactions > 0;

                    return {
                        id: member.id,
                        name: member.name || member.email?.split('@')[0] || 'Team Member',
                        role: member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : 'Member',
                        status: 'active' as const,
                        deliveries: deliveries || 0,
                        posTransactions: posTransactions || 0,
                        activityText: isCourier 
                            ? `${deliveries} deliveries` 
                            : isCashier 
                            ? `${posTransactions} sales`
                            : member.role === 'owner' ? 'Managing' : 'Online',
                        avatar: isCourier ? 'DR' : isCashier ? 'CS' : 'TM',
                    };
                })
            );

            return teamWithActivity;
        },
        enabled: !!tenant?.id,
        staleTime: 60 * 1000, // 1 minute
    });

    if (isLoading) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                        TEAM TODAY
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        Loading team activity...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!team || team.length === 0) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                        TEAM TODAY
                        <Badge variant="outline" className="text-xs ml-auto">
                            0 active
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-6">
                        <p className="text-muted-foreground mb-3">No team members yet</p>
                        <p className="text-sm text-muted-foreground">
                            Add team members in Settings → Team to see activity here
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    TEAM TODAY
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
                                <Badge variant="default" className="flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> Active
                                </Badge>
                                <div className="text-sm text-muted-foreground">
                                    {member.activityText}
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
