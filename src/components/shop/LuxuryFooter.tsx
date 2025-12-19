import { Link, useParams } from 'react-router-dom';
import { useShop } from '@/pages/shop/ShopLayout';

interface LuxuryFooterProps {
  accentColor?: string;
}

export function LuxuryFooter({ accentColor = '#10b981' }: LuxuryFooterProps) {
  const { storeSlug } = useParams();
  const { store, isPreviewMode } = useShop();

  const previewParam = isPreviewMode ? '?preview=true' : '';

  return (
    <footer className="bg-black border-t border-white/5">
      {/* Main content */}
      <div className="container mx-auto px-6 py-20">
        <div className="max-w-7xl mx-auto">
          {/* Top section - brand */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 pb-16 border-b border-white/5">
            {/* Logo + tagline */}
            <div className="mb-8 md:mb-0">
              {store?.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={store?.store_name || 'Store'}
                  className="h-12 mb-4 object-contain"
                />
              ) : (
                <h3 className="text-white text-xl font-light tracking-tight mb-4">
                  {store?.store_name || 'Premium Store'}
                </h3>
              )}
              <p className="text-white/40 text-sm font-light max-w-sm leading-relaxed">
                {store?.tagline || 'Premium cannabis delivery service.'}
                <br />
                Licensed. Lab-tested. Fast delivery.
              </p>
            </div>

            {/* Newsletter */}
            <div className="w-full md:w-auto">
              <div className="flex flex-col sm:flex-row gap-3 max-w-md">
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="flex-1 px-4 py-3 bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-full text-white text-sm font-light placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors"
                />
                <button
                  className="px-6 py-3 bg-white text-black text-sm font-light rounded-full hover:bg-white/90 transition-colors whitespace-nowrap"
                >
                  Subscribe
                </button>
              </div>
              <p className="text-white/30 text-xs font-light mt-2 ml-4">
                Exclusive offers and updates
              </p>
            </div>
          </div>

          {/* Links grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
            {/* Shop */}
            <div>
              <h3 className="text-white/40 text-xs font-light tracking-widest uppercase mb-6">Shop</h3>
              <ul className="space-y-4">
                <li>
                  <Link
                    to={`/shop/${storeSlug}/products${previewParam}`}
                    className="text-white/60 hover:text-white text-sm font-light transition-colors"
                  >
                    All Products
                  </Link>
                </li>
                <li>
                  <Link
                    to={`/shop/${storeSlug}${previewParam}`}
                    className="text-white/60 hover:text-white text-sm font-light transition-colors"
                  >
                    Featured
                  </Link>
                </li>
              </ul>
            </div>

            {/* Account */}
            {!isPreviewMode && (
              <div>
                <h3 className="text-white/40 text-xs font-light tracking-widest uppercase mb-6">Account</h3>
                <ul className="space-y-4">
                  <li>
                    <Link
                      to={`/shop/${storeSlug}/account`}
                      className="text-white/60 hover:text-white text-sm font-light transition-colors"
                    >
                      My Account
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={`/shop/${storeSlug}/orders`}
                      className="text-white/60 hover:text-white text-sm font-light transition-colors"
                    >
                      Track Order
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={`/shop/${storeSlug}/cart`}
                      className="text-white/60 hover:text-white text-sm font-light transition-colors"
                    >
                      Cart
                    </Link>
                  </li>
                </ul>
              </div>
            )}

            {/* Support */}
            <div>
              <h3 className="text-white/40 text-xs font-light tracking-widest uppercase mb-6">Support</h3>
              <ul className="space-y-4">
                <li>
                  <span className="text-white/60 text-sm font-light">FAQ</span>
                </li>
                <li>
                  <span className="text-white/60 text-sm font-light">Contact</span>
                </li>
                <li>
                  <span className="text-white/60 text-sm font-light">Returns</span>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-white/40 text-xs font-light tracking-widest uppercase mb-6">Legal</h3>
              <ul className="space-y-4">
                <li>
                  <span className="text-white/60 text-sm font-light">Terms</span>
                </li>
                <li>
                  <span className="text-white/60 text-sm font-light">Privacy</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-12 mb-16 pb-16 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full bg-white/[0.02] border border-white/10 flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" style={{ color: accentColor }}>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-left">
                <div className="text-white text-xs font-light">Licensed</div>
                <div className="text-white/30 text-[10px] font-light">NYS Approved</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.02] border border-white/10 flex items-center justify-center">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" style={{ color: accentColor }}>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-left">
                <div className="text-white text-xs font-light">Lab Tested</div>
                <div className="text-white/30 text-[10px] font-light">All Products</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.02] border border-white/10 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: accentColor }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-left">
                <div className="text-white text-xs font-light">Fast Delivery</div>
                <div className="text-white/30 text-[10px] font-light">Same Day</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.02] border border-white/10 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: accentColor }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="text-left">
                <div className="text-white text-xs font-light">21+ Only</div>
                <div className="text-white/30 text-[10px] font-light">Age Verified</div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white/30 text-xs font-light">
              © {new Date().getFullYear()} {store?.store_name || 'Premium Store'}. All rights reserved.
            </p>
            <p className="text-white/20 text-[10px] font-light tracking-widest uppercase">
              Powered by FloraIQ
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
