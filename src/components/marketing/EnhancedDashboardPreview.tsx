import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, ShoppingCart, Package, Users, BarChart3, Radio, Shield, ChevronRight, Search, Bell, Settings, LogOut, Menu, MousePointer2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardViews, DashboardViewKey } from './dashboard/DashboardViews';

export function EnhancedDashboardPreview() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeView, setActiveView] = useState<DashboardViewKey>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  /* New State for Click-to-Activate Model */
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'orders', icon: ShoppingCart, label: 'Orders', badge: '3' },
    { id: 'inventory', icon: Package, label: 'Inventory', badge: 'Alert' },
    { id: 'catalog', icon: Menu, label: 'Catalog' },
    { id: 'customers', icon: Users, label: 'CRM' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'tracking', icon: Radio, label: 'Live Fleet' },
    { id: 'menus', icon: Shield, label: 'Secure Menus' },
  ];

  return (
    <div className="relative w-full max-w-[1100px] mx-auto group font-sans">

      {/* 1. Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : -20 }}
        className="text-center mb-10 px-4 relative z-10"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium text-white/60 mb-4 backdrop-blur-sm uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Interactive Preview
        </div>
        <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white tracking-tight">
          Complete Cannabis <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Distribution Management</span>
        </h2>
        <p className="text-white/40 max-w-2xl mx-auto text-sm md:text-base font-light leading-relaxed">
          Experience the full power of FloraIQ. Click the dashboard below to take control.
        </p>
      </motion.div>

      {/* 2. Main Window Application Shell */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 20 }}
        animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.98, y: isVisible ? 0 : 20 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0a0a0a]"
        style={{ touchAction: isInteracting ? 'auto' : 'none', overscrollBehavior: 'contain' }}
        onMouseLeave={() => setIsInteracting(false)} // Auto-lock on exit to prevent scroll trap
      >
        {/* Enterprise Overlay Guard Layer */}
        <motion.div
          animate={{ opacity: isInteracting ? 0 : 1 }}
          transition={{ duration: 0.4 }}
          onClick={() => setIsInteracting(true)}
          className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer ${isInteracting ? 'pointer-events-none' : 'pointer-events-auto'}`}
        >
          <div className="text-center transform translate-y-[-20px]">
            <h3 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">Enterprise Grade</h3>
            <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-medium uppercase tracking-widest mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Interactive Demo
            </div>
            <div className="flex flex-col items-center gap-2 text-white/50 text-xs animate-bounce">
              <MousePointer2 className="w-6 h-6" />
              <span>Click to Interact</span>
            </div>
          </div>
        </motion.div>

        {/* macOS-style Window Header */}
        <div className="h-10 bg-[#0f1115] border-b border-white/5 flex items-center px-4 justify-between select-none">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/30" />
            <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/30" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/30" />
          </div>

          <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded-full border border-white/5 text-[10px] text-white/30 font-mono w-64 justify-center">
            <span className="text-emerald-500">🔒</span>
            <span>app.floraiq.io/dashboard</span>
          </div>

          <div className="w-12" /> {/* Spacer for centering */}
        </div>

        {/* Application Layout - Pointer events and touch disabled when not interacting */}
        <div
          className={`flex h-[600px] bg-[#0c0c0c] text-white transition-all ${isInteracting ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{ touchAction: isInteracting ? 'auto' : 'none', overflow: isInteracting ? 'visible' : 'hidden' }}
        >

          {/* Sidebar Navigation */}
          <div className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} flex-shrink-0 border-r border-white/5 bg-[#0f1115] flex flex-col transition-all duration-300`}>
            {/* Sidebar Header */}
            <div className="h-16 flex items-center px-4 border-b border-white/5 gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-lg">F</div>
              {!isSidebarCollapsed && <span className="font-semibold text-white tracking-tight">FloraIQ</span>}
            </div>

            {/* Nav Items */}
            <div className="flex-1 py-4 space-y-1 px-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as DashboardViewKey)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all relative group ${activeView === item.id
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <item.icon className={`w-4 h-4 ${activeView === item.id ? 'text-white' : 'text-white/40 group-hover:text-white'}`} />
                  {!isSidebarCollapsed && (
                    <>
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-medium ${item.badge === 'Alert' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {activeView === item.id && (
                    <motion.div layoutId="active-nav" className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
                  )}
                </button>
              ))}
            </div>

            {/* User Profile / Bottom */}
            <div className="p-4 border-t border-white/5">
              <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <span className="text-indigo-400 text-xs font-bold">JD</span>
                </div>
                {!isSidebarCollapsed && (
                  <div className="overflow-hidden">
                    <div className="text-xs font-medium text-white">John Doe</div>
                    <div className="text-[10px] text-white/40">Admin Access</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#0c0c0c]">
            {/* Top Bar */}
            <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0c0c0c]/80 backdrop-blur-sm sticky top-0 z-20">
              <div className="flex items-center gap-4 text-sm text-white/40">
                <span>{navItems.find(n => n.id === activeView)?.label}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-9 bg-white/5 rounded-lg border border-white/5 flex items-center px-3 gap-2 w-64 text-white/30 hidden md:flex">
                  <Search className="w-4 h-4" />
                  <span className="text-xs">Search anything...</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/60 relative hover:bg-white/10 transition-colors cursor-pointer">
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-[#0c0c0c]" />
                </div>
                <Button variant="ghost" size="icon" className="text-white/40 hover:text-white" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                  <Menu className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* View Content - Scroll completely disabled when locked */}
            <div
              className={`flex-1 relative p-6 ${isInteracting ? 'overflow-auto' : 'overflow-hidden'}`}
              style={{ touchAction: isInteracting ? 'auto' : 'none' }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="h-full"
                >
                  <DashboardViews activeView={activeView} isInteractive={isInteracting} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
