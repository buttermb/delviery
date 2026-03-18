import { ShoppingCart, Eye, AlertTriangle, Truck, DollarSign, Package } from 'lucide-react';

export const mockDashboardData = {
  metrics: [
    {
      label: 'Total Revenue',
      value: '$24,580',
      change: '+12.5%',
      icon: DollarSign,
      color: 'text-emerald-500',
      trend: 'up'
    },
    {
      label: 'Orders',
      value: '156',
      change: '+8.2%',
      icon: ShoppingCart,
      color: 'text-blue-500',
      trend: 'up'
    },
    {
      label: 'Active Transfers',
      value: '23',
      change: '+3.1%',
      icon: Truck,
      color: 'text-purple-500',
      trend: 'up'
    },
    {
      label: 'Customers Active',
      value: '48',
      change: '+12%',
      icon: Eye,
      color: 'text-orange-500',
      trend: 'up'
    },
    {
      label: 'Avg Order Value',
      value: '$425',
      change: '+5.3%',
      icon: DollarSign,
      color: 'text-teal-500',
      trend: 'up'
    },
    {
      label: 'Products',
      value: '284',
      change: '+15',
      icon: Package,
      color: 'text-pink-500',
      trend: 'up'
    }
  ],

  salesChart: [
    { day: 'Mon', amount: 2400, orders: 8 },
    { day: 'Tue', amount: 3100, orders: 11 },
    { day: 'Wed', amount: 2800, orders: 9 },
    { day: 'Thu', amount: 3900, orders: 14 },
    { day: 'Fri', amount: 4200, orders: 16 },
    { day: 'Sat', amount: 3800, orders: 12 },
    { day: 'Sun', amount: 3200, orders: 10 }
  ],

  categoryBreakdown: [
    { name: 'Flower', percentage: 65 },
    { name: 'Concentrate', percentage: 25 },
    { name: 'Edible', percentage: 10 }
  ],

  topProducts: [
    { rank: 1, name: 'Blue Dream', quantity: '48 lbs', orders: 12, revenue: 4320, trend: '+15%' },
    { rank: 2, name: 'OG Kush', quantity: '42 lbs', orders: 10, revenue: 3990, trend: '+8%' },
    { rank: 3, name: 'Sour Diesel', quantity: '38 lbs', orders: 9, revenue: 3610, trend: '+12%' },
    { rank: 4, name: 'Gelato', quantity: '35 lbs', orders: 8, revenue: 3325, trend: '+5%' },
    { rank: 5, name: 'Wedding Cake', quantity: '30 lbs', orders: 7, revenue: 2850, trend: '+3%' }
  ],

  activities: [
    { 
      type: 'order', 
      icon: ShoppingCart, 
      message: 'Order #A4B2C placed', 
      value: '$489', 
      time: '2 min ago', 
      status: 'success' 
    },
    { 
      type: 'menu', 
      icon: Eye, 
      message: 'Customer viewed "Premium Strains"', 
      views: '8 views', 
      time: '5 min ago',
      status: 'info'
    },
    { 
      type: 'inventory', 
      icon: AlertTriangle, 
      message: 'Low stock alert: Blue Dream', 
      qty: '12 lbs', 
      time: '8 min ago', 
      status: 'warning' 
    },
    { 
      type: 'transfer', 
      icon: Truck, 
      message: 'Delivery #D8F2 picked up', 
      time: '15 min ago', 
      status: 'info' 
    },
    { 
      type: 'payment', 
      icon: DollarSign, 
      message: 'Payment received - Order #A3B8', 
      value: '$1,240', 
      time: '22 min ago', 
      status: 'success' 
    }
  ],

  inventoryAlerts: [
    { 
      name: 'Blue Dream', 
      location: 'Warehouse A', 
      current: 12, 
      threshold: 30, 
      urgency: 'critical' 
    },
    { 
      name: 'Gorilla Glue', 
      location: 'Warehouse B', 
      current: 18, 
      threshold: 30, 
      urgency: 'warning' 
    },
    { 
      name: 'Northern Lights', 
      location: 'Warehouse A', 
      current: 25, 
      threshold: 30, 
      urgency: 'low' 
    }
  ],

  pendingTransfers: [
    { 
      id: 'D8F2', 
      customer: 'Green Valley Co.', 
      driver: 'Mike Johnson', 
      weight: '45 lbs', 
      value: '$4,230',
      time: 'Today 2:30 PM', 
      status: 'assigned' 
    },
    { 
      id: 'D9A3', 
      customer: 'Summit Dispensary', 
      driver: 'Sarah Lee', 
      weight: '38 lbs', 
      value: '$3,610',
      time: 'Today 4:00 PM', 
      status: 'scheduled' 
    },
    { 
      id: 'D0B4', 
      customer: 'Pacific Coast', 
      driver: 'Unassigned', 
      weight: '52 lbs', 
      value: '$4,940',
      time: 'Tomorrow 10:00 AM', 
      status: 'scheduled' 
    }
  ],

  locations: [
    { name: 'Warehouse A', lat: 37.7749, lng: -122.4194, type: 'warehouse' },
    { name: 'Warehouse B', lat: 37.7849, lng: -122.4094, type: 'warehouse' },
    { name: 'Warehouse C', lat: 37.7649, lng: -122.4294, type: 'warehouse' },
    { name: 'Runner: Mike', lat: 37.7699, lng: -122.4144, type: 'runner' },
    { name: 'Runner: Sarah', lat: 37.7799, lng: -122.4244, type: 'runner' }
  ]
};
