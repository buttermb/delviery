/**
 * VideoShowcase - Phase 5: NYC Map & Real Streets
 * "Ultra" fidelity demos with NYC Manhattan Grid and strict 90-degree street routing.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Play, Pause,
  LayoutDashboard, ShoppingCart, Package, QrCode, BarChart3, Truck,
  Maximize2, Scan, Bell, Search, Menu, MoreVertical, Filter, Download,
  Plus, Users, Settings, LogOut, Map, Grid, List, Smartphone,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, AlertCircle,
  DollarSign, TrendingUp, Calendar, Lock, Shield, Eye, ShieldCheck, Key,
  MessageSquare, User, Zap, Navigation
} from "lucide-react";
import { Button } from "@/components/ui/button";

// --- ULTRA DEMO COMPONENTS ---

/* 1. DASHBOARD ULTRA */
function DashboardUltra() {
  return (
    <div className="w-full h-full bg-[#0f1115] flex text-xs font-sans overflow-hidden select-none">
      {/* Sidebar */}
      <div className="w-16 border-r border-white/5 flex flex-col items-center py-4 gap-4 bg-[#13151a] z-10">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2">
          <LayoutDashboard className="w-5 h-5" />
        </div>
        {[BarChart3, Users, ShoppingCart, Settings].map((Icon, i) => (
          <div key={i} className={`p-2 rounded-lg transition-colors ${i === 0 ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
            <Icon className="w-5 h-5" />
          </div>
        ))}
        <div className="mt-auto p-2 text-white/40">
          <LogOut className="w-5 h-5" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0f1115]">
        {/* Header */}
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#13151a]/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-white font-medium text-sm">Dashboard</h2>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2 text-white/40 bg-white/5 px-2 py-1 rounded-md border border-white/5">
              <Calendar className="w-3 h-3" />
              <span>Today, Jan 24</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-64 h-8 bg-black/40 border border-white/5 rounded-full flex items-center px-3 gap-2 text-white/30 hidden md:flex">
              <Search className="w-3 h-3" />
              <span>Search orders...</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 relative">
              <Bell className="w-4 h-4" />
              <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full border border-[#13151a]" />
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30" />
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="p-6 grid grid-cols-12 gap-6 overflow-hidden">
          {/* Stats Row */}
          <div className="col-span-12 grid grid-cols-4 gap-4">
            {[
              { label: "Total Revenue", val: "$24,592.00", trend: "+12.5%", color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Active Orders", val: "148", trend: "+4.2%", color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "Pending Delivery", val: "32", trend: "-1.1%", color: "text-amber-400", bg: "bg-amber-500/10" },
              { label: "Avg Order Value", val: "$165.20", trend: "+8.4%", color: "text-purple-400", bg: "bg-purple-500/10" }
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#181a20] rounded-xl border border-white/5 p-4 flex flex-col justify-between group hover:border-white/10 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-white/40 text-[10px] uppercase font-medium tracking-wider">{stat.label}</span>
                  <div className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${stat.color} ${stat.bg}`}>
                    {stat.trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.trend}
                  </div>
                </div>
                <div className="text-xl font-semibold text-white/90">{stat.val}</div>
                {/* Mini Sparkline */}
                <div className="h-8 mt-2 flex items-end gap-0.5 opacity-30">
                  {[...Array(12)].map((_, j) => (
                    <div key={j} className="flex-1 bg-current rounded-t-sm" style={{ height: `${30 + Math.random() * 70}%` }} />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Main Chart Section */}
          <div className="col-span-8 bg-[#181a20] rounded-xl border border-white/5 p-5 relative overflow-hidden group">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white/80 font-medium">Revenue Analytics</h3>
              <div className="flex gap-2">
                {['1D', '1W', '1M', '1Y'].map(pd => (
                  <div key={pd} className={`px-2 py-1 rounded text-[10px] cursor-pointer transition-colors ${pd === '1W' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white'}`}>{pd}</div>
                ))}
              </div>
            </div>
            <div className="h-48 w-full relative">
              {/* Chart Grid */}
              <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-white/10">
                {[40, 30, 20, 10, 0].map(tx => <div key={tx} className="w-full border-b border-white/5">{tx}k</div>)}
              </div>
              {/* Animated Area Chart */}
              <svg className="absolute inset-0 w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0,150 Q40,120 80,140 T160,110 T240,160 T320,90 T400,100 T480,60 T560,80 V200 H0 Z"
                  fill="url(#chartGradient)"
                  initial={{ opacity: 0, d: "M0,200 Q40,200 80,200 T160,200 T240,200 T320,200 T400,200 T480,200 T560,200 V200 H0 Z" }}
                  animate={{ opacity: 1, d: "M0,150 Q40,120 80,140 T160,110 T240,160 T320,90 T400,100 T480,60 T560,80 V200 H0 Z" }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
                <motion.path
                  d="M0,150 Q40,120 80,140 T160,110 T240,160 T320,90 T400,100 T480,60 T560,80"
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              </svg>
              {/* Cursor Tooltip Simulation */}
              <motion.div
                className="absolute top-0 bottom-0 w-px bg-white/20 border-l border-dashed border-white/30"
                initial={{ left: '20%' }}
                animate={{ left: ['20%', '40%', '70%', '50%'] }}
                transition={{ duration: 5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
              >
                <div className="absolute top-10 left-2 bg-[#252830] border border-white/10 p-2 rounded shadow-xl whitespace-nowrap z-10">
                  <div className="text-[10px] text-white/40">12:30 PM</div>
                  <div className="text-sm font-bold text-white">$2,840.50</div>
                </div>
                <div className="absolute top-[90px] -left-[3px] w-2 h-2 bg-indigo-500 rounded-full border-2 border-[#181a20]" />
              </motion.div>
            </div>
          </div>

          {/* Live Feed Sidebar */}
          <div className="col-span-4 bg-[#181a20] rounded-xl border border-white/5 p-5 flex flex-col">
            <h3 className="text-white/80 font-medium mb-4">Live Activity</h3>
            <div className="space-y-4 overflow-hidden relative">
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#181a20] to-transparent z-10" />
              {[
                { user: "Alex M.", action: "placed order #4921", time: "2m ago", img: "AM" },
                { user: "Sarah K.", action: "updated inventory", time: "5m ago", img: "SK" },
                { user: "System", action: "backup  completed", time: "12m ago", img: "SYS" },
                { user: "Mike R.", action: "started delivery", time: "18m ago", img: "MR" },
              ].map((act, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                >
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-[10px] text-white/50">
                    {act.img}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-white/80"><span className="font-medium text-white">{act.user}</span> {act.action}</div>
                    <div className="text-[10px] text-white/30">{act.time}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* 2. ORDERS ULTRA */
function OrdersUltra() {
  const [notification, setNotification] = useState<null | { title: string, msg: string }>(null);

  // Fully Populated Initial State
  const [columns, setColumns] = useState({
    new: [
      { id: 4930, customer: "Green Leaf", items: 12, total: "$1.2k", time: "2m", color: "from-blue-500 to-indigo-500" },
      { id: 4931, customer: "High Tide", items: 5, total: "$420", time: "15m", color: "from-blue-500 to-cyan-500" },
      { id: 4932, customer: "Canna Club", items: 3, total: "$150", time: "1m", color: "from-indigo-500 to-purple-500" }
    ],
    prep: [
      { id: 4928, customer: "Urban Well", items: 8, total: "$850", time: "32m", color: "from-amber-500 to-orange-500" },
      { id: 4929, customer: "Pure Life", items: 15, total: "$1.8k", time: "40m", color: "from-orange-500 to-red-500" }
    ],
    quality: [
      { id: 4926, customer: "Coastal Co", items: 24, total: "$2.1k", time: "45m", color: "from-purple-500 to-pink-500" },
      { id: 4927, customer: "Zen Gardens", items: 2, total: "$90", time: "50m", color: "from-pink-500 to-rose-500" }
    ],
    ready: [
      { id: 4925, customer: "Med Leaf", items: 6, total: "$540", time: "1h", color: "from-emerald-500 to-teal-500" }
    ] as any[]
  });

  // Continuous Simulation Loop
  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => {
      setColumns(prev => {
        const next = { ...prev };

        // Cycle actions
        if (step % 5 === 0 && next.new.length > 0) {
          const item = next.new[0];
          next.new = next.new.slice(1);
          next.prep = [...next.prep, item];
        }
        else if (step % 5 === 1 && next.prep.length > 0) {
          const item = next.prep[0];
          next.prep = next.prep.slice(1);
          next.quality = [...next.quality, item];
        }
        else if (step % 5 === 2 && next.quality.length > 0) {
          const item = next.quality[0];
          next.quality = next.quality.slice(1);
          next.ready = [...next.ready, item];
          setNotification({ title: "Order Update", msg: `Order #${item.id} is Ready for Pickup` });
          setTimeout(() => setNotification(null), 2500);
        }
        else if (step % 5 === 3) {
          if (next.ready.length > 0) {
            next.ready = next.ready.slice(1); // Driver Pickup
          }
        }
        else if (step % 5 === 4) {
          // Ingest new order
          const newId = 4933 + Math.floor(step / 5);
          next.new = [...next.new, {
            id: newId,
            customer: ["Blue Sky", "Red River", "Golden Gate"][Math.floor(Math.random() * 3)],
            items: Math.floor(Math.random() * 20) + 1,
            total: `$${Math.floor(Math.random() * 1000) + 100}`,
            time: "Just now",
            color: "from-blue-500 to-cyan-500"
          }];
        }

        return next;
      });
      step++;
    }, 1500); // Fast paced for demo

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full bg-[#0f1115] flex flex-col p-6 font-sans relative overflow-hidden">

      {/* Fake Phone Notification Overlay */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-20 right-8 z-50 w-72 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex gap-3 pointer-events-none"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">{notification.title}</div>
              <div className="text-xs text-white/60 leading-tight">{notification.msg}</div>
              <div className="text-[10px] text-white/30 mt-1">Just now</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold text-lg">Order Management</h2>
          <div className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" /> Live Pipeline
          </div>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium flex items-center gap-2">
            <Plus className="w-3 h-3" /> New Order
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-4 gap-4 min-h-0">
        {["New", "Prep", "Quality", "Ready"].map((col, i) => (
          <div key={col} className="flex flex-col h-full bg-[#181a20] rounded-xl border border-white/5 p-3 relative">
            <div className="flex justify-between items-center mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${['bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-emerald-500'][i]}`} />
                <span className="text-xs font-medium text-white/70">{col}</span>
              </div>
              <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-white/30">Auto</span>
            </div>

            <div className="flex-1 space-y-3 relative overflow-hidden">
              <AnimatePresence mode="popLayout">
                {/* Select the correct array based on column index */}
                {(i === 0 ? columns.new : i === 1 ? columns.prep : i === 2 ? columns.quality : columns.ready).map((card: any) => (
                  <motion.div
                    key={card.id}
                    layoutId={`card-${card.id}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    className="bg-[#202228] p-3 rounded-lg border border-white/5 shadow-lg group hover:border-white/20"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] text-white/40 font-mono">#{card.id}</span>
                      <MoreVertical className="w-3 h-3 text-white/10" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${card.color || 'from-gray-500 to-slate-500'}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white/90 truncate">{card.customer}</div>
                        <div className="text-[10px] text-white/40">{card.items} Items • {card.total}</div>
                      </div>
                    </div>
                    {i === 3 && (
                      <motion.div
                        initial={{ height: 0 }} animate={{ height: 'auto' }}
                        className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2"
                      >
                        <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-[8px] text-white">MK</div>
                        <span className="text-[10px] text-indigo-300">Driver Assigned</span>
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
    <div className="w-full h-full bg-[#0f1115] flex flex-col font-sans p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-semibold text-lg">Inventory Analytics</h2>
          <p className="text-xs text-white/40">Warehouse A • 1,240 SKUs</p>
        </div>
        <div className="flex gap-2">
          <div className="p-2 bg-white/5 rounded-lg border border-white/5 text-white/60"><Download className="w-4 h-4" /></div>
          <div className="p-2 bg-white/5 rounded-lg border border-white/5 text-white/60"><Filter className="w-4 h-4" /></div>
          <div className="px-3 py-2 bg-emerald-600 rounded-lg text-white text-xs font-medium">Reorder (3)</div>
        </div>
      </div>

      {/* Visual Split */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        {/* Product Grid */}
        <div className="col-span-8 bg-[#181a20] rounded-xl border border-white/5 overflow-hidden flex flex-col">
          <div className="flex border-b border-white/5 px-4 py-3 bg-white/[0.02]">
            <div className="w-8"></div>
            <div className="flex-1 text-[10px] font-medium text-white/40 uppercase tracking-wider">Product</div>
            <div className="w-24 text-[10px] font-medium text-white/40 uppercase tracking-wider text-right">Stock</div>
            <div className="w-32 text-[10px] font-medium text-white/40 uppercase tracking-wider text-right">Status</div>
          </div>
          <div className="flex-1 overflow-visible relative">
            {[
              { name: "Blue Dream", cat: "Flower", stock: 142, status: "Ideal", color: "bg-blue-500" },
              { name: "OG Kush", cat: "Flower", stock: 85, status: "Good", color: "bg-emerald-500" },
              { name: "Sour Diesel", cat: "Extract", stock: 12, status: "Low Stock", color: "bg-amber-500", warn: true },
              { name: "Gummies", cat: "Edible", stock: 340, status: "Overstock", color: "bg-purple-500" },
              { name: "Vape Pen", cat: "Accessory", stock: 0, status: "Out of Stock", color: "bg-red-500", crit: true },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="flex items-center px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors relative"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="w-8">
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white/80 ${item.color} bg-opacity-20`}>{item.name.charAt(0)}</div>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-white/90">{item.name}</div>
                  <div className="text-[10px] text-white/40">{item.cat}</div>
                </div>
                <div className="w-24 text-right">
                  <div className="text-xs font-mono text-white/80">{item.stock}</div>
                </div>
                <div className="w-32 flex justify-end">
                  <div className={`text-[10px] px-2 py-0.5 rounded-full border ${item.crit ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                    item.warn ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}>
                    {item.status}
                  </div>
                </div>
                {i === 2 && (
                  <motion.div
                    className="absolute inset-x-0 inset-y-0 border-l-2 border-amber-500 bg-amber-500/[0.05]"
                    layoutId="select-highlight"
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Predictive Logic Panel */}
        <div className="col-span-4 flex flex-col gap-4">
          {/* Graph Card */}
          <div className="flex-1 bg-[#181a20] rounded-xl border border-white/5 p-4 flex flex-col">
            <h3 className="text-white/80 text-xs font-medium mb-4 flex gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" />Demand Forecast</h3>
            <div className="flex-1 relative">
              <div className="absolute inset-0 flex items-end gap-1">
                {[30, 45, 35, 60, 50, 75, 65, 90, 80, 55, 40, 60].map((h, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 bg-white/10 rounded-t-sm relative group"
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                  >
                    <div className="absolute inset-x-0 bottom-0 top-0 bg-blue-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                ))}
                <svg className="absolute inset-0 overflow-visible z-10 pointer-events-none">
                  <motion.path
                    d="M0,80 C50,70 100,90 150,50 200,30 250,10"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: 1 }}
                  />
                </svg>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-amber-400/80 font-mono text-center">
              ⚠️ Stockout predicted in 3 days
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* 4. FLEET ULTRA: NYC MANHATTAN GRID */
function FleetUltra() {
  const [rerouting, setRerouting] = useState(false);
  const [routeType, setRouteType] = useState('direct'); // 'direct' then 'optimized'

  useEffect(() => {
    // 2s into demo -> Traffic Event -> Reroute
    const t = setTimeout(() => {
      setRerouting(true);
      setTimeout(() => setRouteType('optimized'), 1000); // Snap to new route
      setTimeout(() => setRerouting(false), 2500); // Clear alert
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="w-full h-full bg-[#050510] relative font-sans overflow-hidden">
      {/* 1. NYC MAP BACKGROUND (Manhattan Grid) */}
      <div className="absolute inset-0 bg-[#090b10]">
        <svg className="absolute inset-0 w-full h-full opacity-30" width="100%" height="100%">
          {/* Central Park (Green Zone) - Top Left quadrant */}
          <rect x="0" y="0" width="40%" height="45%" fill="#1e293b" />
          <rect x="2%" y="2%" width="36%" height="41%" fill="#064e3b" fillOpacity="0.4" stroke="#059669" strokeWidth="1" strokeDasharray="4 2" />
          <text x="5%" y="40%" fill="#059669" fontSize="10" fontWeight="bold" opacity="0.8">CENTRAL PARK</text>

          {/* Manhattan Grid Pattern */}
          <defs>
            <pattern id="nyc-grid" width="100" height="50" patternUnits="userSpaceOnUse">
              {/* Avenues (Vertical, wide) */}
              <line x1="0" y1="0" x2="0" y2="50" stroke="#334155" strokeWidth="1.5" />
              <line x1="100" y1="0" x2="100" y2="50" stroke="#334155" strokeWidth="1.5" />
              {/* Streets (Horizontal, narrow) */}
              <line x1="0" y1="10" x2="100" y2="10" stroke="#1e293b" strokeWidth="1" />
              <line x1="0" y1="20" x2="100" y2="20" stroke="#1e293b" strokeWidth="1" />
              <line x1="0" y1="30" x2="100" y2="30" stroke="#1e293b" strokeWidth="1" />
              <line x1="0" y1="40" x2="100" y2="40" stroke="#1e293b" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="url(#nyc-grid)" />
        </svg>

        {/* Street Names Overlay (Faded) */}
        <div className="absolute inset-0 pointer-events-none opacity-20 text-[8px] font-mono text-white">
          <div className="absolute top-[50%] left-[20%]">W 42nd St</div>
          <div className="absolute top-[60%] left-[50%]">5th Ave</div>
          <div className="absolute top-[80%] right-[20%]">Broadway</div>
        </div>

        {/* Routes Logic Layer - STRICT L-SHAPES (Manhattan Geometry) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-linecap-square stroke-linejoin-miter" viewBox="0 0 800 450" preserveAspectRatio="none">
          {/* 
                Driver Start: Bottom Left (100, 400)
                Destination: Top Right (600, 100)
                Grid Logic: Only horizontal/vertical lines
             */}

          {/* Base Route (The "Direct" Path that gets jammed) */}
          {/* Path: Up 8th Ave -> Right on 42nd St -> Up 5th Ave */}
          <motion.path
            d="M100,450 L100,250 L400,250 L400,100 L600,100"
            fill="none" stroke="#3b82f6" strokeWidth="4" strokeOpacity="0.4"
            animate={{ opacity: routeType === 'optimized' ? 0 : 0.4 }}
          />

          {/* Traffic Jam Segment (Red) on 42nd St */}
          {rerouting && (
            <motion.path
              d="M200,250 L350,250"
              fill="none" stroke="#ef4444" strokeWidth="6"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
            />
          )}

          {/* Optimized Route (Green) - Bypasses 42nd St via 34th St */}
          {/* Path: Up 8th Ave -> Right on 34th St (Earlier) -> Up Park Ave -> Dest */}
          {routeType === 'optimized' && (
            <motion.path
              d="M100,450 L100,350 L500,350 L500,100 L600,100"
              fill="none" stroke="#10b981" strokeWidth="4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8 }}
            />
          )}
        </svg>
      </div>

      {/* Floating Driver */}
      <motion.div
        className="absolute bg-black/90 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-2xl w-44 z-20"
        animate={{
          top: routeType === 'optimized' ? '25%' : '55%',
          left: routeType === 'optimized' ? '65%' : '45%'
        }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      >
        <div className="absolute w-2 h-2 bg-white rounded-full -left-1 -top-1 shadow-[0_0_10px_white]" />

        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            {/* Status Dot Logic */}
            <motion.div
              className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]"
              animate={{ backgroundColor: rerouting ? '#ef4444' : routeType === 'optimized' ? '#10b981' : '#3b82f6' }}
            />
            <span className="text-xs font-bold text-white">Mike R.</span>
          </div>
          <span className="text-[10px] bg-white/10 px-1 rounded text-white/60">D-1</span>
        </div>

        {/* STATUS TEXT LOGIC */}
        <div className="mt-2 pt-2 border-t border-white/10 text-[10px] flex items-center gap-1 font-mono">
          {rerouting ? (
            <span className="text-red-400 animate-pulse">⚠ TRAFFIC on 42nd ST</span>
          ) : routeType === 'optimized' ? (
            <span className="text-emerald-400">✓ REROUTED VIA 34th</span>
          ) : (
            <span className="text-blue-400">Heading North</span>
          )}
        </div>
      </motion.div>

      {/* System Alert Overlay */}
      <AnimatePresence>
        {rerouting && (
          <motion.div
            initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            <span className="text-xs font-bold">AVOID DELAY (+12m)</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mission Control HUD */}
      <div className="absolute top-4 left-4 flex justify-between z-30">
        <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 font-mono">
          <div className="flex items-center gap-2 mb-1"><Navigation className="w-3 h-3 text-emerald-500" /> MANHATTAN_GRID_V2</div>
          <div className="text-white/40">REAL-TIME TRAFFIC OPTIMIZATION</div>
        </div>
      </div>
    </div>
  )
}

/* 5. MENUS ULTRA */
function MenusUltra() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setStep(s => (s + 1) % 3);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full h-full bg-[#0f1115] relative overflow-hidden font-sans">
      {/* Background: Admin "Secure Menu Settings" */}
      <div className="absolute inset-0 p-8 opacity-40 blur-[1px] scale-[1.02]">
        <div className="h-full border border-white/5 bg-[#181a20] rounded-xl overflow-hidden flex">
          <div className="w-64 border-r border-white/5 p-4 space-y-4 bg-[#13151a]">
            <div className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">Security Settings</div>
            {['General', 'Access Control', 'Encryption', 'Audit Logs'].map((item, i) => (
              <div key={i} className={`h-8 w-full rounded flex items-center px-3 text-xs ${i === 2 ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30'}`}>
                {item}
              </div>
            ))}
          </div>
          <div className="flex-1 p-8 space-y-6">
            <div>
              <h3 className="text-white font-medium mb-1">Menu Encryption</h3>
              <p className="text-xs text-white/40">Configure access requirements for this generated menu.</p>
            </div>

            <div className="space-y-4 max-w-md">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div className="text-sm text-white">AES-256 Encryption</div>
                    <div className="text-xs text-white/40">Military-grade protection</div>
                  </div>
                </div>
                <div className="w-8 h-4 bg-emerald-500 rounded-full relative"><div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm" /></div>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="text-sm text-white">Auto-Expiration</div>
                    <div className="text-xs text-white/40">Link expires in 24 hours</div>
                  </div>
                </div>
                <div className="w-8 h-4 bg-amber-500 rounded-full relative"><div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm" /></div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-2">
                <label className="text-xs text-white/60">REQUIRE PASSPHRASE</label>
                <div className="h-9 bg-black/40 border border-white/10 rounded flex items-center px-3 text-white/60 font-mono text-xs">
                  ••••••••••••
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Foreground: 3D Floating Phone Flow */}
      <div className="absolute inset-0 flex items-center justify-center perspective-1000 z-20">
        <motion.div
          className="w-[280px] h-[520px] bg-black rounded-[40px] border-[8px] border-[#2a2a2a] shadow-2xl relative overflow-hidden"
          initial={{ rotateY: -15, y: 20 }}
          animate={{ rotateY: [-15, -5, -15], y: [20, 10, 20] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Phone Shine */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none z-50 rounded-[32px]" />

          {/* Dynamic Island */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-40" />

          {/* Screen Content */}
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="lock"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center"
              >
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-6">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Secure Menu</h3>
                <p className="text-white/50 text-xs mb-8">Enter passphrase to decrypt menu contents.</p>
                <div className="w-full h-10 bg-white/10 rounded-lg mb-4 flex items-center px-3">
                  <div className="w-2 h-2 bg-white rounded-full mx-1" />
                  <div className="w-2 h-2 bg-white rounded-full mx-1" />
                  <div className="w-2 h-2 bg-white rounded-full mx-1" />
                  <div className="w-2 h-2 bg-white rounded-full mx-1" />
                </div>
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.5 }}
                  className="h-1 bg-emerald-500 w-full rounded mt-2"
                />
              </motion.div>
            )}
            {step === 1 && (
              <motion.div
                key="decrypt"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="w-full h-full bg-slate-900 flex flex-col items-center justify-center"
              >
                <ShieldCheck className="w-12 h-12 text-emerald-500 mb-4 animate-bounce" />
                <div className="text-emerald-400 font-mono text-xs">DECRYPTING ASSETS...</div>
              </motion.div>
            )}
            {step === 2 && (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="w-full h-full bg-white flex flex-col pt-12"
              >
                <div className="px-6 mb-4">
                  <div className="text-[10px] text-slate-400 font-mono mb-1">EXP: 23h 59m</div>
                  <h2 className="text-xl font-bold text-slate-900">Premium Selection</h2>
                </div>
                <div className="flex-1 overflow-hidden p-4 grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-slate-50 rounded-lg p-2">
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
  {
    id: "dashboard",
    title: "Command Center",
    subtitle: "Real-time Operational Intelligence",
    description: "Your entire cannabis distribution network visualized in one immersive dashboard.",
    icon: LayoutDashboard,
    color: "from-indigo-900/40 via-blue-900/10 to-transparent",
    accent: "text-indigo-400",
    Demo: DashboardUltra
  },
  {
    id: "orders",
    title: "Workflow Automation",
    subtitle: "Kanban Order Management",
    description: "Streamline fulfillment with automated Kanban boards and instant notifications.",
    icon: ShoppingCart,
    color: "from-rose-900/40 via-pink-900/10 to-transparent",
    accent: "text-rose-400",
    Demo: OrdersUltra
  },
  {
    id: "inventory",
    title: "Inventory Intelligence",
    subtitle: "Predictive Stock Analytics",
    description: "Prevent stockouts with AI-driven demand forecasting and real-time tracking.",
    icon: Package,
    color: "from-emerald-900/40 via-teal-900/10 to-transparent",
    accent: "text-emerald-400",
    Demo: InventoryUltra
  },
  {
    id: "delivery",
    title: "Fleet Logistics",
    subtitle: "GPS Tracking & Optimization",
    description: "Watch your fleet move on a live map with AI-powered route optimization.",
    icon: Truck,
    color: "from-blue-900/40 via-cyan-900/10 to-transparent",
    accent: "text-blue-400",
    Demo: FleetUltra
  },
  {
    id: "menus",
    title: "Secure Menus",
    subtitle: "Encrypted Digital Consumer Experience",
    description: "Generate self-destructing QR menus for exclusive client access.",
    icon: QrCode,
    color: "from-violet-900/40 via-purple-900/10 to-transparent",
    accent: "text-violet-400",
    Demo: MenusUltra
  },
];

export function VideoShowcase() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-play Logic
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
    <section className="py-32 bg-[#050505] relative overflow-hidden" ref={containerRef}>
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
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="container mx-auto px-4 z-10 relative">

        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium text-white/70 mb-6 backdrop-blur-sm uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live Platform Demo
          </div>
          <h2 className="text-4xl md:text-6xl font-bold mb-4 text-white tracking-tight">
            Enterprise <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/40">Grade</span>
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto font-light">
            Hover to interact with the interface. High-fidelity simulations of actual platform capabilities.
          </p>
        </div>

        {/* MAIN DISPLAY FRAME */}
        <div
          className="max-w-[1200px] mx-auto aspect-[16/9] rounded-3xl border border-white/10 shadow-[0_0_100px_-20px_rgba(255,255,255,0.05)] relative bg-[#0a0a0a] overflow-hidden group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="absolute inset-0 flex flex-col md:flex-row">

            {/* 1. LEFT CONTROLS (Fixed width, Glassmorphism) */}
            <div className="w-[320px] h-full p-8 flex flex-col justify-between relative z-20 border-r border-white/5 bg-black/40 backdrop-blur-xl">

              <div className="space-y-8">
                {/* Slide Info */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSlide}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    <div className={`p-3 w-fit rounded-xl bg-white/5 border border-white/10 ${currentSlide.accent}`}>
                      <currentSlide.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">{currentSlide.title}</h3>
                      <div className={`text-[10px] font-mono uppercase tracking-widest mb-4 opacity-80 ${currentSlide.accent}`}>
                        {currentSlide.subtitle}
                      </div>
                      <p className="text-sm text-white/50 leading-relaxed">
                        {currentSlide.description}
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Navigation List */}
                <div className="space-y-1">
                  {slides.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setActiveSlide(i); setProgress(0); }}
                      className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${activeSlide === i
                        ? "bg-white/10 text-white border border-white/5 shadow-inner"
                        : "text-white/40 hover:text-white hover:bg-white/5"
                        }`}
                    >
                      <s.icon className={`w-4 h-4 ${activeSlide === i ? s.accent : ""}`} />
                      <span className="text-xs font-medium">{s.title}</span>
                      {activeSlide === i && (
                        <motion.div layoutId="active-dot" className="w-1.5 h-1.5 rounded-full bg-white ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Controls */}
              <div className="space-y-4">
                {/* Scrubber */}
                <div className="space-y-2 cursor-pointer group/timeline">
                  <div className="h-0.5 bg-white/10 rounded-full overflow-hidden w-full relative">
                    <motion.div
                      className="h-full absolute left-0 top-0 bg-white shadow-[0_0_10px_white]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-white/40">
                  <Button size="icon" variant="ghost" onClick={() => setIsPlaying(!isPlaying)} className="hover:text-white">
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <span className="text-[10px] font-mono">0{activeSlide + 1} / 0{slides.length}</span>
                </div>
              </div>
            </div>

            {/* 2. RIGHT PREVIEW AREA (The "Stage") */}
            <div className="flex-1 relative h-full bg-[#0c0c0c] perspective-1000 overflow-hidden">
              {/* Background Grid */}
              <div className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }}
              />

              <AnimatePresence mode="popLayout">
                <motion.div
                  key={activeSlide}
                  initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                  transition={{ duration: 0.5, ease: "circOut" }}
                  className="absolute inset-0 p-8 flex items-center justify-center"
                >
                  <div className="w-full h-full rounded-xl overflow-hidden border border-white/10 shadow-2xl relative bg-[#0f1115]">

                    {/* Window Actions */}
                    <div className="absolute top-4 right-4 z-50 flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/30" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/30" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/30" />
                    </div>

                    {/* Render the Active Demo */}
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
