import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import Package from "lucide-react/dist/esm/icons/package";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Clock from "lucide-react/dist/esm/icons/clock";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";

interface InventoryItem {
  name: string;
  stock: number;
  status: 'low' | 'good' | 'high';
}

interface Order {
  id: string;
  status: 'pending' | 'processing' | 'completed';
  amount: number;
}

export function InventoryDemo() {
  const [items, setItems] = useState<InventoryItem[]>([
    { name: 'Premium Widget A', stock: 45, status: 'good' },
    { name: 'Deluxe Part B', stock: 12, status: 'low' },
    { name: 'Standard Unit C', stock: 89, status: 'high' },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setItems(prev => prev.map(item => ({
        ...item,
        stock: Math.max(5, item.stock + Math.floor(Math.random() * 10) - 4),
        status: item.stock < 20 ? 'low' : item.stock > 70 ? 'high' : 'good'
      })));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-[hsl(var(--marketing-primary))]" />
        <span className="text-sm font-semibold text-[hsl(var(--marketing-text))]">Live Stock Levels</span>
      </div>
      {items.map((item, idx) => (
        <motion.div
          key={idx}
          layout
          className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--marketing-bg-subtle))]/50 border border-[hsl(var(--marketing-border))]"
        >
          <div className="flex-1">
            <div className="text-sm font-medium text-[hsl(var(--marketing-text))]">{item.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <motion.div
                className="h-1.5 rounded-full bg-[hsl(var(--marketing-bg-subtle))]"
                style={{ width: 80 }}
              >
                <motion.div
                  className={`h-full rounded-full ${item.status === 'low' ? 'bg-destructive' :
                    item.status === 'high' ? 'bg-emerald-500' :
                      'bg-[hsl(var(--marketing-primary))]'
                    }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (item.stock / 100) * 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </motion.div>
              <span className="text-xs text-[hsl(var(--marketing-text-light))]">{item.stock} units</span>
            </div>
          </div>
          {item.status === 'low' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-2 py-1 rounded bg-destructive/10 text-destructive text-xs"
            >
              <AlertCircle className="h-3 w-3" />
              Low
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

export function OrderAutomationDemo() {
  const [orders, setOrders] = useState<Order[]>([
    { id: '#1247', status: 'pending', amount: 245 },
    { id: '#1248', status: 'processing', amount: 189 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setOrders(prev => {
        const updated = prev.map(order => {
          if (order.status === 'pending') return { ...order, status: 'processing' as const };
          if (order.status === 'processing') return { ...order, status: 'completed' as const };
          return order;
        }).filter(o => o.status !== 'completed');

        if (updated.length < 2) {
          updated.push({
            id: `#${1247 + Math.floor(Math.random() * 100)}`,
            status: 'pending',
            amount: Math.floor(Math.random() * 300) + 100
          });
        }
        return updated;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-[hsl(var(--marketing-primary))]" />
        <span className="text-sm font-semibold text-[hsl(var(--marketing-text))]">Auto-Processing Orders</span>
      </div>
      <AnimatePresence mode="popLayout">
        {orders.map((order) => (
          <motion.div
            key={order.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--marketing-bg-subtle))]/50 border border-[hsl(var(--marketing-border))]"
          >
            <div className="flex items-center gap-3">
              <div className="text-sm font-mono font-semibold text-[hsl(var(--marketing-text))]">{order.id}</div>
              <div className={`px-2 py-1 rounded text-xs font-medium ${order.status === 'pending' ? 'bg-amber-500/10 text-amber-600' :
                order.status === 'processing' ? 'bg-blue-500/10 text-blue-600' :
                  'bg-emerald-500/10 text-emerald-600'
                }`}>
                {order.status === 'pending' && '⏳ Pending'}
                {order.status === 'processing' && '⚡ Processing'}
                {order.status === 'completed' && '✓ Complete'}
              </div>
            </div>
            <div className="text-sm font-semibold text-[hsl(var(--marketing-text))]">${order.amount}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function AnalyticsDemo() {
  const [data, setData] = useState([45, 52, 48, 63, 58, 71, 69]);

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => [...prev.slice(1), Math.floor(Math.random() * 40) + 50]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-[hsl(var(--marketing-primary))]" />
        <span className="text-sm font-semibold text-[hsl(var(--marketing-text))]">Revenue Trends</span>
      </div>

      <div className="flex items-end justify-between h-32 gap-2">
        {data.map((value, idx) => (
          <motion.div
            key={idx}
            className="flex-1 bg-gradient-to-t from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-primary))]/40 rounded-t-lg"
            initial={{ height: 0 }}
            animate={{ height: `${value}%` }}
            transition={{ duration: 0.5 }}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-[hsl(var(--marketing-bg-subtle))]/50 border border-[hsl(var(--marketing-border))]">
          <div className="text-xs text-[hsl(var(--marketing-text-light))]">Today</div>
          <div className="text-lg font-bold text-[hsl(var(--marketing-text))]">$2,847</div>
        </div>
        <div className="p-3 rounded-lg bg-[hsl(var(--marketing-bg-subtle))]/50 border border-[hsl(var(--marketing-border))]">
          <div className="text-xs text-[hsl(var(--marketing-text-light))]">This Week</div>
          <div className="text-lg font-bold text-[hsl(var(--marketing-text))]">$18.2K</div>
        </div>
        <div className="p-3 rounded-lg bg-[hsl(var(--marketing-bg-subtle))]/50 border border-[hsl(var(--marketing-border))]">
          <div className="text-xs text-[hsl(var(--marketing-text-light))]">Growth</div>
          <div className="text-lg font-bold text-emerald-500">+24%</div>
        </div>
      </div>
    </div>
  );
}

export function CustomerPortalDemo() {
  const products = [
    { name: 'Premium Package', price: 299, available: true },
    { name: 'Deluxe Bundle', price: 189, available: true },
    { name: 'Starter Kit', price: 99, available: false },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-[hsl(var(--marketing-primary))]" />
        <span className="text-sm font-semibold text-[hsl(var(--marketing-text))]">Customer View</span>
      </div>
      {products.map((product, idx) => (
        <motion.div
          key={idx}
          whileHover={{ scale: 1.02 }}
          className={`p-3 rounded-lg border transition-all ${product.available
            ? 'bg-[hsl(var(--marketing-bg-subtle))]/50 border-[hsl(var(--marketing-border))] cursor-pointer hover:border-[hsl(var(--marketing-primary))]'
            : 'bg-[hsl(var(--marketing-bg-subtle))]/20 border-[hsl(var(--marketing-border))]/50 opacity-60'
            }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[hsl(var(--marketing-text))]">{product.name}</div>
              <div className="text-xs text-[hsl(var(--marketing-text-light))] mt-1">
                {product.available ? 'In Stock' : 'Out of Stock'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-[hsl(var(--marketing-text))]">${product.price}</div>
              {product.available && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-1 px-3 py-1 text-xs rounded-full bg-[hsl(var(--marketing-primary))] text-white"
                >
                  Order
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function FleetDemo() {
  const [deliveries, setDeliveries] = useState([
    { id: 'D1', location: 'Manhattan', progress: 60, status: 'on-route' },
    { id: 'D2', location: 'Brooklyn', progress: 85, status: 'arriving' },
    { id: 'D3', location: 'Queens', progress: 30, status: 'on-route' },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDeliveries(prev => prev.map(d => ({
        ...d,
        progress: Math.min(100, d.progress + Math.floor(Math.random() * 15)),
        status: d.progress > 90 ? 'arriving' : d.progress > 95 ? 'delivered' : 'on-route'
      })));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="h-5 w-5 text-[hsl(var(--marketing-primary))]" />
        <span className="text-sm font-semibold text-[hsl(var(--marketing-text))]">Active Deliveries</span>
      </div>
      {deliveries.map((delivery) => (
        <motion.div
          key={delivery.id}
          layout
          className="p-3 rounded-lg bg-[hsl(var(--marketing-bg-subtle))]/50 border border-[hsl(var(--marketing-border))]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-mono font-semibold text-[hsl(var(--marketing-text))]">{delivery.id}</div>
              <div className="text-xs text-[hsl(var(--marketing-text-light))]">{delivery.location}</div>
            </div>
            {delivery.progress >= 95 ? (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            ) : (
              <div className="text-xs font-medium text-[hsl(var(--marketing-primary))]">{delivery.progress}%</div>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-[hsl(var(--marketing-bg-subtle))]">
            <motion.div
              className="h-full rounded-full bg-[hsl(var(--marketing-primary))]"
              animate={{ width: `${delivery.progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function DisposableMenuDemo() {
  const [qrVisible, setQrVisible] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-[hsl(var(--marketing-primary))]" />
        <span className="text-sm font-semibold text-[hsl(var(--marketing-text))]">Secure Menu Access</span>
      </div>

      <div className="text-center py-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setQrVisible(!qrVisible)}
          className="px-6 py-3 rounded-lg bg-[hsl(var(--marketing-primary))] text-white font-semibold"
        >
          {qrVisible ? 'Hide QR Code' : 'Generate Secure Menu'}
        </motion.button>
      </div>

      <AnimatePresence>
        {qrVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="p-4 rounded-lg bg-[hsl(var(--marketing-bg-subtle))]/50 border border-[hsl(var(--marketing-border))]"
          >
            <div className="w-32 h-32 mx-auto bg-white rounded-lg p-2">
              <div className="w-full h-full bg-gradient-to-br from-[hsl(var(--marketing-primary))]/20 to-[hsl(var(--marketing-primary))]/40 rounded flex items-center justify-center">
                <div className="text-xs font-mono text-[hsl(var(--marketing-primary))]">QR_CODE</div>
              </div>
            </div>
            <div className="text-center mt-3">
              <div className="text-xs text-[hsl(var(--marketing-text-light))]">Expires in 24h</div>
              <div className="text-xs font-mono text-[hsl(var(--marketing-text))] mt-1">ID: #MNU-{Math.floor(Math.random() * 9999)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
