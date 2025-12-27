import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Menu, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useShop } from '@/pages/shop/ShopLayout';
import { motion, AnimatePresence } from 'framer-motion';

interface LuxuryNavProps {
  cartItemCount?: number;
  onCartClick?: () => void;
  accentColor?: string;
}

export function LuxuryNav({ cartItemCount = 0, onCartClick, accentColor = '#10b981' }: LuxuryNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { storeSlug } = useParams();
  const navigate = useNavigate();
  const { store, isPreviewMode } = useShop();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const previewParam = isPreviewMode ? '?preview=true' : '';

  return (
    <>
      {/* Floating top bar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        {/* Announcement bar */}
        <div
          className="backdrop-blur-xl border-b border-white/5"
          style={{ backgroundColor: `${accentColor}10` }}
        >
          <div className="container mx-auto px-6 py-2">
            <p className="text-center text-xs text-white/60 font-light tracking-wide">
              Licensed NYC Delivery • Same-Day • Lab Verified
            </p>
          </div>
        </div>

        {/* Main nav */}
        <nav className={`transition-all duration-500 ${scrolled
            ? 'bg-black/80 backdrop-blur-2xl border-b border-white/10 shadow-2xl'
            : 'bg-transparent'
          }`}>
          <div className="container mx-auto px-6">
            <div className="flex items-center justify-between h-20">
              {/* Logo */}
              <Link to={`/shop/${storeSlug}${previewParam}`} className="group flex items-center gap-3">
                {store?.logo_url ? (
                  <img
                    src={store.logo_url}
                    alt={store.store_name}
                    className="h-10 object-contain"
                  />
                ) : (
                  <>
                    <div className="relative w-10 h-10">
                      <div
                        className="absolute inset-0 rounded-full blur-md opacity-40 group-hover:opacity-60 transition-opacity"
                        style={{ backgroundColor: accentColor }}
                      />
                      <div
                        className="relative w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: accentColor }}
                      >
                        <span className="text-white font-bold text-sm">
                          {store?.store_name?.charAt(0) || 'P'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col -space-y-1">
                      <span className="text-white font-light text-sm tracking-wider">
                        {store?.store_name || 'Premium'}
                      </span>
                      <span className="text-white/40 text-[10px] font-light tracking-widest uppercase">
                        Delivery
                      </span>
                    </div>
                  </>
                )}
              </Link>

              {/* Center nav - desktop */}
              <div className="hidden md:flex items-center gap-12">
                <Link
                  to={`/shop/${storeSlug}/products${previewParam}`}
                  className="text-sm text-white/60 hover:text-white font-light tracking-wide transition-colors"
                >
                  Shop
                </Link>
                {!isPreviewMode && (
                  <Link
                    to={`/shop/${storeSlug}/orders`}
                    className="text-sm text-white/60 hover:text-white font-light tracking-wide transition-colors"
                  >
                    Track Order
                  </Link>
                )}
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-4">
                {/* Search */}
                <button
                  onClick={() => navigate(`/shop/${storeSlug}/products${previewParam}`)}
                  className="w-9 h-9 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                  aria-label="Search"
                >
                  <Search className="w-5 h-5" />
                </button>

                {/* Cart */}
                {!isPreviewMode && (
                  <button
                    onClick={onCartClick || (() => navigate(`/shop/${storeSlug}/cart`))}
                    className="relative w-9 h-9 flex items-center justify-center text-white/60 hover:text-white transition-colors group"
                    aria-label="Shopping cart"
                  >
                    <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    {cartItemCount > 0 && (
                      <motion.span
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute -top-1 -right-1 w-5 h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg"
                        style={{ backgroundColor: accentColor }}
                      >
                        {cartItemCount > 9 ? '9+' : cartItemCount}
                      </motion.span>
                    )}
                  </button>
                )}

                {/* Account */}
                {!isPreviewMode && (
                  <Link
                    to={`/shop/${storeSlug}/account`}
                    className="hidden md:flex w-9 h-9 items-center justify-center text-white/60 hover:text-white transition-colors"
                    aria-label="Account"
                  >
                    <User className="w-5 h-5" />
                  </Link>
                )}

                {/* Mobile menu button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden w-9 h-9 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                  aria-label="Menu"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </nav>
      </div>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/95 backdrop-blur-2xl pt-32 px-6 md:hidden"
          >
            <nav className="flex flex-col gap-6">
              <Link
                to={`/shop/${storeSlug}/products${previewParam}`}
                className="text-2xl text-white/80 hover:text-white font-light tracking-wide transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Shop
              </Link>
              {!isPreviewMode && (
                <>
                  <Link
                    to={`/shop/${storeSlug}/cart`}
                    className="text-2xl text-white/80 hover:text-white font-light tracking-wide transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Cart ({cartItemCount})
                  </Link>
                  <Link
                    to={`/shop/${storeSlug}/orders`}
                    className="text-2xl text-white/80 hover:text-white font-light tracking-wide transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Track Order
                  </Link>
                  <Link
                    to={`/shop/${storeSlug}/account`}
                    className="text-2xl text-white/80 hover:text-white font-light tracking-wide transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Account
                  </Link>
                </>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer for fixed nav */}
      <div className="h-[104px]" />
    </>
  );
}
