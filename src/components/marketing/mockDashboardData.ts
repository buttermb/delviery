import { DollarSign, ShoppingCart, Users, TrendingUp, Package, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DashboardMetric {
    label: string;
    value: string;
    change: string;
    color: string;
    icon: LucideIcon;
}

interface MockDashboardData {
    metrics: DashboardMetric[];
}

export const mockDashboardData: MockDashboardData = {
    metrics: [
        {
            label: 'Revenue',
            value: '$12,847',
            change: '+18.2%',
            color: 'text-emerald-500',
            icon: DollarSign,
        },
        {
            label: 'Orders',
            value: '384',
            change: '+12.5%',
            color: 'text-blue-500',
            icon: ShoppingCart,
        },
        {
            label: 'Customers',
            value: '1,247',
            change: '+8.1%',
            color: 'text-violet-500',
            icon: Users,
        },
        {
            label: 'Growth',
            value: '23.4%',
            change: '+4.3%',
            color: 'text-amber-500',
            icon: TrendingUp,
        },
        {
            label: 'Products',
            value: '156',
            change: '+3 new',
            color: 'text-cyan-500',
            icon: Package,
        },
        {
            label: 'Deliveries',
            value: '89',
            change: '+15.7%',
            color: 'text-rose-500',
            icon: Truck,
        },
    ],
};
