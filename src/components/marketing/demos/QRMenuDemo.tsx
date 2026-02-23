/**
 * QRMenuDemo Component - Premium Design
 * 
 * Polished menu showcase with glassmorphism and premium aesthetics.
 * Mobile: Simplified card view with condensed stats
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, Users, ShoppingCart, DollarSign,
  Lock, Shield, MapPin, Clock, QrCode,
  Copy, Share2, ExternalLink, Flame, MessageSquare,
  ChevronLeft, ChevronRight, Check, Zap
} from 'lucide-react';
import { useMobileOptimized } from '@/hooks/useMobileOptimized';

interface MockMenu {
  id: string;
  name: string;
  type: 'catalog' | 'forum';
  status: 'active' | 'burned';
  views: number;
  customers: number;
  orders: number;
  revenue: number;
  products: number;
  expiresIn: string | null;
  security: string[];
  gradient: string;
  icon: string;
}

const MOCK_MENUS: MockMenu[] = [
  {
    id: '1', name: 'VIP Clients', type: 'catalog', status: 'active',
    views: 24, customers: 8, orders: 12, revenue: 1450, products: 12,
    expiresIn: '5d', security: ['Encrypted', 'Geofenced'],
    gradient: 'from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-secondary))]', icon: '👑',
  },
  {
    id: '2', name: 'Flash Sale', type: 'catalog', status: 'active',
    views: 267, customers: 52, orders: 41, revenue: 5800, products: 8,
    expiresIn: '6h', security: ['Encrypted'],
    gradient: 'from-[hsl(var(--marketing-accent))] to-orange-500', icon: '⚡',
  },
  {
    id: '3', name: 'Weekly Drop', type: 'catalog', status: 'active',
    views: 142, customers: 34, orders: 28, revenue: 3200, products: 6,
    expiresIn: '2d', security: ['Encrypted'],
    gradient: 'from-[hsl(var(--marketing-secondary))] to-[hsl(var(--marketing-primary))]', icon: '🌿',
  },
];

// Mobile-optimized version
function QRMenuDemoMobile() {
  return (
    <div className="w-full min-h-[300px] bg-slate-50 dark:bg-zinc-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
            <QrCode className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm">Disposable Menus</div>
            <div className="text-xs text-slate-500">3 menus active</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium">Live</span>
        </div>
      </div>

      {/* Menu Cards */}
      <div className="space-y-3">
        {MOCK_MENUS.slice(0, 2).map((menu) => (
          <div key={menu.id} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{menu.icon}</span>
                <div>
                  <div className="font-semibold text-slate-900">{menu.name}</div>
                  <div className="text-xs text-slate-500">{menu.products} products</div>
                </div>
              </div>
              {menu.expiresIn && (
                <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  <Clock className="w-3 h-3" />
                  {menu.expiresIn}
                </div>
              )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-lg font-bold text-slate-900">{menu.views}</div>
                <div className="text-xs text-slate-500">views</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-900">{menu.orders}</div>
                <div className="text-xs text-slate-500">orders</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-600">${(menu.revenue / 1000).toFixed(1)}k</div>
                <div className="text-xs text-slate-500">revenue</div>
              </div>
            </div>

            {/* Security Badge */}
            <div className="mt-2 flex items-center gap-2">
              {menu.security.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs text-slate-500">
                  {s === 'Encrypted' && <Lock className="w-3 h-3" />}
                  {s === 'Geofenced' && <MapPin className="w-3 h-3" />}
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-full shadow-lg">
          <Zap className="w-3 h-3" />
          QR Menu Demo
        </div>
      </div>
    </div>
  );
}

export function QRMenuDemo() {
  const { shouldUseStaticFallback } = useMobileOptimized();
  const [menus, setMenus] = useState(MOCK_MENUS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Skip animations on mobile
  useEffect(() => {
    if (shouldUseStaticFallback || isPaused) return;
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % menus.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [menus.length, isPaused, shouldUseStaticFallback]);

  // Animate stats (skip on mobile)
  useEffect(() => {
    if (shouldUseStaticFallback) return;
    const timer = setInterval(() => {
      setMenus(prev => prev.map(m => ({
        ...m,
        views: m.views + (Math.random() > 0.5 ? 1 : 0),
        orders: m.orders + (Math.random() > 0.85 ? 1 : 0),
        revenue: m.revenue + (Math.random() > 0.7 ? Math.floor(Math.random() * 50) : 0),
      })));
    }, 2000);
    return () => clearInterval(timer);
  }, [shouldUseStaticFallback]);

  // Mobile fallback
  if (shouldUseStaticFallback) {
    return <QRMenuDemoMobile />;
  }

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const menu = menus[activeIndex];

  return (
    <div
      className="w-full h-full bg-[hsl(var(--marketing-bg))] rounded-xl border border-[hsl(var(--marketing-border))] overflow-hidden shadow-2xl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Ambient glow */}
      <div className={`absolute inset-0 bg-gradient-to-br ${menu.gradient} opacity-10 blur-3xl pointer-events-none transition-colors duration-700`} />

      <div className="relative p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${menu.gradient} flex items-center justify-center text-white shadow-lg`}>
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-[hsl(var(--marketing-text))]">Disposable Menus</h3>
              <p className="text-xs text-[hsl(var(--marketing-text-light))]">{menus.length} menus active</p>
            </div>
          </div>

          {/* Mini nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveIndex(prev => (prev - 1 + menus.length) % menus.length)}
              className="w-7 h-7 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveIndex(prev => (prev + 1) % menus.length)}
              className="w-7 h-7 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Menu Card */}
        <div className="flex-1 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={menu.id}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="h-full"
            >
              <div className="h-full bg-[hsl(var(--marketing-bg-subtle))]/80 backdrop-blur-xl rounded-2xl border border-[hsl(var(--marketing-border))] overflow-hidden shadow-2xl">
                {/* Gradient header */}
                <div className={`h-16 bg-gradient-to-r ${menu.gradient} relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-black/10" />
                  <div className="absolute inset-0 flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{menu.icon}</span>
                      <div>
                        <h4 className="font-bold text-white text-lg">{menu.name}</h4>
                        <div className="flex items-center gap-2">
                          {menu.type === 'forum' ? (
                            <span className="flex items-center gap-1 text-xs text-white/80">
                              <MessageSquare className="w-3 h-3" />
                              Forum
                            </span>
                          ) : (
                            <span className="text-xs text-white/80">{menu.products} products</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {menu.expiresIn && (
                        <span className="px-2 py-1 rounded-lg bg-black/20 backdrop-blur text-xs font-medium text-white flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {menu.expiresIn}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-[hsl(var(--marketing-bg))] rounded-xl p-3 text-center border border-[hsl(var(--marketing-border))]">
                      <Eye className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                      <motion.div
                        key={menu.views}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className="text-lg font-bold text-[hsl(var(--marketing-text))]"
                      >
                        {menu.views}
                      </motion.div>
                      <div className="text-xs text-zinc-500">views</div>
                    </div>
                    <div className="bg-[hsl(var(--marketing-bg))] rounded-xl p-3 text-center border border-[hsl(var(--marketing-border))]">
                      <Users className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                      <div className="text-lg font-bold text-[hsl(var(--marketing-text))]">{menu.customers}</div>
                      <div className="text-xs text-zinc-500">clients</div>
                    </div>
                    <div className="bg-[hsl(var(--marketing-bg))] rounded-xl p-3 text-center border border-[hsl(var(--marketing-border))]">
                      <ShoppingCart className="w-4 h-4 text-[hsl(var(--marketing-text-light))] mx-auto mb-1" />
                      <motion.div
                        key={menu.orders}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className="text-lg font-bold text-[hsl(var(--marketing-text))]"
                      >
                        {menu.orders}
                      </motion.div>
                      <div className="text-xs text-[hsl(var(--marketing-text-light))]">orders</div>
                    </div>
                    <div className="bg-[hsl(var(--marketing-accent))]/10 rounded-xl p-3 text-center border border-[hsl(var(--marketing-accent))]/20">
                      <DollarSign className="w-4 h-4 text-[hsl(var(--marketing-accent))] mx-auto mb-1" />
                      <motion.div
                        key={menu.revenue}
                        initial={{ scale: 1.1 }}
                        animate={{ scale: 1 }}
                        className="text-lg font-bold text-[hsl(var(--marketing-accent))]"
                      >
                        ${(menu.revenue / 1000).toFixed(1)}k
                      </motion.div>
                      <div className="text-xs text-[hsl(var(--marketing-accent))]/60">revenue</div>
                    </div>
                  </div>

                  {/* Security badges */}
                  <div className="flex flex-wrap gap-2">
                    {menu.security.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(var(--marketing-secondary))] border border-[hsl(var(--marketing-border))] text-xs text-[hsl(var(--marketing-text-light))]">
                        {s === 'Encrypted' && <Lock className="w-3 h-3 text-[hsl(var(--marketing-text))]" />}
                        {s === 'Geofenced' && <MapPin className="w-3 h-3 text-blue-400" />}
                        {s === 'Device Lock' && <Shield className="w-3 h-3 text-amber-400" />}
                        {s}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[hsl(var(--marketing-border))]">
                    <button
                      onClick={handleCopy}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${copied
                        ? 'bg-[hsl(var(--marketing-accent))] text-white'
                        : 'bg-[hsl(var(--marketing-secondary))] hover:bg-[hsl(var(--marketing-secondary))]/80 text-[hsl(var(--marketing-text))]'
                        }`}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span className="text-xs font-medium">{copied ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                    <button className="p-2 rounded-lg bg-[hsl(var(--marketing-secondary))] hover:bg-[hsl(var(--marketing-secondary))]/80 text-[hsl(var(--marketing-text-light))] hover:text-[hsl(var(--marketing-text))] transition-colors">
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg bg-[hsl(var(--marketing-secondary))] hover:bg-[hsl(var(--marketing-secondary))]/80 text-[hsl(var(--marketing-text-light))] hover:text-[hsl(var(--marketing-text))] transition-colors">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg bg-[hsl(var(--marketing-secondary))] hover:bg-[hsl(var(--marketing-secondary))]/80 text-[hsl(var(--marketing-text-light))] hover:text-[hsl(var(--marketing-text))] transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <div className="flex-1" />
                    <button className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                      <Flame className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {menus.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setActiveIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === activeIndex
                ? `w-8 bg-gradient-to-r ${m.gradient}`
                : 'w-1.5 bg-zinc-700 hover:bg-zinc-600'
                }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
