import { Link, useParams } from 'react-router-dom';
import { useShop } from '@/pages/shop/ShopLayout';
import { Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';

interface LuxuryFooterProps {
  accentColor?: string;
}

export function LuxuryFooter({ accentColor: _accentColor = '#0EC7BA' }: LuxuryFooterProps) {
  const { storeSlug } = useParams();
  const { store, isPreviewMode } = useShop();

  const previewParam = isPreviewMode ? '?preview=true' : '';

  return (
    <footer className="bg-[#015358] text-white pt-20 pb-12 border-t border-[#0EC7BA]/20">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between gap-12 mb-16">

          {/* Brand Column */}
          <div className="md:w-1/3">
            <Link to={`/shop/${storeSlug}${previewParam}`} className="block mb-6">
              {store?.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={store?.store_name}
                  className="h-10 object-contain"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#0EC7BA] flex items-center justify-center text-[#015358] font-bold text-xl rounded-bl-sm">
                    {store?.store_name?.charAt(0) || 'Q'}
                  </div>
                  <span className="text-xl font-bold tracking-tight">
                    {store?.store_name || 'FloraIQ Store'}
                  </span>
                </div>
              )}
            </Link>
            <p className="text-white/70 mb-6 leading-relaxed max-w-sm">
              {store?.tagline || 'The premium choice for cannabis delivery. Licensed, compliant, and dedicated to quality.'}
            </p>
            <div className="flex gap-4">
              {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#0EC7BA] hover:text-[#015358] transition-all">
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          <div className="md:w-2/3 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-bold mb-6 text-[#0EC7BA]">Shop</h4>
              <ul className="space-y-4">
                <li><Link to={`/shop/${storeSlug}/products${previewParam}`} className="text-white/80 hover:text-white hover:underline">All Products</Link></li>
                <li><Link to={`/shop/${storeSlug}/products${previewParam}`} className="text-white/80 hover:text-white hover:underline">Featured</Link></li>
                <li><Link to={`/shop/${storeSlug}/products${previewParam}`} className="text-white/80 hover:text-white hover:underline">New Arrivals</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-6 text-[#0EC7BA]">Support</h4>
              <ul className="space-y-4">
                <li><Link to="#" className="text-white/80 hover:text-white hover:underline">Help Center</Link></li>
                <li><Link to="#" className="text-white/80 hover:text-white hover:underline">Contact Us</Link></li>
                <li><Link to="#" className="text-white/80 hover:text-white hover:underline">Returns</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-6 text-[#0EC7BA]">Legal</h4>
              <ul className="space-y-4">
                <li><Link to="#" className="text-white/80 hover:text-white hover:underline">Privacy Policy</Link></li>
                <li><Link to="#" className="text-white/80 hover:text-white hover:underline">Terms of Service</Link></li>
                <li><Link to="#" className="text-white/80 hover:text-white hover:underline">Licenses</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-6 text-[#0EC7BA]">Account</h4>
              <ul className="space-y-4">
                {!isPreviewMode ? (
                  <>
                    <li><Link to={`/shop/${storeSlug}/account`} className="text-white/80 hover:text-white hover:underline">My Account</Link></li>
                    <li><Link to={`/shop/${storeSlug}/orders`} className="text-white/80 hover:text-white hover:underline">Order History</Link></li>
                    <li><Link to={`/shop/${storeSlug}/cart`} className="text-white/80 hover:text-white hover:underline">Cart</Link></li>
                  </>
                ) : (
                  <li><span className="text-white/50">Admin Preview</span></li>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/50 text-sm">
            © {new Date().getFullYear()} {store?.store_name || 'Store Name'}. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-white/50 text-sm">
            <span>Powered by</span>
            <span className="font-bold text-white">FloraIQ</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
