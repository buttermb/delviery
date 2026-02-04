/**
 * VideoShowcase - Light Mode Version
 * Premium demos with clean white/slate aesthetic matching website branding.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause,
  LayoutDashboard, ShoppingCart, Package, QrCode, BarChart3, Truck, Bell, Search, MoreVertical, Filter, Download,
  Plus, Users, Settings, LogOut,
  ArrowUpRight, ArrowDownRight, AlertCircle, TrendingUp, Calendar, Lock, ShieldCheck,
  MessageSquare, Zap, Navigation
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShouldReduceAnimations } from "@/hooks/useReducedMotion";

// --- ULTRA DEMO COMPONENTS (LIGHT MODE) ---

/* 1. DASHBOARD ULTRA */
function DashboardUltra() {
  return (
    <div className="w-full h-full bg-slate-50 flex text-xs font-sans overflow-hidden select-none">
      {/* Sidebar */}
      <div className="w-16 border-r border-slate-200 flex flex-col items-center py-4 gap-4 bg-white z-10">
        <div className="w-8 h-8 rounded-lg bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center text-[hsl(var(--marketing-primary))] mb-2">
          <LayoutDashboard className="w-5 h-5" />
        </div>
        {[BarChart3, Users, ShoppingCart, Settings].map((Icon, i) => (
          <div key={i} className={`p-2 rounded-lg transition-colors ${i === 0 ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}>
            <Icon className="w-5 h-5" />
          </div>
        ))}
        <div className="mt-auto p-2 text-slate-400">
          <LogOut className="w-5 h-5" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Header */}
        <div className="h-14 border-b border-slate-200 flex items-center justify-between px-6 bg-white/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-slate-900 font-bold text-sm">Dashboard</h2>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2 text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
              <Calendar className="w-3 h-3" />
              <span>Today, Jan 24</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-64 h-8 bg-slate-100 border border-slate-200 rounded-full flex items-center px-3 gap-2 text-slate-400 hidden md:flex">
              <Search className="w-3 h-3" />
              <span>Search orders...</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 relative shadow-sm">
              <Bell className="w-4 h-4" />
              <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white" />
            </div>
            <div className="w-8 h-8 rounded-full bg-[hsl(var(--marketing-primary))]/10 border border-[hsl(var(--marketing-primary))]/20" />
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="p-6 grid grid-cols-12 gap-6 overflow-hidden">
          {/* Stats Row */}
          <motion.div
            className="col-span-12 grid grid-cols-4 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.1 } }
            }}
          >
            {[
              { label: "Total Revenue", val: "$24,592.00", trend: "+12.5%", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
              { label: "Active Orders", val: "148", trend: "+4.2%", color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
              { label: "Pending Delivery", val: "32", trend: "-1.1%", color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
              { label: "Avg Order Value", val: "$165.20", trend: "+8.4%", color: "text-purple-600", bg: "bg-purple-50 border-purple-100" }
            ].map((stat, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 }
                }}
                className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between group hover:border-[hsl(var(--marketing-primary))]/30 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{stat.label}</span>
                  <div className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 font-bold ${stat.color} ${stat.bg}`}>
                    {stat.trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.trend}
                  </div>
                </div>
                <div className="text-xl font-bold text-slate-900">{stat.val}</div>
                {/* Mini Sparkline */}
                <div className="h-8 mt-2 flex items-end gap-0.5 opacity-40">
                  {[...Array(12)].map((_, j) => (
                    <div key={j} className="flex-1 bg-slate-400 rounded-t-sm" style={{ height: `${30 + Math.random() * 70}%` }} />
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Chart Area */}
          <div className="col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-slate-800 font-bold text-sm">Revenue Overview</h3>
              <div className="flex gap-2">
                {['1D', '1W', '1M', '1Y'].map(pd => (
                  <div key={pd} className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer ${pd === '1W' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>{pd}</div>
                ))}
              </div>
            </div>
            <div className="h-32 flex items-end gap-1">
              {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 bg-[hsl(var(--marketing-primary))]/20 hover:bg-[hsl(var(--marketing-primary))]/40 rounded-t transition-colors"
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.05 }}
                />
              ))}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="col-span-4 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-slate-800 font-bold text-sm mb-4">Live Activity</h3>
            <div className="space-y-3">
              {[
                { user: "Alex M.", action: "placed order #4921", time: "2m ago", color: "bg-blue-100 text-blue-600" },
                { user: "Sarah K.", action: "updated inventory", time: "5m ago", color: "bg-emerald-100 text-emerald-600" },
                { user: "Mike R.", action: "delivered #4892", time: "18m ago", color: "bg-amber-100 text-amber-600" },
              ].map((act, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${act.color}`}>
                    {act.user.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-600 truncate"><span className="font-bold text-slate-900">{act.user}</span> {act.action}</div>
                    <div className="text-[10px] text-slate-400">{act.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface OrderCard {
  id: number;
  customer: string;
  items: number;
  total: string;
  time: string;
  color: string;
}

/* 2. ORDERS ULTRA */
function OrdersUltra() {
  const reduceAnimations = useShouldReduceAnimations();
  const [notification, setNotification] = useState<{ title: string; msg: string } | null>(null);
  const [columns, setColumns] = useState<{
    new: OrderCard[];
    prep: OrderCard[];
    quality: OrderCard[];
    ready: OrderCard[];
  }>({
    new: [
      { id: 4930, customer: "Green Leaf", items: 12, total: "$1.2k", time: "2m", color: "from-blue-100 to-indigo-100" },
      { id: 4931, customer: "High Tide", items: 5, total: "$420", time: "15m", color: "from-emerald-100 to-teal-100" },
    ],
    prep: [
      { id: 4928, customer: "Urban Well", items: 8, total: "$850", time: "32m", color: "from-amber-100 to-orange-100" },
    ],
    quality: [
      { id: 4926, customer: "Coastal Co", items: 24, total: "$2.1k", time: "45m", color: "from-purple-100 to-pink-100" },
    ],
    ready: [
      { id: 4925, customer: "Med Leaf", items: 6, total: "$540", time: "1h", color: "from-emerald-100 to-teal-100" }
    ]
  });

  useEffect(() => {
    if (reduceAnimations) return;
    let step = 0;
    const interval = setInterval(() => {
      setColumns(prev => {
        const next = { ...prev };
        if (step % 5 === 0 && next.new.length > 0) {
          const item = next.new[0];
          next.new = next.new.slice(1);
          next.prep = [...next.prep, item];
        } else if (step % 5 === 1 && next.prep.length > 0) {
          const item = next.prep[0];
          next.prep = next.prep.slice(1);
          next.quality = [...next.quality, item];
        } else if (step % 5 === 2 && next.quality.length > 0) {
          const item = next.quality[0];
          next.quality = next.quality.slice(1);
          next.ready = [...next.ready, item];
          setNotification({ title: "Order Update", msg: `Order #${item.id} is Ready` });
          setTimeout(() => setNotification(null), 2500);
        } else if (step % 5 === 3 && next.ready.length > 0) {
          next.ready = next.ready.slice(1);
        } else if (step % 5 === 4) {
          const newId = 4933 + Math.floor(step / 5);
          next.new = [...next.new, { id: newId, customer: "New Client", items: Math.floor(Math.random() * 20) + 1, total: `$${Math.floor(Math.random() * 1000) + 100}`, time: "Just now", color: "from-blue-100 to-cyan-100" }];
        }
        return next;
      });
      step++;
    }, 1500);
    return () => clearInterval(interval);
  }, [reduceAnimations]);

  return (
    <div className="w-full h-full bg-slate-50 flex flex-col p-6 font-sans relative overflow-hidden">
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-20 right-8 z-50 w-72 bg-white backdrop-blur-xl border border-slate-200 rounded-2xl p-4 shadow-xl flex gap-3 pointer-events-none"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">{notification.title}</div>
              <div className="text-xs text-slate-500 leading-tight">{notification.msg}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-slate-900 font-bold text-lg">Order Management</h2>
          <div className="text-[10px] px-2 py-0.5 bg-[hsl(var(--marketing-primary))]/10 text-[hsl(var(--marketing-primary))] border border-[hsl(var(--marketing-primary))]/20 rounded-full flex items-center gap-1 font-bold">
            <span className="w-1.5 h-1.5 bg-[hsl(var(--marketing-primary))] rounded-full animate-pulse" /> Live Pipeline
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-[hsl(var(--marketing-primary))] text-white text-xs font-medium flex items-center gap-2 shadow-sm">
          <Plus className="w-3 h-3" /> New Order
        </div>
      </div>

      <div className="flex-1 grid grid-cols-4 gap-4 min-h-0">
        {["New", "Prep", "Quality", "Ready"].map((col, i) => (
          <div key={col} className="flex flex-col h-full bg-white rounded-xl border border-slate-200 p-3 relative shadow-sm">
            <div className="flex justify-between items-center mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${['bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-emerald-500'][i]}`} />
                <span className="text-xs font-bold text-slate-700">{col}</span>
              </div>
              <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">Auto</span>
            </div>
            <div className="flex-1 space-y-3 relative overflow-hidden">
              <AnimatePresence mode="popLayout">
                {(i === 0 ? columns.new : i === 1 ? columns.prep : i === 2 ? columns.quality : columns.ready).map((card: OrderCard) => (
                  <motion.div
                    key={card.id}
                    layoutId={`card-${card.id}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    className="bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-sm group hover:border-[hsl(var(--marketing-primary))]/30 hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] text-slate-400 font-mono">#{card.id}</span>
                      <MoreVertical className="w-3 h-3 text-slate-300" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${card.color || 'from-gray-100 to-slate-100'}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{card.customer}</div>
                        <div className="text-[10px] text-slate-500">{card.items} Items • {card.total}</div>
                      </div>
                    </div>
                    {i === 3 && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] text-indigo-700 font-bold">MK</div>
                        <span className="text-[10px] text-indigo-600 font-medium">Driver Assigned</span>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* 3. INVENTORY ULTRA */
function InventoryUltra() {
  return (
    <div className="w-full h-full bg-slate-50 flex flex-col font-sans p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-slate-900 font-bold text-lg">Inventory Analytics</h2>
          <p className="text-xs text-slate-500">Warehouse A • 1,240 SKUs</p>
        </div>
        <div className="flex gap-2">
          <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-500 shadow-sm"><Download className="w-4 h-4" /></div>
          <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-500 shadow-sm"><Filter className="w-4 h-4" /></div>
          <div className="px-3 py-2 bg-emerald-600 rounded-lg text-white text-xs font-bold shadow-sm">Reorder (3)</div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        {/* Products Grid */}
        <div className="col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
          <div className="flex border-b border-slate-100 px-4 py-3 bg-slate-50">
            <div className="w-8"></div>
            <div className="flex-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product</div>
            <div className="w-24 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Stock</div>
            <div className="w-32 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Status</div>
          </div>
          <div className="flex-1 overflow-visible relative">
            {[
              { name: "Blue Dream", cat: "Flower", stock: 142, status: "Ideal", color: "bg-blue-100 text-blue-600" },
              { name: "OG Kush", cat: "Flower", stock: 85, status: "Good", color: "bg-emerald-100 text-emerald-600" },
              { name: "Sour Diesel", cat: "Extract", stock: 12, status: "Low Stock", color: "bg-amber-100 text-amber-600", warn: true },
              { name: "Gummies", cat: "Edible", stock: 340, status: "Overstock", color: "bg-purple-100 text-purple-600" },
              { name: "Vape Pen", cat: "Accessory", stock: 0, status: "Out of Stock", color: "bg-red-100 text-red-600", crit: true },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="flex items-center px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors relative"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="w-8">
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${item.color}`}>{item.name.charAt(0)}</div>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-800">{item.name}</div>
                  <div className="text-[10px] text-slate-400">{item.cat}</div>
                </div>
                <div className="w-24 text-right">
                  <div className="text-xs font-mono font-bold text-slate-700">{item.stock}</div>
                </div>
                <div className="w-32 flex justify-end">
                  <div className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${item.crit ? 'bg-red-50 text-red-600 border-red-100' : item.warn ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                    {item.status}
                  </div>
                </div>
                {i === 2 && (
                  <motion.div
                    className="absolute inset-x-0 inset-y-0 border-l-2 border-amber-500 bg-amber-50/[0.2]"
                    layoutId="select-highlight"
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Predictive Logic Panel */}
        <div className="col-span-4 flex flex-col gap-4">
          <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4 flex flex-col shadow-sm">
            <h3 className="text-slate-700 text-xs font-bold mb-4 flex gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" />Demand Forecast</h3>
            <div className="flex-1 relative">
              <div className="absolute inset-0 flex items-end gap-1">
                {[30, 45, 35, 60, 50, 75, 65, 90, 80, 55, 40, 60].map((h, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 bg-slate-200 rounded-t-sm relative group hover:bg-[hsl(var(--marketing-primary))]/30 transition-colors"
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                  />
                ))}
              </div>
              {/* Smooth Trend Line Overlay */}
              <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-10" viewBox="0 0 300 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="trendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0,95 C40,95 60,70 90,70 S 150,40 180,50 S 240,65 280,55"
                  fill="none"
                  stroke="url(#trendGradient)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.5, delay: 1, ease: "easeOut" }}
                  style={{ filter: "drop-shadow(0 2px 4px rgba(16, 185, 129, 0.1))" }}
                />
                <motion.circle cx="280" cy="55" r="4" fill="#3b82f6" stroke="white" strokeWidth="2"
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 2.5 }}
                />
              </svg>
            </div>
            <div className="mt-2 text-[10px] text-amber-600 font-bold text-center bg-amber-50 py-1 rounded border border-amber-100 flex items-center justify-center gap-2">
              <AlertCircle className="w-3 h-3" />
              Stockout predicted in 3 days
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* 4. FLEET ULTRA */
function FleetUltra() {
  const [rerouting, setRerouting] = useState(false);
  const [routeType, setRouteType] = useState('direct');

  useEffect(() => {
    const t = setTimeout(() => {
      setRerouting(true);
      setTimeout(() => setRouteType('optimized'), 1000);
      setTimeout(() => setRerouting(false), 2500);
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="w-full h-full bg-slate-50 relative font-sans overflow-hidden">
      {/* Light Mode Map */}
      <div className="absolute inset-0 bg-slate-100">
        <svg className="absolute inset-0 w-full h-full opacity-30" width="100%" height="100%">
          <defs>
            <pattern id="nyc-grid-light" width="100" height="50" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="50" stroke="#cbd5e1" strokeWidth="1.5" />
              <line x1="100" y1="0" x2="100" y2="50" stroke="#cbd5e1" strokeWidth="1.5" />
              <line x1="0" y1="25" x2="100" y2="25" stroke="#e2e8f0" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="url(#nyc-grid-light)" />
          {/* Park Area */}
          <rect x="0" y="0" width="40%" height="45%" fill="#dcfce7" />
          <rect x="2%" y="2%" width="36%" height="41%" fill="#059669" fillOpacity="0.1" stroke="#059669" strokeWidth="1" strokeDasharray="4 2" />
          <text x="5%" y="40%" fill="#059669" fontSize="10" fontWeight="bold" opacity="0.6">CENTRAL PARK</text>
        </svg>

        {/* Street Names Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-40 text-[8px] font-mono text-slate-500 font-bold">
          <div className="absolute top-[50%] left-[20%]">W 42nd St</div>
          <div className="absolute top-[60%] left-[50%]">5th Ave</div>
          <div className="absolute top-[80%] right-[20%]">Broadway</div>
        </div>

        {/* Routes */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 450" preserveAspectRatio="none">
          <motion.path d="M100,450 L100,250 L400,250 L400,100 L600,100" fill="none" stroke="#60a5fa" strokeWidth="4" strokeOpacity="0.5" animate={{ opacity: routeType === 'optimized' ? 0 : 0.5 }} />
          {rerouting && <motion.path d="M200,250 L350,250" fill="none" stroke="#f87171" strokeWidth="6" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} />}
          {routeType === 'optimized' && <motion.path d="M100,450 L100,350 L500,350 L500,100 L600,100" fill="none" stroke="#10b981" strokeWidth="4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />}
        </svg>
      </div>

      {/* Destination Pulse */}
      <div className="absolute top-[22%] right-[25%] pointer-events-none">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20 animate-ping duration-1000"></span>
        <div className="w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm z-10 relative" />
      </div>

      {/* Driver Card */}
      <motion.div
        className="absolute bg-white backdrop-blur-md border border-slate-200 p-3 rounded-lg shadow-xl w-44 z-20"
        animate={{ top: routeType === 'optimized' ? '25%' : '55%', left: routeType === 'optimized' ? '65%' : '45%' }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      >
        <div className="absolute w-3 h-3 bg-white rounded-full -left-1.5 -top-1.5 shadow-lg ring-2 ring-blue-500" />
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <motion.div className="w-2 h-2 rounded-full" animate={{ backgroundColor: rerouting ? '#ef4444' : routeType === 'optimized' ? '#10b981' : '#3b82f6' }} />
            <span className="text-xs font-bold text-slate-900">Mike R.</span>
          </div>
          <span className="text-[10px] bg-slate-100 px-1 rounded text-slate-500 font-mono">D-1</span>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] flex items-center gap-1 font-mono">
          {rerouting ? <span className="text-red-500 animate-pulse">⚠ TRAFFIC on 42nd ST</span> : routeType === 'optimized' ? <span className="text-emerald-600 font-bold">✓ REROUTED VIA 34th</span> : <span className="text-blue-600">Heading North</span>}
        </div>
      </motion.div>

      {/* System Alert Overlay */}
      <AnimatePresence>
        {rerouting && (
          <motion.div
            initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg z-40"
          >
            <Zap className="w-4 h-4" />
            <span className="text-xs font-bold">AVOID DELAY (+12m)</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD */}
      <div className="absolute top-4 left-4 flex justify-between z-30">
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-mono shadow-sm">
          <div className="flex items-center gap-2 mb-1 font-bold"><Navigation className="w-3 h-3 text-emerald-600" /> FLEET TRACKER</div>
          <div className="text-slate-500">Real-time GPS Optimization</div>
        </div>
      </div>
    </div>
  )
}

/* 5. MENUS ULTRA */
function MenusUltra() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep(s => (s + 1) % 3), 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full h-full bg-slate-100 relative overflow-hidden font-sans">
      {/* Background Admin Panel */}
      <div className="absolute inset-0 p-8 opacity-40 blur-[1px] scale-[1.02]">
        <div className="h-full border border-slate-200 bg-white rounded-xl overflow-hidden flex shadow-lg">
          <div className="w-64 border-r border-slate-100 p-4 space-y-4 bg-slate-50">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Security Settings</div>
            {['General', 'Access Control', 'Encryption', 'Audit Logs'].map((item, i) => (
              <div key={i} className={`h-8 w-full rounded flex items-center px-3 text-xs font-medium ${i === 2 ? 'bg-[hsl(var(--marketing-primary))]/10 text-[hsl(var(--marketing-primary))]' : 'text-slate-400'}`}>
                {item}
              </div>
            ))}
          </div>
          <div className="flex-1 p-8 space-y-6">
            <div>
              <h3 className="text-slate-800 font-bold mb-1">Menu Encryption</h3>
              <p className="text-xs text-slate-500">Configure access requirements for this menu.</p>
            </div>
            <div className="space-y-4 max-w-md">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="text-sm font-bold text-slate-800">AES-256 Encryption</div>
                    <div className="text-xs text-slate-500">Military-grade protection</div>
                  </div>
                </div>
                <div className="w-8 h-4 bg-emerald-500 rounded-full relative"><div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm" /></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phone */}
      <div className="absolute inset-0 flex items-center justify-center perspective-1000 z-20">
        <motion.div
          className="w-[280px] h-[520px] bg-slate-900 rounded-[40px] border-[8px] border-slate-700 shadow-2xl relative overflow-hidden"
          initial={{ rotateY: -15, y: 20 }}
          animate={{ rotateY: [-15, -5, -15], y: [20, 10, 20] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none z-50 rounded-[32px]" />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-40" />

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="lock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full bg-slate-800 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-6"><Lock className="w-8 h-8 text-white" /></div>
                <h3 className="text-white font-bold text-lg mb-2 relative inline-flex">
                  <span className="relative z-10">Secure Menu</span>
                  <motion.span
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                  />
                </h3>
                <p className="text-white/50 text-xs mb-8">Enter passphrase to decrypt.</p>
                <div className="w-full h-10 bg-white/10 rounded-lg mb-4 flex items-center px-3">
                  {[1, 2, 3, 4].map(n => <div key={n} className="w-2 h-2 bg-white rounded-full mx-1" />)}
                </div>
                <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 1.5 }} className="h-1 bg-emerald-500 w-full rounded mt-2" />
              </motion.div>
            )}
            {step === 1 && (
              <motion.div key="decrypt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full bg-slate-800 flex flex-col items-center justify-center">
                <ShieldCheck className="w-12 h-12 text-emerald-400 mb-4 animate-bounce" />
                <div className="text-emerald-400 font-mono text-xs">DECRYPTING ASSETS...</div>
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full h-full bg-white flex flex-col pt-12">
                <div className="px-6 mb-4">
                  <div className="text-[10px] text-slate-400 font-mono mb-1">EXP: 23h 59m</div>
                  <h2 className="text-xl font-bold text-slate-900">Premium Selection</h2>
                </div>
                <div className="flex-1 overflow-hidden p-4 grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                      <div className="aspect-square bg-slate-200 rounded-md mb-2" />
                      <div className="h-3 w-3/4 bg-slate-200 rounded mb-1" />
                      <div className="h-3 w-1/2 bg-slate-200 rounded" />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}


// --- MAIN CONTROLLER COMPONENT ---

const slides = [
  { id: "dashboard", title: "Command Center", subtitle: "Real-time Operational Intelligence", description: "Your entire cannabis distribution network visualized in one immersive dashboard.", icon: LayoutDashboard, color: "from-indigo-50 via-white to-white", accent: "text-indigo-600", Demo: DashboardUltra },
  { id: "orders", title: "Workflow Automation", subtitle: "Kanban Order Management", description: "Streamline fulfillment with automated Kanban boards and instant notifications.", icon: ShoppingCart, color: "from-rose-50 via-white to-white", accent: "text-rose-600", Demo: OrdersUltra },
  { id: "inventory", title: "Inventory Intelligence", subtitle: "Predictive Stock Analytics", description: "Prevent stockouts with AI-driven demand forecasting and real-time tracking.", icon: Package, color: "from-emerald-50 via-white to-white", accent: "text-emerald-600", Demo: InventoryUltra },
  { id: "delivery", title: "Fleet Logistics", subtitle: "GPS Tracking & Optimization", description: "Watch your fleet move on a live map with AI-powered route optimization.", icon: Truck, color: "from-blue-50 via-white to-white", accent: "text-blue-600", Demo: FleetUltra },
  { id: "menus", title: "Secure Menus", subtitle: "Encrypted Digital Consumer Experience", description: "Generate self-destructing QR menus for exclusive client access.", icon: QrCode, color: "from-violet-50 via-white to-white", accent: "text-violet-600", Demo: MenusUltra },
];

export function VideoShowcaseLegacy() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying || isHovered) return;
    const interval = 50;
    const duration = 6000;
    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          setActiveSlide(s => (s + 1) % slides.length);
          return 0;
        }
        return p + (100 / (duration / interval));
      });
    }, interval);
    return () => clearInterval(timer);
  }, [isPlaying, isHovered, activeSlide]);

  const currentSlide = slides[activeSlide];
  const DemoComponent = currentSlide.Demo;

  return (
    <section className="py-32 bg-[hsl(var(--marketing-bg))] relative overflow-x-hidden" ref={containerRef}>
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className={`absolute inset-0 bg-gradient-to-b ${currentSlide.color}`}
          />
        </AnimatePresence>
      </div>

      <div className="container mx-auto px-4 z-10 relative">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--marketing-primary))]/5 border border-[hsl(var(--marketing-primary))]/10 text-[10px] font-bold text-[hsl(var(--marketing-primary))] mb-6 backdrop-blur-sm uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live Platform Demo
          </div>
          <h2 className="text-4xl md:text-6xl font-bold mb-4 text-[hsl(var(--marketing-text))] tracking-tight">
            Enterprise <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))]">Grade</span>
          </h2>
          <p className="text-lg text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto font-light">
            Hover to interact with the interface. High-fidelity simulations of actual platform capabilities.
          </p>
        </div>

        {/* MAIN DISPLAY FRAME */}
        <div
          className="max-w-[1200px] mx-auto aspect-[16/9] rounded-3xl border border-slate-200 shadow-2xl relative bg-white overflow-hidden group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="absolute inset-0 flex flex-col md:flex-row">
            {/* LEFT CONTROLS */}
            <div className="w-[320px] h-full p-8 flex flex-col justify-between relative z-20 border-r border-slate-100 bg-white/90 backdrop-blur-xl">
              <div className="space-y-8">
                <AnimatePresence mode="wait">
                  <motion.div key={activeSlide} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                    <div className={`p-3 w-fit rounded-xl bg-slate-50 border border-slate-200 ${currentSlide.accent}`}>
                      <currentSlide.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">{currentSlide.title}</h3>
                      <div className={`text-[10px] font-mono uppercase tracking-widest mb-4 opacity-80 ${currentSlide.accent}`}>{currentSlide.subtitle}</div>
                      <p className="text-sm text-slate-500 leading-relaxed">{currentSlide.description}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Navigation List */}
                <div className="space-y-1">
                  {slides.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setActiveSlide(i); setProgress(0); }}
                      className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${activeSlide === i ? "bg-slate-100 text-slate-900 border border-slate-200 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
                    >
                      <s.icon className={`w-4 h-4 ${activeSlide === i ? s.accent : ""}`} />
                      <span className="text-xs font-medium">{s.title}</span>
                      {activeSlide === i && <motion.div layoutId="active-dot" className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-primary))] ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Controls */}
              <div className="space-y-4">
                <div className="space-y-2 cursor-pointer group/timeline">
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden w-full relative">
                    <motion.div className="h-full absolute left-0 top-0 bg-[hsl(var(--marketing-primary))]" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <Button size="icon" variant="ghost" onClick={() => setIsPlaying(!isPlaying)} className="hover:text-slate-700">
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <span className="text-[10px] font-mono font-bold text-slate-500">0{activeSlide + 1} / 0{slides.length}</span>
                </div>
              </div>
            </div>

            {/* RIGHT PREVIEW AREA */}
            <div className="flex-1 relative h-full bg-slate-50 perspective-1000 overflow-hidden">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={activeSlide}
                  initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                  transition={{ duration: 0.5, ease: "circOut" }}
                  className="absolute inset-0 p-6 flex items-center justify-center"
                >
                  <div className="w-full h-full rounded-xl overflow-hidden border border-slate-200 shadow-lg relative bg-white">
                    {/* Window Actions */}
                    <div className="absolute top-4 right-4 z-50 flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    </div>
                    <DemoComponent />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
