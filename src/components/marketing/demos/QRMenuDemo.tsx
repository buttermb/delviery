/**
 * QRMenuDemo Component - Premium Design
 * 
 * Polished menu showcase with glassmorphism and premium aesthetics.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, Users, ShoppingCart, DollarSign,
  Lock, Shield, MapPin, Clock, QrCode,
  Copy, Share2, ExternalLink, Flame, MessageSquare,
  ChevronLeft, ChevronRight, Check
} from 'lucide-react';

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
    gradient: 'from-violet-600 via-purple-600 to-indigo-600', icon: '👑',
  },
  {
    id: '2', name: 'Flash Sale', type: 'catalog', status: 'active',
    views: 267, customers: 52, orders: 41, revenue: 5800, products: 8,
    expiresIn: '6h', security: ['Encrypted'],
    gradient: 'from-rose-600 via-pink-600 to-red-600', icon: '⚡',
  },
  {
    id: '3', name: 'Weekly Drop', type: 'catalog', status: 'active',
    views: 142, customers: 34, orders: 28, revenue: 3200, products: 6,
    expiresIn: '2d', security: ['Encrypted'],
    gradient: 'from-emerald-600 via-teal-600 to-cyan-600', icon: '🌿',
  },
  {
    id: '4', name: 'Community', type: 'forum', status: 'active',
    views: 89, customers: 15, orders: 0, revenue: 0, products: 0,
    expiresIn: null, security: ['Device Lock'],
    gradient: 'from-amber-600 via-orange-600 to-yellow-600', icon: '💬',
  },
];

export function QRMenuDemo() {
  const [menus, setMenus] = useState(MOCK_MENUS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-rotate
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % menus.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [menus.length, isPaused]);

  // Animate stats
  useEffect(() => {
    const timer = setInterval(() => {
      setMenus(prev => prev.map(m => ({
        ...m,
        views: m.views + (Math.random() > 0.5 ? 1 : 0),
        orders: m.orders + (Math.random() > 0.85 ? 1 : 0),
        revenue: m.revenue + (Math.random() > 0.7 ? Math.floor(Math.random() * 50) : 0),
      })));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const menu = menus[activeIndex];

  return (
    <div
      className="w-full h-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 rounded-xl border border-zinc-800/50 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Ambient glow */}
      <div className={`absolute inset-0 bg-gradient-to-br ${menu.gradient} opacity-5 blur-3xl pointer-events-none`} />

      <div className="relative p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${menu.gradient} flex items-center justify-center text-white shadow-lg`}>
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Disposable Menus</h3>
              <p className="text-xs text-zinc-500">{menus.length} menus active</p>
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
              <div className="h-full bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-700/50 overflow-hidden shadow-2xl">
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
                    <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                      <Eye className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                      <motion.div
                        key={menu.views}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className="text-lg font-bold text-white"
                      >
                        {menu.views}
                      </motion.div>
                      <div className="text-xs text-zinc-500">views</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                      <Users className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                      <div className="text-lg font-bold text-white">{menu.customers}</div>
                      <div className="text-xs text-zinc-500">clients</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                      <ShoppingCart className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                      <motion.div
                        key={menu.orders}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className="text-lg font-bold text-white"
                      >
                        {menu.orders}
                      </motion.div>
                      <div className="text-xs text-zinc-500">orders</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-xl p-3 text-center border border-emerald-500/20">
                      <DollarSign className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                      <motion.div
                        key={menu.revenue}
                        initial={{ scale: 1.1 }}
                        animate={{ scale: 1 }}
                        className="text-lg font-bold text-emerald-400"
                      >
                        ${(menu.revenue / 1000).toFixed(1)}k
                      </motion.div>
                      <div className="text-xs text-emerald-400/60">revenue</div>
                    </div>
                  </div>

                  {/* Security badges */}
                  <div className="flex flex-wrap gap-2">
                    {menu.security.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-300">
                        {s === 'Encrypted' && <Lock className="w-3 h-3 text-emerald-400" />}
                        {s === 'Geofenced' && <MapPin className="w-3 h-3 text-blue-400" />}
                        {s === 'Device Lock' && <Shield className="w-3 h-3 text-amber-400" />}
                        {s}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                    <button
                      onClick={handleCopy}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${copied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                        }`}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span className="text-xs font-medium">{copied ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                    <button className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
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
