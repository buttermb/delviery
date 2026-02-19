import { LayoutDashboard, ShoppingCart, Package, Users, BarChart3, Settings } from 'lucide-react';
import React from 'react';

// Browser frame with sidebar, used by all scenes
interface Props {
  title: string;
  children: React.ReactNode;
}

export function DashboardMockup({ title, children }: Props) {
  return (
    <div className="w-full h-full flex font-sans text-slate-800"
      style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)' }}>

      {/* Sidebar - Deep Indigo Premium Look */}
      <div className="w-20 border-r border-indigo-100 flex flex-col items-center py-6 gap-8 z-20 shadow-sm"
        style={{ backgroundColor: '#FFFFFF' }}>
        {/* Logo Area */}
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: 'linear-gradient(135deg, #2E1679 0%, #4c32a0 100%)' }}>
          <LayoutDashboard className="w-6 h-6 text-white" />
        </div>

        {/* Nav Icons */}
        <div className="flex flex-col gap-6 w-full items-center">
          <div className="p-3 rounded-xl bg-indigo-50 shadow-inner">
            <BarChart3 className="w-6 h-6" style={{ color: '#2E1679' }} /> // Active State
          </div>
          <div className="p-3 rounded-xl text-slate-400 hover:bg-slate-50 transition-colors">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div className="p-3 rounded-xl text-slate-400 hover:bg-slate-50 transition-colors">
            <Package className="w-6 h-6" />
          </div>
          <div className="p-3 rounded-xl text-slate-400 hover:bg-slate-50 transition-colors">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="mt-auto p-3 rounded-xl text-slate-400">
          <Settings className="w-6 h-6" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header - Glassmorphism feel */}
        <div className="h-16 bg-white/80 backdrop-blur-md border-b border-indigo-50 flex items-center px-6 justify-between z-10 sticky top-0">
          {/* Breadcrumb / Title */}
          <div className="flex items-center gap-3">
            <div className="h-8 px-4 bg-indigo-50 rounded-lg flex items-center gap-2 text-sm font-semibold text-indigo-900 border border-indigo-100">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {title}
            </div>
          </div>

          {/* User Profile Stub */}
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white shadow-md" />
          </div>
        </div>

        {/* Scene Container with soft vignette */}
        <div className="flex-1 p-8 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

          <div className="relative z-10 w-full h-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon wrapper to avoid direct Lucide imports if needed, but direct is fine here
const ShoppingBag = ({ className }: { className?: string }) => <ShoppingCart className={className} />;
