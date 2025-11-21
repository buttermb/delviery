
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, ShoppingCart, ShieldAlert, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface ActivityItem {
    id: string;
    type: 'view' | 'order' | 'security';
    message: string;
    timestamp: Date;
    metadata?: any;
}

export function LiveActivityFeed() {
    const [activities, setActivities] = useState<ActivityItem[]>([]);

    useEffect(() => {
        // Subscribe to real-time events
        const channel = supabase
            .channel('dashboard-feed')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'menu_access_logs' }, (payload) => {
                addActivity({
                    id: payload.new.id,
                    type: 'view',
                    message: 'New menu view detected',
                    timestamp: new Date(payload.new.created_at),
                    metadata: { ip: payload.new.ip_address }
                });
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'menu_orders' }, (payload) => {
                addActivity({
                    id: payload.new.id,
                    type: 'order',
                    message: `New order received: $${payload.new.total_amount}`,
                    timestamp: new Date(payload.new.created_at)
                });
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'menu_security_events' }, (payload) => {
                addActivity({
                    id: payload.new.id,
                    type: 'security',
                    message: `Security Alert: ${payload.new.event_type}`,
                    timestamp: new Date(payload.new.created_at)
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const addActivity = (activity: ActivityItem) => {
        setActivities(prev => [activity, ...prev].slice(0, 20)); // Keep last 20
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'view': return <Eye className="h-4 w-4 text-blue-400" />;
            case 'order': return <ShoppingCart className="h-4 w-4 text-green-400" />;
            case 'security': return <ShieldAlert className="h-4 w-4 text-red-400" />;
            default: return <Clock className="h-4 w-4 text-gray-400" />;
        }
    };

    return (
        <Card className="h-[400px] p-0 overflow-hidden backdrop-blur-xl bg-background/30 border-white/10">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-semibold">Live Activity</h3>
                <Badge variant="outline" className="animate-pulse bg-green-500/20 text-green-400 border-green-500/30">
                    ● Live
                </Badge>
            </div>
            <ScrollArea className="h-[340px] p-4">
                <AnimatePresence initial={false}>
                    {activities.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            Waiting for events...
                        </div>
                    ) : (
                        activities.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-4 last:mb-0"
                            >
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                                    <div className="mt-1 p-1.5 rounded-full bg-background/50">
                                        {getIcon(item.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{item.message}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                                            </span>
                                            {item.metadata?.ip && (
                                                <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                                    {item.metadata.ip}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </ScrollArea>
        </Card>
    );
}
