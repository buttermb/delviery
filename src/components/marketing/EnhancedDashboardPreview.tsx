import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, BarChart3, Radio, Shield, Search, Bell, Menu, MousePointer2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardViews, DashboardViewKey } from './dashboard/DashboardViews';
import { useMobileOptimized } from '@/hooks/useMobileOptimized';

export function EnhancedDashboardPreview() {
  const navigate = useNavigate();
  const { isMobile } = useMobileOptimized();
  const [isVisible, setIsVisible] = useState(false);
  const [activeView, setActiveView] = useState<DashboardViewKey>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  /* Click-to-Activate Model - disabled on mobile to prevent scroll trap */
  const [isInteracting, setIsInteracting] = useState(false);

  const handleOverlayClick = () => {
    if (isMobile) {
      // On mobile, navigate to demo page instead of enabling nested scroll
      navigate('/demo');
    } else {
      setIsInteracting(true);
    }
  };

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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--marketing-primary))]/5 border border-[hsl(var(--marketing-primary))]/10 text-[10px] font-medium text-[hsl(var(--marketing-primary))] mb-4 backdrop-blur-sm uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Interactive Preview
        </div>
        <h2 className="text-3xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))] tracking-tight">
          Complete Cannabis <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))]">Distribution Management</span>
        </h2>
        <p className="text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto text-sm md:text-base font-light leading-relaxed">
          Experience the full power of FloraIQ. Click the dashboard below to take control.
        </p>
      </motion.div>

      {/* 2. Main Window Application Shell */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 20 }}
        animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.98, y: isVisible ? 0 : 20 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border border-[hsl(var(--marketing-border))] bg-white" // Modified
        onMouseLeave={() => setIsInteracting(false)}
      >
        {/* Enterprise Overlay Guard Layer */}
        <motion.div
          animate={{ opacity: isInteracting ? 0 : 1 }}
          transition={{ duration: 0.4 }}
          onClick={handleOverlayClick}
          className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm cursor-pointer ${isInteracting ? 'pointer-events-none' : 'pointer-events-auto'}`}
        >
          <div className="text-center transform translate-y-[-20px]">
            <h3 className="text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-text))] mb-3 tracking-tight">Enterprise Grade</h3>
            <div className="flex items-center justify-center gap-2 text-[hsl(var(--marketing-primary))] text-sm font-medium uppercase tracking-widest mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Interactive Demo
            </div>
            <div className="flex flex-col items-center gap-2 text-[hsl(var(--marketing-text-light))] text-xs animate-bounce">
              <MousePointer2 className="w-6 h-6" />
              <span>{isMobile ? 'Tap to Open Demo' : 'Click to Interact'}</span>
            </div>
          </div>
        </motion.div>

        {/* Exit interaction button - desktop only */}
        {isInteracting && !isMobile && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setIsInteracting(false)}
            className="absolute top-14 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 text-white text-xs font-medium hover:bg-slate-900 transition-colors backdrop-blur-sm"
          >
            <X className="w-3 h-3" />
            Exit Preview
          </motion.button>
        )}

        {/* macOS-style Window Header */}
        <div className="h-10 bg-slate-50 border-b border-slate-200 flex items-center px-4 justify-between select-none">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400 border border-red-500/30" />
            <div className="w-3 h-3 rounded-full bg-amber-400 border border-amber-500/30" />
            <div className="w-3 h-3 rounded-full bg-emerald-400 border border-emerald-500/30" />
          </div>

          <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200 text-[10px] text-slate-500 font-mono w-64 justify-center shadow-sm">
            <span className="text-emerald-500">🔒</span>
            <span>app.floraiq.io/dashboard</span>
          </div>

          <div className="w-12" /> {/* Spacer for centering */}
        </div>

        {/* Application Layout - Pointer events disabled when not interacting */}
        <div
          className={`flex h-[600px] bg-slate-50 text-slate-900 transition-all ${isInteracting ? 'pointer-events-auto' : 'pointer-events-none'}`}
        >

          {/* Sidebar Navigation */}
          <div className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} flex-shrink-0 border-r border-slate-200 bg-white flex flex-col transition-all duration-300`}>
            {/* Sidebar Header */}
            <div className="h-16 flex items-center px-4 border-b border-slate-100 gap-3">
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--marketing-primary))] flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-indigo-200">F</div>
              {!isSidebarCollapsed && <span className="font-semibold text-slate-900 tracking-tight">FloraIQ</span>}
            </div>

            {/* Nav Items */}
            <div className="flex-1 py-4 space-y-1 px-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as DashboardViewKey)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all relative group ${activeView === item.id
                    ? 'bg-[hsl(var(--marketing-primary))]/10 text-[hsl(var(--marketing-primary))] font-medium'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                >
                  <item.icon className={`w-4 h-4 ${activeView === item.id ? 'text-[hsl(var(--marketing-primary))]' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  {!isSidebarCollapsed && (
                    <>
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-medium ${item.badge === 'Alert' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                          }`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {activeView === item.id && (
                    <motion.div layoutId="active-nav" className="absolute left-0 top-0 bottom-0 w-1 bg-[hsl(var(--marketing-primary))] rounded-r-full" />
                  )}
                </button>
              ))}
            </div>

            {/* User Profile / Bottom */}
            <div className="p-4 border-t border-slate-100">
              <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <span className="text-slate-600 text-xs font-bold">JD</span>
                </div>
                {!isSidebarCollapsed && (
                  <div className="overflow-hidden">
                    <div className="text-xs font-medium text-slate-900">John Doe</div>
                    <div className="text-[10px] text-slate-500">Admin Access</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
            {/* Top Bar */}
            <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span>{navItems.find(n => n.id === activeView)?.label}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-9 bg-slate-100 rounded-lg border border-slate-200 flex items-center px-3 gap-2 w-64 text-slate-400 hidden md:flex hover:bg-white hover:shadow-sm transition-all">
                  <Search className="w-4 h-4" />
                  <span className="text-xs">Search anything...</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 relative hover:bg-slate-50 transition-colors cursor-pointer shadow-sm">
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white" />
                </div>
                <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} aria-label="Toggle sidebar">
                  <Menu className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* View Content - no overscrollBehavior to prevent scroll trap */}
            <div
              className={`flex-1 relative p-6 ${isInteracting && !isMobile ? 'overflow-auto' : 'overflow-hidden'}`}
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
