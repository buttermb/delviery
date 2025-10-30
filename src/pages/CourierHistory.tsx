import { useState, useEffect } from 'react';
import { useCourier } from '@/contexts/CourierContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Package, Clock, MapPin, CheckCircle } from 'lucide-react';

interface HistoryOrder {
  id: string;
  order_number: string;
  tracking_code: string;
  status: string;
  total_amount: number;
  delivered_at: string;
  courier_commission: number;
  tip_amount: number;
  merchants: {
    business_name: string;
  };
  addresses: {
    street: string;
    city: string;
  };
}

export default function CourierHistory() {
  const { courier, loading: courierLoading } = useCourier();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (courier && orders.length === 0) {
      fetchHistory();
    }
  }, [period, courier]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let startDate = new Date();
      
      if (period === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else {
        startDate.setDate(startDate.getDate() - 30);
      }

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          tracking_code,
          status,
          total_amount,
          delivered_at,
          tip_amount,
          merchants(business_name),
          addresses(street, city)
        `)
        .eq('courier_id', courier.id)
        .gte('delivered_at', startDate.toISOString())
        .order('delivered_at', { ascending: false });

      if (error) throw error;

      const ordersWithCommission = (data || []).map(order => ({
        ...order,
        courier_commission: parseFloat(order.total_amount.toString()) * (courier.commission_rate / 100)
      }));

      setOrders(ordersWithCommission);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (courierLoading || loading || !courier) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Filter orders by status if needed
  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter(o => o.status === statusFilter);

  const totalDeliveries = filteredOrders.length;
  const totalEarned = filteredOrders.reduce((sum, o) => sum + o.courier_commission + (o.tip_amount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white sticky top-0 z-50">
        <div className="p-6">
          <button
            onClick={() => navigate('/courier/dashboard')}
            className="flex items-center text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <h1 className="text-2xl font-bold mb-2">📋 Delivery History</h1>
          <p className="text-purple-100">Your completed deliveries</p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 space-y-3">
        {/* Period Selector */}
        <div className="bg-white rounded-xl shadow p-2 flex gap-2">
          {(['today', 'week', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`
                flex-1 py-2 rounded-lg font-semibold transition
                ${period === p 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
            >
              {p === 'today' && 'Today'}
              {p === 'week' && 'This Week'}
              {p === 'month' && 'This Month'}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        {orders.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap ${
                statusFilter === 'all' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-white text-gray-600'
              }`}
            >
              All ({orders.length})
            </button>
            <button
              onClick={() => setStatusFilter('delivered')}
              className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap ${
                statusFilter === 'delivered' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-white text-gray-600'
              }`}
            >
              Delivered ({orders.filter(o => o.status === 'delivered').length})
            </button>
            <button
              onClick={() => setStatusFilter('cancelled')}
              className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap ${
                statusFilter === 'cancelled' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-white text-gray-600'
              }`}
            >
              Cancelled ({orders.filter(o => o.status === 'cancelled').length})
            </button>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow">
            <Package className="w-8 h-8 text-purple-600 mb-2" />
            <p className="text-3xl font-bold text-gray-900">{totalDeliveries}</p>
            <p className="text-sm text-gray-600">Deliveries</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow">
            <CheckCircle className="w-8 h-8 text-green-600 mb-2" />
            <p className="text-3xl font-bold text-green-600">${totalEarned.toFixed(2)}</p>
            <p className="text-sm text-gray-600">Earned</p>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="px-4">
        <h3 className="font-bold text-lg mb-3">Completed Deliveries</h3>
        
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {orders.length === 0 ? 'No deliveries yet' : 'No matching deliveries'}
            </h3>
            <p className="text-gray-600">
              {orders.length === 0 
                ? 'Your completed deliveries will appear here' 
                : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map(order => (
              <div key={order.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <p className="font-bold text-gray-900">Order #{order.order_number}</p>
                    </div>
                    <p className="text-sm text-gray-600">{order.merchants?.business_name}</p>
                    <p className="text-xs text-gray-500 flex items-center mt-1">
                      <MapPin className="w-3 h-3 mr-1" />
                      {order.addresses?.street}, {order.addresses?.city}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">
                      ${order.courier_commission.toFixed(2)}
                    </p>
                    {order.tip_amount > 0 && (
                      <p className="text-sm text-gray-600">+${order.tip_amount.toFixed(2)} tip</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t">
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(order.delivered_at).toLocaleDateString()} at {new Date(order.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-purple-600 font-medium">{order.tracking_code}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
