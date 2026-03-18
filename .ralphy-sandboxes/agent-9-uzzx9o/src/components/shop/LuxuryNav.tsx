import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Search, ShoppingBag, Menu, X, User } from 'lucide-react';
import { useShop } from '@/pages/shop/ShopLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LuxuryNavProps {
  cartItemCount?: number;
  onCartClick?: () => void;
  accentColor?: string;
}

export function LuxuryNav({ cartItemCount = 0, onCartClick, accentColor: _accentColor }: LuxuryNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { store, isPreviewMode } = useShop();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const previewParam = isPreviewMode ? '?preview=true' : '';

  return (
    <>
      <div className="sticky top-0 left-0 right-0 z-50 shadow-md transition-all duration-300">
        {/* Main nav: Dark Teal Background like Flowhub */}
        <nav className={`text-white transition-all duration-500 ease-in-out ${scrolled ? 'h-16 shadow-xl py-0' : 'h-20 py-2'}`} style={{ backgroundColor: 'var(--storefront-bg, #0c0a09)' }}>
          <div className="container mx-auto px-4 md:px-8 h-full">
            <div className="flex items-center justify-between h-full">
              {/* Logo Area */}
              <Link to={`/shop/${storeSlug}${previewParam}`} className="group flex items-center gap-3">
                {store?.logo_url ? (
                  <img
                    src={store.logo_url}
                    alt={store.store_name}
                    className={`object-contain transition-all duration-300 ${scrolled ? 'h-8' : 'h-10'}`}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className={`rounded-lg flex items-center justify-center font-bold rounded-bl-sm transition-all duration-300 ${scrolled ? 'w-8 h-8 text-lg' : 'w-9 h-9 text-xl'}`} style={{ backgroundColor: 'var(--storefront-primary, #d4af37)', color: 'var(--storefront-bg, #0c0a09)' }}>
                      {store?.store_name?.charAt(0) || 'Q'}
                    </div>
                    <div className="flex flex-col -space-y-1">
                      <span className="text-white font-bold text-xl tracking-tight leading-none">
                        {store?.store_name || 'FloraIQ'}
                      </span>
                      {store?.tagline && (
                        <span className="text-[10px] text-white/60 font-medium tracking-wider uppercase">
                          {store.tagline.slice(0, 20)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </Link>

              {/* Desktop Center Nav */}
              <div className="hidden md:flex items-center gap-8">
                <Link
                  to={`/shop/${storeSlug}/products${previewParam}`}
                  className="text-sm font-bold text-white/90 hover:text-white hover:underline decoration-current underline-offset-4 transition-all"
                >
                  Shop
                </Link>
                <Link
                  to={`/shop/${storeSlug}/deals${previewParam}`}
                  className="text-sm font-bold text-white/90 hover:text-white hover:underline decoration-current underline-offset-4 transition-all"
                >
                  Deals
                </Link>
                {!isPreviewMode && (
                  <>
                    <Link
                      to={`/shop/${storeSlug}/orders`}
                      className="text-sm font-bold text-white/90 hover:text-white hover:underline decoration-current underline-offset-4 transition-all"
                    >
                      Orders
                    </Link>
                    <Link
                      to={`/shop/${storeSlug}/about`}
                      className="text-sm font-bold text-white/90 hover:text-white hover:underline decoration-current underline-offset-4 transition-all"
                    >
                      Details
                    </Link>
                  </>
                )}
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-4">

                {/* Search Bar (Desktop) */}
                <div className="hidden md:flex items-center bg-white/10 rounded-full px-4 py-2 border border-white/20 hover:bg-white/20 transition-colors w-64 group focus-within:bg-white focus-within:text-neutral-900 focus-within:border-white">
                  <label htmlFor="nav-desktop-search" className="sr-only">Search products</label>
                  <Search className="w-4 h-4 text-white/70 group-focus-within:text-neutral-500 mr-2 transition-colors" />
                  <input
                    id="nav-desktop-search"
                    type="text"
                    placeholder="Search products..."
                    className="bg-transparent border-none outline-none text-sm text-white placeholder:text-white/50 w-full group-focus-within:text-neutral-900 group-focus-within:placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-ring rounded"
                    onClick={() => navigate(`/shop/${storeSlug}/products${previewParam}`)}
                  />
                </div>

                {/* Mobile Search Icon */}
                <button
                  onClick={() => navigate(`/shop/${storeSlug}/products${previewParam}`)}
                  className="md:hidden w-10 h-10 flex items-center justify-center text-white/90 hover:text-white transition-colors"
                >
                  <Search className="w-5 h-5" />
                </button>

                {/* Cart Button (Flowhub "View Bag" style) */}
                {!isPreviewMode && (
                  <button
                    onClick={onCartClick || (() => navigate(`/shop/${storeSlug}/cart`))}
                    className="relative flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                    style={{ backgroundColor: 'var(--storefront-primary, #d4af37)', color: 'var(--storefront-bg, #0c0a09)' }}
                    aria-label="Shopping cart"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span className="hidden md:inline text-sm">Cart</span>
                    {cartItemCount > 0 && (
                      <span className="text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center ml-1" style={{ backgroundColor: 'var(--storefront-bg, #0c0a09)' }}>
                        {cartItemCount}
                      </span>
                    )}
                  </button>
                )}

                {/* Account (Desktop) */}
                {!isPreviewMode && (
                  <Link
                    to={`/shop/${storeSlug}/account`}
                    className="hidden md:flex w-10 h-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    aria-label="Account"
                  >
                    <User className="w-5 h-5" />
                  </Link>
                )}

                {/* Mobile Menu Toggle */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors"
                  aria-label="Menu"
                >
                  {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>
        </nav>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop to catch taps outside menu */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={cn(
                "fixed left-0 right-0 z-50 border-t border-white/10 shadow-xl md:hidden",
                scrolled ? "top-16" : "top-20"
              )}
              style={{ maxHeight: 'calc(100dvh - 5rem)', backgroundColor: 'var(--storefront-bg, #0c0a09)' }}
            >
            <nav className="flex flex-col p-6 gap-4">
              <div className="flex items-center bg-white/10 rounded-full px-4 py-3 border border-white/20 mb-4">
                <label htmlFor="nav-mobile-search" className="sr-only">Search products</label>
                <Search className="w-5 h-5 text-white/70 mr-3" />
                <input
                  id="nav-mobile-search"
                  type="text"
                  placeholder="Search..."
                  className="bg-transparent border-none outline-none text-base text-white placeholder:text-white/50 w-full focus-visible:ring-2 focus-visible:ring-white/50 rounded"
                  onClick={() => navigate(`/shop/${storeSlug}/products${previewParam}`)}
                />
              </div>

              <Link
                to={`/shop/${storeSlug}/products${previewParam}`}
                className="flex items-center justify-between text-lg text-white font-bold py-2 border-b border-white/10"
                onClick={() => setMobileMenuOpen(false)}
              >
                Shop Collection
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--storefront-primary, #d4af37)' }}></span>
              </Link>

              <Link
                to={`/shop/${storeSlug}/deals${previewParam}`}
                className="flex items-center justify-between text-lg text-white/90 font-medium py-2 border-b border-white/10"
                onClick={() => setMobileMenuOpen(false)}
              >
                Deals & Promos
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--storefront-primary, #d4af37)' }}></span>
              </Link>

              {!isPreviewMode && (
                <>
                  <Link
                    to={`/shop/${storeSlug}/orders`}
                    className="text-lg text-white/90 font-medium py-2 border-b border-white/10"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Track Orders
                  </Link>
                  <Link
                    to={`/shop/${storeSlug}/account`}
                    className="text-lg text-white/90 font-medium py-2 border-b border-white/10"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    My Account
                  </Link>
                </>
              )}
            </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
