
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface RealtimeMetrics {
    activeUsers: number;
    ordersPerMinute: number;
    revenue: number;
    securityAlerts: number;
}

export class RealtimeDashboardService {
    private supabase;
    private tenantId: string;
    private listeners: ((metrics: RealtimeMetrics) => void)[] = [];
    private currentMetrics: RealtimeMetrics = {
        activeUsers: 0,
        ordersPerMinute: 0,
        revenue: 0,
        securityAlerts: 0
    };

    constructor(supabaseUrl: string, supabaseKey: string, tenantId: string) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.tenantId = tenantId;
    }

    initialize() {
        console.log(`Initializing Realtime Dashboard for tenant ${this.tenantId}`);

        // Subscribe to relevant tables
        this.supabase
            .channel('dashboard-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_access_logs', filter: `tenant_id=eq.${this.tenantId}` },
                () => this.updateActiveUsers())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'menu_orders', filter: `tenant_id=eq.${this.tenantId}` },
                (payload: any) => this.handleNewOrder(payload))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'menu_security_events', filter: `menu_id=in.(select id from disposable_menus where tenant_id='${this.tenantId}')` },
                () => this.updateSecurityAlerts())
            .subscribe();

        // Initial fetch
        this.refreshAllMetrics();
    }

    subscribe(callback: (metrics: RealtimeMetrics) => void) {
        this.listeners.push(callback);
        callback(this.currentMetrics); // Send current state immediately
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.currentMetrics));
    }

    private async updateActiveUsers() {
        // In a real app, this would query a "presence" state or recent logs
        // Mocking for MVP
        const count = Math.floor(Math.random() * 100) + 5;
        this.currentMetrics.activeUsers = count;
        this.notifyListeners();
    }

    private handleNewOrder(payload: any) {
        const order = payload.new;
        this.currentMetrics.ordersPerMinute += 1;
        this.currentMetrics.revenue += order.total_amount || 0;

        // Reset orders per minute counter every minute (simplified)
        setTimeout(() => {
            this.currentMetrics.ordersPerMinute = Math.max(0, this.currentMetrics.ordersPerMinute - 1);
            this.notifyListeners();
        }, 60000);

        this.notifyListeners();
    }

    private updateSecurityAlerts() {
        this.currentMetrics.securityAlerts += 1;
        this.notifyListeners();
    }

    private async refreshAllMetrics() {
        await this.updateActiveUsers();
        // Fetch historical/current values for others if needed
    }
}
