import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight, ArrowDownRight, MoreVertical, Search, Filter,
  Download, Plus, CheckCircle2, AlertCircle, Clock, MapPin,
  DollarSign, Package, ShoppingCart, Truck, X, ExternalLink, Settings,
  Edit2, Trash2, Mail, Phone, User, Calendar, MousePointer2, TrendingUp,
  QrCode, Copy, Eye, Lock, ShieldCheck, ChevronRight, MessageSquare, Shield,
  Zap, Navigation, Share2, Flame, Award, Heart, PieChart, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useShouldReduceAnimations } from '@/hooks/useReducedMotion';

export type DashboardViewKey = 'dashboard' | 'orders' | 'inventory' | 'catalog' | 'customers' | 'analytics' | 'tracking' | 'menus';

// --- VISUAL HELPERS ---
const GridBackground = () => (
  <div className="absolute inset-x-5 bottom-5 top-16 opacity-20">
    <div className="h-px w-full bg-white/20 mb-8" />
    <div className="h-px w-full bg-white/20 mb-8" />
    <div className="h-px w-full bg-white/20 mb-8" />
    <div className="h-px w-full bg-white/20" />
  </div>
);

// --- SUB-COMPONENTS ---

function MetricCard({ label, value, trend, color, delay }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-[#181a20] rounded-xl border border-white/5 p-4 flex flex-col justify-between group hover:border-white/10 transition-colors"
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-white/40 text-[10px] uppercase font-medium tracking-wider">{label}</span>
        <div className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${color}`}>
          {trend.includes('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <div className="text-xl font-semibold text-white/90">{value}</div>
      <div className="h-8 mt-2 flex items-end gap-0.5 opacity-30">
        {[...Array(12)].map((_, j) => (
          <div key={j} className="flex-1 bg-current rounded-t-sm" style={{ height: `${30 + Math.random() * 70}%` }} />
        ))}
      </div>
    </motion.div>
  )
}

function DashboardOverview() {
  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Total Revenue" value="$24,592.00" trend="+12.5%" color="bg-emerald-500/10 text-emerald-400" delay={0} />
        <MetricCard label="Active Orders" value="148" trend="+4.2%" color="bg-blue-500/10 text-blue-400" delay={0.1} />
        <MetricCard label="Pending Delivery" value="32" trend="-1.1%" color="bg-amber-500/10 text-amber-400" delay={0.2} />
        <MetricCard label="Avg Order Value" value="$165.20" trend="+8.4%" color="bg-purple-500/10 text-purple-400" delay={0.3} />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Chart */}
        <div className="col-span-8 bg-[#181a20] rounded-xl border border-white/5 p-5 relative overflow-hidden h-64">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-white/80 font-medium text-sm">Revenue Analytics</h3>
            <div className="flex gap-2">
              {['1D', '1W', '1M', '1Y'].map(pd => (
                <div key={pd} className={`px-2 py-1 rounded text-[10px] cursor-pointer ${pd === '1W' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white'}`}>{pd}</div>
              ))}
            </div>
          </div>
          {/* Chart */}
          <div className="absolute inset-x-5 bottom-5 top-16">
            <GridBackground />
            <svg className="w-full h-full overflow-visible relative z-10">
              <defs>
                <linearGradient id="dashGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.path
                d="M0,100 C50,80 100,120 150,90 200,60 250,80 300,50 350,40 400,70 450,30 500,60 550,20 600,40 V150 H0 Z" // Approximate shape
                fill="url(#dashGradient)"
                initial={{ opacity: 0, d: "M0,150 L600,150 V150 H0 Z" }}
                animate={{ opacity: 1, d: "M0,100 C50,80 100,120 150,90 200,60 250,80 300,50 350,40 400,70 450,30 500,60 550,20 600,40 V150 H0 Z" }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
              <motion.path
                d="M0,100 C50,80 100,120 150,90 200,60 250,80 300,50 350,40 400,70 450,30 500,60 550,20 600,40"
                fill="none" stroke="#10b981" strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </svg>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="col-span-4 bg-[#181a20] rounded-xl border border-white/5 p-5 flex flex-col h-64">
          <h3 className="text-white/80 font-medium text-sm mb-4">Live Activity</h3>
          <div className="space-y-4 overflow-hidden relative font-sans">
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#181a20] to-transparent z-10" />
            {[
              { user: "Alex M.", action: "placed order #4921", time: "2m ago", img: "AM" },
              { user: "Sarah K.", action: "updated inventory", time: "5m ago", img: "SK" },
              { user: "System", action: "backup  completed", time: "12m ago", img: "SYS" },
              { user: "Mike R.", action: "delivered #4892", time: "18m ago", img: "MR" },
              { user: "Bot", action: "syncing data...", time: "20m ago", img: "BT" },
            ].map((act, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
              >
                <div className="w-7 h-7 rounded-sm bg-white/5 border border-white/5 flex items-center justify-center text-[10px] text-white/50">
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
  )
}

function OrdersView({ isInteractive }: { isInteractive: boolean }) {
  const reduceAnimations = useShouldReduceAnimations();

  /* Enhanced Kanban Simulation */
  const [columns, setColumns] = useState({
    new: [
      { id: 4930, customer: "Green Leaf", items: 12, total: "$1.2k", time: "2m" },
      { id: 4931, customer: "High Tide", items: 5, total: "$420", time: "15m" },
      { id: 4932, customer: "Canna Club", items: 3, total: "$150", time: "1m" }
    ],
    prep: [
      { id: 4928, customer: "Urban Well", items: 8, total: "$850", time: "32m" },
      { id: 4929, customer: "Pure Life", items: 15, total: "$1.8k", time: "40m" }
    ],
    quality: [
      { id: 4926, customer: "Coastal Co", items: 24, total: "$2.1k", time: "45m" },
      { id: 4927, customer: "Zen Gardens", items: 2, total: "$90", time: "50m" }
    ],
    ready: [
      { id: 4925, customer: "Med Leaf", items: 6, total: "$540", time: "1h" }
    ] as any[]
  });

  // Continuous Simulation Loop - DISABLED on mobile for performance
  useEffect(() => {
    if (!isInteractive || reduceAnimations) return;

    let step = 0;
    const interval = setInterval(() => {
      setColumns(prev => {
        const next = { ...prev };

        // Cycle actions based on step counter to create a flow
        // Step 0: Move New -> Prep
        if (step % 4 === 0 && next.new.length > 0) {
          const item = next.new[0];
          next.new = next.new.slice(1);
          next.prep = [...next.prep, item];
        }
        // Step 1: Move Prep -> Quality
        else if (step % 4 === 1 && next.prep.length > 0) {
          const item = next.prep[0];
          next.prep = next.prep.slice(1);
          next.quality = [...next.quality, item];
        }
        // Step 2: Move Quality -> Ready
        else if (step % 4 === 2 && next.quality.length > 0) {
          const item = next.quality[0];
          next.quality = next.quality.slice(1);
          next.ready = [...next.ready, item];
        }
        // Step 3: Clear Ready (Pickup) & Add New Order
        else if (step % 4 === 3) {
          if (next.ready.length > 0) {
            next.ready = next.ready.slice(1); // Driver Pickup
          }
          // Ingest new order
          const newId = 4933 + Math.floor(step / 4);
          next.new = [...next.new, {
            id: newId,
            customer: ["Blue Sky", "Red River", "Golden Gate"][Math.floor(Math.random() * 3)],
            items: Math.floor(Math.random() * 20) + 1,
            total: `$${Math.floor(Math.random() * 1000) + 100}`,
            time: "Just now"
          }];
        }

        return next;
      });
      step++;
    }, 2000); // Action every 2 seconds

    return () => clearInterval(interval);
  }, [isInteractive]);

  const Column = ({ title, cards, color }: any) => (
    <div className="flex-1 flex flex-col min-w-0 bg-white/[0.02] rounded-xl border border-white/5 p-3">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${color}`} />
          <h3 className="text-white font-medium text-xs uppercase tracking-wider">{title}</h3>
        </div>
        <span className="text-[10px] text-white/30 font-mono">{cards.length}</span>
      </div>

      <div className={`space-y-3 flex-1 ${isInteractive ? 'overflow-y-auto pr-1' : 'overflow-hidden'}`}>
        <AnimatePresence>
          {cards.map((card: any) => (
            <motion.div
              key={card.id}
              layoutId={`card-${card.id}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-[#181a20] rounded-lg border border-white/10 p-3 shadow-sm group hover:border-white/20 cursor-grab active:cursor-grabbing"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-white/50 font-mono">#{card.id}</span>
                <MoreVertical className="w-3 h-3 text-white/20 group-hover:text-white/60" />
              </div>
              <div className="text-sm font-medium text-white mb-1">{card.customer}</div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-white/40">{card.items} items • {card.total}</div>
                <div className="text-[10px] text-emerald-400 font-mono">{card.time}</div>
              </div>

              {/* Driver Notification for Ready Column */}
              {title === 'Ready' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2 overflow-hidden"
                >
                  <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-[8px] text-white">M</div>
                  <span className="text-[10px] text-indigo-300">Driver Assigned</span>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white font-semibold text-lg">Workflow Automation</h2>
        <div className="flex gap-2">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-6 h-6 rounded-full bg-white/10 border border-black flex items-center justify-center text-[8px] text-white">
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <div className="h-6 w-px bg-white/10 mx-2" />
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-xs h-7">
            <Plus className="w-3 h-3 mr-1" /> New Order
          </Button>
        </div>
      </div>

      <div className={`flex-1 flex gap-4 pb-2 ${isInteractive ? 'overflow-x-auto' : 'overflow-hidden'}`}>
        <Column title="New Orders" cards={columns.new} color="bg-blue-500" />
        <Column title="Prep" cards={columns.prep} color="bg-amber-500" />
        <Column title="Quality" cards={columns.quality} color="bg-purple-500" />
        <Column title="Ready" cards={columns.ready} color="bg-emerald-500" />
      </div>
    </div>
  )
}

function InventoryView({ isInteractive }: { isInteractive: boolean }) {
  const [restocking, setRestocking] = useState<string | null>(null);
  const handleRestock = (id: string) => {
    setRestocking(id);
    setTimeout(() => setRestocking(null), 2000);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white font-semibold text-lg">Inventory Control</h2>
        <div className="flex gap-2">
          <div className="p-2 bg-white/5 rounded-lg text-white/40 border border-white/5"><Filter className="w-4 h-4" /></div>
          <div className="p-2 bg-white/5 rounded-lg text-white/40 border border-white/5"><Download className="w-4 h-4" /></div>
        </div>
      </div>
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${isInteractive ? 'overflow-y-auto pr-2' : 'overflow-hidden'}`}>
        {[
          { id: "p1", name: "Sour Diesel", stock: 12, threshold: 20, status: "Low Stock" },
          { id: "p2", name: "Blue Dream", stock: 145, threshold: 50, status: "Optimal" },
          { id: "p3", name: "OG Kush", stock: 89, threshold: 40, status: "Optimal" },
          { id: "p4", name: "Pineapple Exp", stock: 5, threshold: 15, status: "Critical" },
          { id: "p5", name: "Gummies 10mg", stock: 240, threshold: 100, status: "Overstock" },
          { id: "p6", name: "Vape Pen battery", stock: 0, threshold: 10, status: "Out of Stock" },
          // Add more items to demonstrate scrolling
          { id: "p7", name: "Pre-roll Pack", stock: 320, threshold: 50, status: "Optimal" },
          { id: "p8", name: "CBD Tincture", stock: 15, threshold: 25, status: "Low Stock" },
        ].map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#181a20] p-4 rounded-xl border border-white/5 relative group hover:border-white/10 transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center font-bold text-white/20">
                {item.name.substring(0, 2)}
              </div>
              <div className={`px-2 py-0.5 text-[10px] rounded-full border ${item.status.includes('Stock') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                item.status === 'Optimal' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                {item.status}
              </div>
            </div>
            <h3 className="text-white font-medium text-sm mb-1">{item.name}</h3>
            <div className="text-xs text-white/40 mb-4">SKU: FL-{4000 + i}</div>
            <div className="space-y-1 mb-4">
              <div className="flex justify-between text-[10px] text-white/60">
                <span>Stock Level</span>
                <span>{item.stock} / {item.threshold}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${item.status.includes('Stock') ? 'bg-red-500' : 'bg-emerald-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((item.stock / item.threshold) * 50, 100)}%` }}
                />
              </div>
            </div>
            {item.status.includes('Stock') || item.status === 'Critical' ? (
              <Button
                size="sm"
                className="w-full text-xs h-8 bg-white/5 hover:bg-white/10 text-white border border-white/10"
                onClick={() => handleRestock(item.id)}
                disabled={restocking === item.id}
              >
                {restocking === item.id ? <span className="animate-pulse">Ordering...</span> : "Restock Now"}
              </Button>
            ) : (
              <div className="h-8 flex items-center justify-center text-[10px] text-emerald-500/60 font-medium">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Auto-Replenish Active
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function CatalogView({ isInteractive }: { isInteractive: boolean }) {
  const [products, setProducts] = useState([
    { id: 1, name: "Blue Dream", category: "Flower • Sativa", price: "$45.00", stock: "High", image: "from-blue-500/20 to-indigo-500/20" },
    { id: 2, name: "OG Kush", category: "Flower • Indica", price: "$50.00", stock: "Medium", image: "from-emerald-500/20 to-green-500/20" },
    { id: 3, name: "Pineapple Express", category: "Vape • Hybrid", price: "$35.00", stock: "Low", image: "from-amber-500/20 to-yellow-500/20" },
    { id: 4, name: "CBD Gummies", category: "Edibles • 10mg", price: "$25.00", stock: "High", image: "from-purple-500/20 to-pink-500/20" },
    { id: 5, name: "Girl Scout Cookies", category: "Flower • Hybrid", price: "$48.00", stock: "Medium", image: "from-teal-500/20 to-emerald-500/20" },
    { id: 6, name: "Sour Diesel", category: "Concentrate • Sativa", price: "$60.00", stock: "Medium", image: "from-lime-500/20 to-green-500/20" },
    { id: 7, name: "Purple Haze", category: "Flower • Sativa", price: "$42.00", stock: "Low", image: "from-violet-500/20 to-purple-500/20" },
    { id: 8, name: "Gelato", category: "Vape • Hybrid", price: "$38.00", stock: "High", image: "from-rose-500/20 to-red-500/20" },
  ]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white font-semibold text-lg">Product Catalog</h2>
        <div className="flex gap-2">
          <div className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 flex items-center text-white/40 text-xs w-64">
            <Search className="w-3 h-3 mr-2" />
            Search products...
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium flex items-center gap-2 cursor-pointer hover:bg-indigo-500 transition-colors">
            <Plus className="w-3 h-3" /> Add Product
          </div>
        </div>
      </div>
      <div className={`grid grid-cols-4 gap-4 flex-1 min-h-0 ${isInteractive ? 'overflow-y-auto pr-2' : 'overflow-hidden'}`}>
        {products.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#181a20] rounded-xl border border-white/5 overflow-hidden group hover:border-white/20 transition-all cursor-pointer flex flex-col"
          >
            <div className={`h-32 bg-gradient-to-br ${p.image} relative flex items-center justify-center`}>
              <Package className="w-8 h-8 text-white/20 group-hover:text-white/40 transition-colors scale-100 group-hover:scale-110 duration-300" />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <div className="p-1.5 bg-black/60 backdrop-blur rounded text-white hover:bg-indigo-500 cursor-pointer"><Edit2 className="w-3 h-3" /></div>
              </div>
              {p.stock === 'Low' && (
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] rounded font-medium">
                  Low Stock
                </div>
              )}
            </div>
            <div className="p-3 flex-1 flex flex-col">
              <div className="text-xs text-white/40 mb-1">{p.category}</div>
              <div className="text-sm font-medium text-white mb-2">{p.name}</div>
              <div className="mt-auto flex justify-between items-center text-xs">
                <span className="text-white font-mono">{p.price}</span>
                <span className={`flex items-center gap-1 ${p.stock === 'Low' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${p.stock === 'Low' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  {p.stock === 'Low' ? 'Restocking' : 'In Stock'}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
        {/* Skeleton for "More" hint */}
        <div className="border border-white/5 rounded-xl border-dashed flex items-center justify-center text-white/20 text-xs hover:bg-white/5 cursor-pointer transition-colors">
          View All 248 Items
        </div>
      </div>
    </div>
  )
}

function CRMView({ isInteractive }: { isInteractive: boolean }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white font-semibold text-lg">Client Relationships</h2>
        <div className="flex gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium flex items-center gap-2 cursor-pointer">
            <Plus className="w-3 h-3" /> Add Client
          </div>
        </div>
      </div>

      {/* Pipeline Summary Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 border border-white/5 rounded-lg p-3 flex flex-col">
          <span className="text-[10px] text-white/30 uppercase">Total Clients</span>
          <span className="text-lg font-bold text-white">1,248</span>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex flex-col">
          <span className="text-[10px] text-emerald-400/60 uppercase">Active VIPs</span>
          <span className="text-lg font-bold text-emerald-400">84</span>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex flex-col">
          <span className="text-[10px] text-blue-400/60 uppercase">New Leads</span>
          <span className="text-lg font-bold text-blue-400">32</span>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex flex-col">
          <span className="text-[10px] text-amber-400/60 uppercase">At Risk</span>
          <span className="text-lg font-bold text-amber-400">12</span>
        </div>
      </div>

      <div className={`grid grid-cols-3 gap-4 ${isInteractive ? 'overflow-y-auto pr-2' : 'overflow-hidden'}`}>
        {[
          { name: "Green Leaf Dispensary", type: "Retailer", ltv: "$142,500", status: "VIP", color: "bg-emerald-500", engagement: 95, last: "2h ago" },
          { name: "Urban Wellness", type: "Dispensary", ltv: "$89,200", status: "Active", color: "bg-blue-500", engagement: 78, last: "1d ago" },
          { name: "Coastal Collective", type: "Chain", ltv: "$210,000", status: "VIP", color: "bg-purple-500", engagement: 98, last: "5h ago" },
          { name: "High Tide Retail", type: "Retailer", ltv: "$45,600", status: "Risk", color: "bg-amber-500", engagement: 42, last: "2w ago" },
          { name: "Pure Canna", type: "Partner", ltv: "$12,400", status: "New", color: "bg-pink-500", engagement: 60, last: "1d ago" },
          { name: "Zen Garden", type: "Retailer", ltv: "$67,800", status: "Active", color: "bg-cyan-500", engagement: 82, last: "3d ago" },
          // Add more for scroll text
          { name: "Cloud Nine", type: "Retailer", ltv: "$34,200", status: "Active", color: "bg-indigo-500", engagement: 72, last: "4h ago" },
          { name: "Leafy Lane", type: "Dispensary", ltv: "$156,000", status: "VIP", color: "bg-teal-500", engagement: 91, last: "1h ago" },
        ].map((client, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-[#181a20] rounded-xl border border-white/5 p-4 relative group hover:border-white/20 transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${client.color} bg-opacity-20 flex items-center justify-center text-white font-bold border border-white/5`}>
                  {client.name.substring(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{client.name}</div>
                  <div className="text-[10px] text-white/40">{client.type} • Active {client.last}</div>
                </div>
              </div>
              <ShieldCheck className={`w-4 h-4 ${client.status === 'VIP' ? 'text-amber-400' : 'text-white/20'}`} />
            </div>

            <div className="h-px bg-white/5 mb-4" />

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <div className="text-[10px] text-white/30 uppercase">Lifetime Value</div>
                <div className="text-sm font-mono text-white">{client.ltv}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/30 uppercase">Health Score</div>
                <div className={`text-sm font-mono ${client.engagement > 80 ? 'text-emerald-400' : client.engagement < 50 ? 'text-red-400' : 'text-amber-400'}`}>{client.engagement}/100</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] border-white/10 text-white/60 hover:text-white hover:bg-white/5">Message</Button>
              <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] border-white/10 text-white/60 hover:text-white hover:bg-white/5">Profile</Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function AnalyticsView() {
  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-white font-semibold text-lg">Performance Analytics</h2>
        <div className="flex bg-white/5 p-1 rounded-lg">
          <div className="px-3 py-1 bg-white/10 rounded text-xs text-white font-medium cursor-pointer">Sales</div>
          <div className="px-3 py-1 rounded text-xs text-white/40 hover:text-white cursor-pointer transition-colors">Traffic</div>
        </div>
      </div>

      <div className="flex-1 bg-[#181a20] rounded-xl border border-white/5 p-5 relative overflow-hidden flex flex-col">
        <div className="flex items-end justify-between h-full gap-2 px-4 pb-2">
          {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
            <motion.div
              key={i}
              className="flex-1 bg-indigo-500/20 hover:bg-indigo-500/40 rounded-t-sm transition-colors relative group"
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                ${h * 120}
              </div>
            </motion.div>
          ))}
        </div>
        <div className="border-t border-white/5 pt-2 flex justify-between text-[10px] text-white/30 uppercase tracking-widest px-2">
          <span>Jan</span><span>Dec</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 h-32">
        {[
          { label: "Conversion Rate", val: "3.2%", change: "+0.4%", c: "text-emerald-400" },
          { label: "Avg Session", val: "4m 12s", change: "+12s", c: "text-blue-400" },
          { label: "Bounce Rate", val: "42%", change: "-2%", c: "text-emerald-400" },
        ].map((stat, i) => (
          <div key={i} className="bg-[#181a20] rounded-xl border border-white/5 p-4 flex flex-col justify-center">
            <div className="text-white/40 text-[10px] uppercase font-bold mb-1">{stat.label}</div>
            <div className="text-2xl font-light text-white mb-1">{stat.val}</div>
            <div className={`text-xs ${stat.c} flex items-center gap-1`}>
              <TrendingUp className="w-3 h-3" /> {stat.change}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FleetView() {
  const [rerouting, setRerouting] = useState(false);
  const [routeType, setRouteType] = useState('direct');

  useEffect(() => {
    // Replay animation loop
    const t = setInterval(() => {
      setRerouting(true);
      setTimeout(() => setRouteType('optimized'), 1000);
      setTimeout(() => setRerouting(false), 3500);
      setTimeout(() => setRouteType('direct'), 8000); // reset
    }, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold text-lg">Live Fleet</h2>
          <Badge variant="outline" className="border-emerald-500/20 text-emerald-400 bg-emerald-500/10">3 Drivers Active</Badge>
        </div>
        <div className="text-[10px] text-white/40 font-mono flex gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> ON TIME</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> DELAYED</span>
        </div>
      </div>

      <div className="flex-1 bg-[#111318] rounded-xl border border-white/5 relative overflow-hidden group">
        {/* NYC Grid Background - Brighter Opacity */}
        <svg className="absolute inset-0 w-full h-full opacity-50" width="100%" height="100%">
          {/* Central Park */}
          <rect x="0" y="0" width="30%" height="40%" fill="#1a2e26" />
          <rect x="2%" y="2%" width="26%" height="36%" fill="#064e3b" fillOpacity="0.3" stroke="#059669" strokeDasharray="4 2" />
          {/* Grid */}
          <defs>
            <pattern id="nyc-grid-fleet-dash" width="50" height="25" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="25" stroke="#334155" strokeWidth="1.5" />
              <line x1="50" y1="0" x2="50" y2="25" stroke="#334155" strokeWidth="1.5" />
              <line x1="0" y1="12.5" x2="50" y2="12.5" stroke="#2a303c" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="url(#nyc-grid-fleet-dash)" />
        </svg>

        {/* Map Labels */}
        <div className="absolute inset-0 pointer-events-none opacity-40 text-[8px] font-mono text-white">
          <div className="absolute top-[40%] left-[10%]">8th Ave</div>
          <div className="absolute top-[60%] left-[50%]">5th Ave</div>
          <div className="absolute top-[80%] right-[20%]">Broadway</div>
        </div>

        {/* Routes Layer - MULTIPLE DRIVERS */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300" preserveAspectRatio="none">
          {/* Driver 1: Mike (Rerouting Demo) */}
          <motion.path
            d="M50,300 L50,150 L200,150 L200,50 L300,50"
            fill="none" stroke="#3b82f6" strokeWidth="3" strokeOpacity="0.5"
            animate={{ opacity: routeType === 'optimized' ? 0 : 0.5 }}
          />
          {rerouting && <motion.path d="M100,150 L175,150" fill="none" stroke="#ef4444" strokeWidth="4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />}
          {routeType === 'optimized' && (
            <motion.path
              d="M50,300 L50,200 L250,200 L250,50 L300,50"
              fill="none" stroke="#10b981" strokeWidth="3"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            />
          )}

          {/* Driver 2: Sarah (Purple Loop) */}
          <motion.path
            d="M350,300 L350,200 L150,200 L150,250"
            fill="none" stroke="#8b5cf6" strokeWidth="3" strokeOpacity="0.4"
            strokeDasharray="4 4"
            animate={{ strokeDashoffset: [0, -20] }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />

          {/* Driver 3: Bot (Amber) */}
          <motion.path
            d="M100,0 L100,100 L300,100"
            fill="none" stroke="#f59e0b" strokeWidth="3" strokeOpacity="0.3"
          />
        </svg>

        {/* Moving Vehicles */}

        {/* Driver 1 (Mike) */}
        <motion.div
          className="absolute z-20"
          animate={{
            top: routeType === 'optimized' ? '15%' : '45%',
            left: routeType === 'optimized' ? '65%' : '45%'
          }}
          transition={{ duration: 1.5 }}
        >
          <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_15px_white] ring-2 ring-blue-500" />
          <div className="absolute -top-6 -left-4 bg-black/80 backdrop-blur px-2 py-0.5 rounded text-[8px] text-white whitespace-nowrap border border-white/20">
            {rerouting ? <span className="text-red-400 font-bold">TRAFFIC</span> : "Mike P."}
          </div>
        </motion.div>

        {/* Driver 2 (Sarah) */}
        <motion.div
          className="absolute z-20"
          animate={{ top: ['65%', '65%', '80%'], left: ['85%', '35%', '35%'] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-3 h-3 bg-purple-400 rounded-full shadow-[0_0_15px_purple] ring-2 ring-purple-600" />
        </motion.div>

        {/* Driver 3 (Bot) */}
        <motion.div
          className="absolute z-20"
          animate={{ top: ['0%', '30%', '30%'], left: ['25%', '25%', '70%'] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-3 h-3 bg-amber-400 rounded-full shadow-[0_0_15px_amber] ring-2 ring-amber-600" />
        </motion.div>

        {/* Traffic Heatmap Zones */}
        <div className="absolute top-[48%] left-[25%] w-24 h-4 bg-red-500/20 blur-xl rounded-full animate-pulse" />

        {/* Mission Control HUD */}
        <div className="absolute top-4 right-4 bg-black/80 border border-white/10 p-2 rounded text-[10px] text-white/50 font-mono">
          <div className="flex gap-4">
            <span>Active: 3</span>
            <span>Idle: 0</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function MenusView() {
  const [copied, setCopied] = useState<number | null>(null);
  const handleCopy = (i: number) => {
    setCopied(i);
    setTimeout(() => setCopied(null), 1500);
  }

  const menus = [
    { id: 1, name: "VIP Catalog", icon: "👑", gradient: "from-violet-600 to-indigo-600", stats: { views: 242, orders: 45 }, exp: "5d" },
    { id: 2, name: "Flash Sale", icon: "⚡", gradient: "from-rose-500 to-red-600", stats: { views: 890, orders: 120 }, exp: "4h" },
    { id: 3, name: "New Drops", icon: "🌿", gradient: "from-emerald-500 to-teal-600", stats: { views: 156, orders: 28 }, exp: "2d" },
    { id: 4, name: "Wholesale", icon: "📦", gradient: "from-amber-500 to-orange-600", stats: { views: 12, orders: 3 }, exp: "Active" },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white font-semibold text-lg">Secure Menus</h2>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-xs"><Plus className="w-3 h-3 mr-2" /> Create Link</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {menus.map((menu, i) => (
          <motion.div
            key={menu.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="relative h-48 rounded-xl overflow-hidden group cursor-pointer border border-white/5 bg-[#181a20]"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${menu.gradient} opacity-10 group-hover:opacity-20 transition-opacity`} />
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl pointer-events-none" />

            <div className="absolute inset-0 p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${menu.gradient} flex items-center justify-center text-lg shadow-lg text-white`}>
                  {menu.icon}
                </div>
                <div className="flex gap-1">
                  <div className="bg-black/40 backdrop-blur border border-white/10 px-2 py-1 rounded text-[10px] text-white flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    Encrypted
                  </div>
                  <div className="bg-black/40 backdrop-blur border border-white/10 px-2 py-1 rounded text-[10px] text-white flex items-center gap-1">
                    <Clock className="w-3 h-3 text-white/60" />
                    {menu.exp}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-white font-bold text-lg mb-1">{menu.name}</h3>
                <div className="flex gap-4 text-xs text-white/50 mb-4">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {menu.stats.views} views</span>
                  <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> {menu.stats.orders} orders</span>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                  <Button
                    size="sm"
                    className={`flex-1 h-8 text-[10px] ${copied === i ? 'bg-emerald-600' : 'bg-white/10 hover:bg-white/20'}`}
                    onClick={() => handleCopy(i)}
                  >
                    {copied === i ? "Copied!" : "Copy Link"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-white/10 bg-black/20"><Settings className="w-3 h-3 text-white" /></Button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export function DashboardViews({ activeView, isInteractive = false }: { activeView: DashboardViewKey; isInteractive?: boolean }) {
  switch (activeView) {
    case 'dashboard': return <DashboardOverview />;
    case 'orders': return <OrdersView isInteractive={isInteractive} />;
    case 'inventory': return <InventoryView isInteractive={isInteractive} />;
    case 'catalog': return <CatalogView isInteractive={isInteractive} />;
    case 'customers': return <CRMView isInteractive={isInteractive} />;
    case 'analytics': return <AnalyticsView />;
    case 'tracking': return <FleetView />;
    case 'menus': return <MenusView />;
    default: return <DashboardOverview />;
  }
}
