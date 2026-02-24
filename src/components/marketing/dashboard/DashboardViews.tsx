import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight, ArrowDownRight, MoreVertical, Search, Filter,
  Download, Plus, CheckCircle2, Clock,
  Package, ShoppingCart, Settings,
  Edit2, TrendingUp,
  Eye, Lock, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useShouldReduceAnimations } from '@/hooks/useReducedMotion';

export type DashboardViewKey = 'dashboard' | 'orders' | 'inventory' | 'catalog' | 'customers' | 'analytics' | 'tracking' | 'menus';

// --- VISUAL HELPERS ---
const GridBackground = () => (
  <div className="absolute inset-x-5 bottom-5 top-16 opacity-30">
    <div className="h-px w-full bg-slate-200 mb-8" />
    <div className="h-px w-full bg-slate-200 mb-8" />
    <div className="h-px w-full bg-slate-200 mb-8" />
    <div className="h-px w-full bg-slate-200" />
  </div>
);

// --- SUB-COMPONENTS ---

function MetricCard({ label, value, trend, color, delay }: { label: string; value: string; trend: string; color: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between group hover:border-[hsl(var(--marketing-primary))]/30 hover:shadow-md transition-all"
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{label}</span>
        <div className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold ${color}`}>
          {trend.includes('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="h-8 mt-2 flex items-end gap-0.5 opacity-30">
        {[...Array(12)].map((_, j) => (
          <div key={j} className="flex-1 bg-slate-400 rounded-t-sm" style={{ height: `${30 + Math.random() * 70}%` }} />
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
        <MetricCard label="Total Revenue" value="$24,592.00" trend="+12.5%" color="bg-emerald-100 text-emerald-600" delay={0} />
        <MetricCard label="Active Orders" value="148" trend="+4.2%" color="bg-blue-100 text-blue-600" delay={0.1} />
        <MetricCard label="Pending Delivery" value="32" trend="-1.1%" color="bg-amber-100 text-amber-600" delay={0.2} />
        <MetricCard label="Avg Order Value" value="$165.20" trend="+8.4%" color="bg-purple-100 text-purple-600" delay={0.3} />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Chart */}
        <div className="col-span-8 bg-white rounded-xl border border-slate-200 p-5 relative overflow-hidden h-64 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-slate-800 font-bold text-sm">Revenue Analytics</h3>
            <div className="flex gap-2">
              {['1D', '1W', '1M', '1Y'].map(pd => (
                <div key={pd} className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer ${pd === '1W' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>{pd}</div>
              ))}
            </div>
          </div>
          {/* Chart */}
          <div className="absolute inset-x-5 bottom-5 top-16">
            <GridBackground />
            <svg className="w-full h-full overflow-visible relative z-10">
              <defs>
                <linearGradient id="dashGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--marketing-primary))" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="hsl(var(--marketing-primary))" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.path
                d="M0,100 C50,80 100,120 150,90 200,60 250,80 300,50 350,40 400,70 450,30 500,60 550,20 600,40 V150 H0 Z"
                fill="url(#dashGradient)"
                initial={{ opacity: 0, d: "M0,150 L600,150 V150 H0 Z" }}
                animate={{ opacity: 1, d: "M0,100 C50,80 100,120 150,90 200,60 250,80 300,50 350,40 400,70 450,30 500,60 550,20 600,40 V150 H0 Z" }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
              <motion.path
                d="M0,100 C50,80 100,120 150,90 200,60 250,80 300,50 350,40 400,70 450,30 500,60 550,20 600,40"
                fill="none" stroke="hsl(var(--marketing-primary))" strokeWidth="3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </svg>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="col-span-4 bg-white rounded-xl border border-slate-200 p-5 flex flex-col h-64 shadow-sm">
          <h3 className="text-slate-800 font-bold text-sm mb-4">Live Activity</h3>
          <div className="space-y-4 overflow-hidden relative font-sans">
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent z-10" />
            {[
              { user: "Alex M.", action: "placed order #4921", time: "2m ago", img: "AM", color: "bg-blue-100 text-blue-600" },
              { user: "Sarah K.", action: "updated inventory", time: "5m ago", img: "SK", color: "bg-emerald-100 text-emerald-600" },
              { user: "System", action: "backup  completed", time: "12m ago", img: "SYS", color: "bg-slate-100 text-slate-600" },
              { user: "Mike R.", action: "delivered #4892", time: "18m ago", img: "MR", color: "bg-amber-100 text-amber-600" },
              { user: "Bot", action: "syncing data...", time: "20m ago", img: "BT", color: "bg-purple-100 text-purple-600" },
            ].map((act, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${act.color}`}>
                  {act.img}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate-600"><span className="font-bold text-slate-900">{act.user}</span> {act.action}</div>
                  <div className="text-[10px] text-slate-400 font-medium">{act.time}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface KanbanCard {
  id: number;
  customer: string;
  items: number;
  total: string;
  time: string;
}

function OrdersView({ isInteractive }: { isInteractive: boolean }) {
  const reduceAnimations = useShouldReduceAnimations();

  /* Enhanced Kanban Simulation */
  const [columns, setColumns] = useState<{ new: KanbanCard[]; prep: KanbanCard[]; quality: KanbanCard[]; ready: KanbanCard[] }>({
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
    ]
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
  }, [isInteractive, reduceAnimations]);

  const Column = ({ title, cards, color }: { title: string; cards: KanbanCard[]; color: string }) => (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 rounded-xl border border-slate-200 p-3">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${color}`} />
          <h3 className="text-slate-700 font-bold text-xs uppercase tracking-wider">{title}</h3>
        </div>
        <span className="text-[10px] text-slate-400 font-mono font-bold bg-white px-1.5 rounded border border-slate-100">{cards.length}</span>
      </div>

      <div className={`space-y-3 flex-1 ${isInteractive ? 'overflow-y-auto pr-1' : 'overflow-hidden'}`}>
        <AnimatePresence>
          {cards.map((card) => (
            <motion.div
              key={card.id}
              layoutId={`card-${card.id}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm group hover:border-[hsl(var(--marketing-primary))]/50 hover:shadow-md cursor-grab active:cursor-grabbing transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] bg-slate-50 px-1.5 py-0.5 rounded text-slate-500 font-mono border border-slate-100">#{card.id}</span>
                <MoreVertical className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
              </div>
              <div className="text-sm font-bold text-slate-800 mb-1">{card.customer}</div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-slate-500 font-medium">{card.items} items • {card.total}</div>
                <div className="text-[10px] text-emerald-600 font-mono font-bold">{card.time}</div>
              </div>

              {/* Driver Notification for Ready Column */}
              {title === 'Ready' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2 overflow-hidden"
                >
                  <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] text-indigo-700 font-bold">M</div>
                  <span className="text-[10px] text-indigo-600 font-medium">Driver Assigned</span>
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
        <h2 className="text-slate-800 font-bold text-lg">Workflow Automation</h2>
        <div className="flex gap-2">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[8px] text-slate-600 font-bold shadow-sm">
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <Button size="sm" className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-xs h-7 text-white shadow-sm">
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
        <h2 className="text-slate-800 font-bold text-lg">Inventory Control</h2>
        <div className="flex gap-2">
          <div className="p-2 bg-white rounded-lg text-slate-400 border border-slate-200 hover:text-slate-600 cursor-pointer shadow-sm"><Filter className="w-4 h-4" /></div>
          <div className="p-2 bg-white rounded-lg text-slate-400 border border-slate-200 hover:text-slate-600 cursor-pointer shadow-sm"><Download className="w-4 h-4" /></div>
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
          { id: "p7", name: "Pre-roll Pack", stock: 320, threshold: 50, status: "Optimal" },
          { id: "p8", name: "CBD Tincture", stock: 15, threshold: 25, status: "Low Stock" },
        ].map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-4 rounded-xl border border-slate-200 relative group hover:border-[hsl(var(--marketing-primary))]/30 hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-400">
                {item.name.substring(0, 2)}
              </div>
              <div className={`px-2 py-0.5 text-[10px] rounded-full border font-bold ${item.status.includes('Stock') ? 'bg-red-50 text-red-600 border-red-100' :
                item.status === 'Optimal' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                  'bg-amber-50 text-amber-600 border-amber-100'
                }`}>
                {item.status}
              </div>
            </div>
            <h3 className="text-slate-800 font-bold text-sm mb-1">{item.name}</h3>
            <div className="text-xs text-slate-400 mb-4 font-mono">SKU: FL-{4000 + i}</div>
            <div className="space-y-1 mb-4">
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>Stock Level</span>
                <span>{item.stock} / {item.threshold}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
                className="w-full text-xs h-8 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                onClick={() => handleRestock(item.id)}
                disabled={restocking === item.id}
              >
                {restocking === item.id ? <span className="animate-pulse">Ordering...</span> : "Restock Now"}
              </Button>
            ) : (
              <div className="h-8 flex items-center justify-center text-[10px] text-emerald-600 font-bold bg-emerald-50 rounded border border-emerald-100">
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
  const [products] = useState([
    { id: 1, name: "Blue Dream", category: "Flower • Sativa", price: "$45.00", stock: "High", image: "from-blue-100 to-indigo-100 text-indigo-500" },
    { id: 2, name: "OG Kush", category: "Flower • Indica", price: "$50.00", stock: "Medium", image: "from-emerald-100 to-green-100 text-emerald-500" },
    { id: 3, name: "Pineapple Express", category: "Vape • Hybrid", price: "$35.00", stock: "Low", image: "from-amber-100 to-yellow-100 text-amber-500" },
    { id: 4, name: "CBD Gummies", category: "Edibles • 10mg", price: "$25.00", stock: "High", image: "from-purple-100 to-pink-100 text-purple-500" },
    { id: 5, name: "Girl Scout Cookies", category: "Flower • Hybrid", price: "$48.00", stock: "Medium", image: "from-teal-100 to-emerald-100 text-teal-500" },
    { id: 6, name: "Sour Diesel", category: "Concentrate • Sativa", price: "$60.00", stock: "Medium", image: "from-lime-100 to-green-100 text-lime-500" },
    { id: 7, name: "Purple Haze", category: "Flower • Sativa", price: "$42.00", stock: "Low", image: "from-violet-100 to-purple-100 text-violet-500" },
    { id: 8, name: "Gelato", category: "Vape • Hybrid", price: "$38.00", stock: "High", image: "from-rose-100 to-red-100 text-rose-500" },
  ]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-slate-800 font-bold text-lg">Product Catalog</h2>
        <div className="flex gap-2">
          <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 flex items-center text-slate-400 text-xs w-64 shadow-sm">
            <Search className="w-3 h-3 mr-2" />
            Search products...
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[hsl(var(--marketing-primary))] text-white text-xs font-medium flex items-center gap-2 cursor-pointer hover:bg-[hsl(var(--marketing-primary))]/90 transition-colors shadow-sm">
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
            className="bg-white rounded-xl border border-slate-200 overflow-hidden group hover:border-[hsl(var(--marketing-primary))]/30 hover:shadow-lg transition-all cursor-pointer flex flex-col"
          >
            <div className={`h-32 bg-gradient-to-br ${p.image.split(" ").slice(0, 2).join(" ")} relative flex items-center justify-center`}>
              <Package className={`w-8 h-8 ${p.image.split(" ")[2]} opacity-50 group-hover:opacity-100 transition-all scale-100 group-hover:scale-110 duration-300`} />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <div className="p-1.5 bg-white/80 backdrop-blur rounded text-slate-600 hover:text-[hsl(var(--marketing-primary))] cursor-pointer shadow-sm"><Edit2 className="w-3 h-3" /></div>
              </div>
              {p.stock === 'Low' && (
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-amber-100 border border-amber-200 text-amber-700 text-[10px] rounded font-bold shadow-sm">
                  Low Stock
                </div>
              )}
            </div>
            <div className="p-3 flex-1 flex flex-col">
              <div className="text-xs text-slate-400 font-medium mb-1">{p.category}</div>
              <div className="text-sm font-bold text-slate-800 mb-2">{p.name}</div>
              <div className="mt-auto flex justify-between items-center text-xs">
                <span className="text-slate-900 font-mono font-bold">{p.price}</span>
                <span className={`flex items-center gap-1 font-medium ${p.stock === 'Low' ? 'text-amber-500' : 'text-emerald-600'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${p.stock === 'Low' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  {p.stock === 'Low' ? 'Restocking' : 'In Stock'}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
        {/* Skeleton for "More" hint */}
        <div className="border border-slate-200 rounded-xl border-dashed flex items-center justify-center text-slate-400 text-xs hover:bg-slate-50 cursor-pointer transition-colors font-medium">
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
        <h2 className="text-slate-800 font-bold text-lg">Client Relationships</h2>
        <div className="flex gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-[hsl(var(--marketing-primary))] text-white text-xs font-medium flex items-center gap-2 cursor-pointer shadow-sm">
            <Plus className="w-3 h-3" /> Add Client
          </div>
        </div>
      </div>

      {/* Pipeline Summary Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Total Clients</span>
          <span className="text-lg font-bold text-slate-900">1,248</span>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex flex-col">
          <span className="text-[10px] text-emerald-600/70 font-bold uppercase">Active VIPs</span>
          <span className="text-lg font-bold text-emerald-600">84</span>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex flex-col">
          <span className="text-[10px] text-blue-600/70 font-bold uppercase">New Leads</span>
          <span className="text-lg font-bold text-blue-600">32</span>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex flex-col">
          <span className="text-[10px] text-amber-600/70 font-bold uppercase">At Risk</span>
          <span className="text-lg font-bold text-amber-600">12</span>
        </div>
      </div>

      <div className={`grid grid-cols-3 gap-4 ${isInteractive ? 'overflow-y-auto pr-2' : 'overflow-hidden'}`}>
        {[
          { name: "Green Leaf Dispensary", type: "Retailer", ltv: "$142,500", status: "VIP", color: "bg-emerald-100 text-emerald-700", engagement: 95, last: "2h ago" },
          { name: "Urban Wellness", type: "Dispensary", ltv: "$89,200", status: "Active", color: "bg-blue-100 text-blue-700", engagement: 78, last: "1d ago" },
          { name: "Coastal Collective", type: "Chain", ltv: "$210,000", status: "VIP", color: "bg-purple-100 text-purple-700", engagement: 98, last: "5h ago" },
          { name: "High Tide Retail", type: "Retailer", ltv: "$45,600", status: "Risk", color: "bg-amber-100 text-amber-700", engagement: 42, last: "2w ago" },
          { name: "Pure Canna", type: "Partner", ltv: "$12,400", status: "New", color: "bg-pink-100 text-pink-700", engagement: 60, last: "1d ago" },
          { name: "Zen Garden", type: "Retailer", ltv: "$67,800", status: "Active", color: "bg-cyan-100 text-cyan-700", engagement: 82, last: "3d ago" },
          { name: "Cloud Nine", type: "Retailer", ltv: "$34,200", status: "Active", color: "bg-indigo-100 text-indigo-700", engagement: 72, last: "4h ago" },
          { name: "Leafy Lane", type: "Dispensary", ltv: "$156,000", status: "VIP", color: "bg-teal-100 text-teal-700", engagement: 91, last: "1h ago" },
        ].map((client, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-xl border border-slate-200 p-4 relative group hover:border-[hsl(var(--marketing-primary))]/30 hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${client.color} flex items-center justify-center font-bold border border-white shadow-sm`}>
                  {client.name.substring(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">{client.name}</div>
                  <div className="text-[10px] text-slate-500 font-medium">{client.type} • Active {client.last}</div>
                </div>
              </div>
              <ShieldCheck className={`w-4 h-4 ${client.status === 'VIP' ? 'text-amber-500' : 'text-slate-200'}`} />
            </div>

            <div className="h-px bg-slate-100 mb-4" />

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Lifetime Value</div>
                <div className="text-sm font-mono font-bold text-slate-800">{client.ltv}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Health Score</div>
                <div className={`text-sm font-mono font-bold ${client.engagement > 80 ? 'text-emerald-600' : client.engagement < 50 ? 'text-red-500' : 'text-amber-500'}`}>{client.engagement}/100</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50">Message</Button>
              <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50">Profile</Button>
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
        <h2 className="text-slate-800 font-semibold text-lg">Performance Analytics</h2>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <div className="px-3 py-1 bg-white rounded text-xs text-slate-800 font-medium cursor-pointer shadow-sm">Sales</div>
          <div className="px-3 py-1 rounded text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">Traffic</div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 p-5 relative overflow-hidden flex flex-col shadow-sm">
        <div className="flex items-end justify-between h-full gap-2 px-4 pb-2">
          {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
            <motion.div
              key={i}
              className="flex-1 bg-[hsl(var(--marketing-primary))]/20 hover:bg-[hsl(var(--marketing-primary))]/40 rounded-t-sm transition-colors relative group"
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-bold">
                ${h * 120}
              </div>
            </motion.div>
          ))}
        </div>
        <div className="border-t border-slate-100 pt-2 flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest px-2">
          <span>Jan</span><span>Dec</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 h-32">
        {[
          { label: "Conversion Rate", val: "3.2%", change: "+0.4%", c: "text-emerald-600" },
          { label: "Avg Session", val: "4m 12s", change: "+12s", c: "text-blue-600" },
          { label: "Bounce Rate", val: "42%", change: "-2%", c: "text-emerald-600" },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-center shadow-sm">
            <div className="text-slate-400 text-[10px] uppercase font-bold mb-1">{stat.label}</div>
            <div className="text-2xl font-bold text-slate-900 mb-1">{stat.val}</div>
            <div className={`text-xs ${stat.c} flex items-center gap-1 font-bold`}>
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
          <h2 className="text-slate-800 font-semibold text-lg">Live Fleet</h2>
          <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50">3 Drivers Active</Badge>
        </div>
        <div className="text-[10px] text-slate-500 font-mono flex gap-3 font-medium">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> ON TIME</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> DELAYED</span>
        </div>
      </div>

      <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 relative overflow-hidden group">
        {/* NYC Grid Background - Light Mode */}
        <svg className="absolute inset-0 w-full h-full opacity-30" width="100%" height="100%">
          <defs>
            <pattern id="nyc-grid-fleet-dash" width="50" height="25" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="25" stroke="#cbd5e1" strokeWidth="1.5" />
              <line x1="50" y1="0" x2="50" y2="25" stroke="#cbd5e1" strokeWidth="1.5" />
              <line x1="0" y1="12.5" x2="50" y2="12.5" stroke="#e2e8f0" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="#f8fafc" />
          <rect x="0" y="0" width="100%" height="100%" fill="url(#nyc-grid-fleet-dash)" />
          {/* Central Park Area */}
          <rect x="0" y="0" width="30%" height="40%" fill="#dcfce7" />
        </svg>

        {/* Map Labels */}
        <div className="absolute inset-0 pointer-events-none opacity-50 text-[9px] font-bold font-sans text-slate-500 uppercase tracking-widest">
          <div className="absolute top-[40%] left-[10%]">8th Ave</div>
          <div className="absolute top-[60%] left-[50%]">5th Ave</div>
          <div className="absolute top-[80%] right-[20%]">Broadway</div>
        </div>

        {/* Routes Layer - Light Mode Colors */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300" preserveAspectRatio="none">
          {/* Driver 1: Mike (Rerouting Demo) */}
          <motion.path
            d="M50,300 L50,150 L200,150 L200,50 L300,50"
            fill="none" stroke="#60a5fa" strokeWidth="3" strokeOpacity="0.5"
            animate={{ opacity: routeType === 'optimized' ? 0 : 0.5 }}
          />
          {rerouting && <motion.path d="M100,150 L175,150" fill="none" stroke="#f87171" strokeWidth="4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />}
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
            fill="none" stroke="#a78bfa" strokeWidth="3" strokeOpacity="0.4"
            strokeDasharray="4 4"
            animate={{ strokeDashoffset: [0, -20] }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />

          {/* Driver 3: Bot (Amber) */}
          <motion.path
            d="M100,0 L100,100 L300,100"
            fill="none" stroke="#fbbf24" strokeWidth="3" strokeOpacity="0.4"
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
          <div className="w-3 h-3 bg-white rounded-full shadow-lg ring-2 ring-blue-500" />
          <div className="absolute -top-6 -left-4 bg-white px-2 py-0.5 rounded text-[8px] text-slate-700 whitespace-nowrap border border-slate-200 shadow-sm font-bold">
            {rerouting ? <span className="text-red-500">TRAFFIC</span> : "Mike P."}
          </div>
        </motion.div>

        {/* Driver 2 (Sarah) */}
        <motion.div
          className="absolute z-20"
          animate={{ top: ['65%', '65%', '80%'], left: ['85%', '35%', '35%'] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-3 h-3 bg-white rounded-full shadow-lg ring-2 ring-purple-500" />
        </motion.div>

        {/* Driver 3 (Bot) */}
        <motion.div
          className="absolute z-20"
          animate={{ top: ['0%', '30%', '30%'], left: ['25%', '25%', '70%'] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-3 h-3 bg-white rounded-full shadow-lg ring-2 ring-amber-500" />
        </motion.div>

        {/* Mission Control HUD */}
        <div className="absolute top-4 right-4 bg-white/90 border border-slate-200 p-2 rounded text-[10px] text-slate-500 font-mono shadow-sm">
          <div className="flex gap-4 font-bold">
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
    { id: 1, name: "VIP Catalog", icon: "👑", gradient: "from-violet-100 to-indigo-100 text-indigo-500", stats: { views: 242, orders: 45 }, exp: "5d" },
    { id: 2, name: "Flash Sale", icon: "⚡", gradient: "from-rose-100 to-red-100 text-rose-500", stats: { views: 890, orders: 120 }, exp: "4h" },
    { id: 3, name: "New Drops", icon: "🌿", gradient: "from-emerald-100 to-teal-100 text-emerald-500", stats: { views: 156, orders: 28 }, exp: "2d" },
    { id: 4, name: "Wholesale", icon: "📦", gradient: "from-amber-100 to-orange-100 text-amber-500", stats: { views: 12, orders: 3 }, exp: "Active" },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-slate-800 font-bold text-lg">Secure Menus</h2>
        <Button size="sm" className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white text-xs shadow-sm"><Plus className="w-3 h-3 mr-2" /> Create Link</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {menus.map((menu, i) => (
          <motion.div
            key={menu.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="relative h-48 rounded-xl overflow-hidden group cursor-pointer border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${menu.gradient.split(" ").slice(0, 2).join(" ")} opacity-30`} />

            <div className="absolute inset-0 p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className={`w-10 h-10 rounded-lg bg-white flex items-center justify-center text-lg shadow-sm ${menu.gradient.split(" ").pop()}`}>
                  {menu.icon}
                </div>
                <div className="flex gap-1">
                  <div className="bg-white/80 backdrop-blur border border-slate-200 px-2 py-1 rounded text-[10px] text-slate-600 flex items-center gap-1 font-bold">
                    <Lock className="w-3 h-3 text-emerald-500" />
                    Encrypted
                  </div>
                  <div className="bg-white/80 backdrop-blur border border-slate-200 px-2 py-1 rounded text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {menu.exp}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-slate-800 font-bold text-lg mb-1">{menu.name}</h3>
                <div className="flex gap-4 text-xs text-slate-500 mb-4 font-medium">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {menu.stats.views} views</span>
                  <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> {menu.stats.orders} orders</span>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                  <Button
                    size="sm"
                    className={`flex-1 h-8 text-[10px] shadow-sm ${copied === i ? 'bg-emerald-600 text-white' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'}`}
                    onClick={() => handleCopy(i)}
                  >
                    {copied === i ? "Copied!" : "Copy Link"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="View settings"><Settings className="w-3 h-3" /></Button>
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
