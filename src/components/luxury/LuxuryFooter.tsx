import FloraIQLogo from '@/components/FloraIQLogo';

export default function LuxuryFooter() {
  return (
    <footer className="bg-black border-t border-white/5">
      
      {/* Main content */}
      <div className="container mx-auto px-6 py-20">
        <div className="max-w-7xl mx-auto">
          
          {/* Top section - brand */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 pb-16 border-b border-white/5">
            
            {/* Logo + tagline */}
            <div className="mb-8 md:mb-0">
              <div className="mb-4">
                <FloraIQLogo size="xl" className="text-white" />
              </div>
              <p className="text-white/40 text-sm font-light max-w-sm leading-relaxed">
                Smart cannabis operations platform.
                <br />
                Premium products from licensed cultivators. Lab-tested. Fast delivery.
              </p>
            </div>
            
            {/* Newsletter - minimal */}
            <div className="w-full md:w-auto">
              <div className="flex flex-col sm:flex-row gap-3 max-w-md">
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="flex-1 px-4 py-3 bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-full text-white text-sm font-light placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors"
                />
                <button className="px-6 py-3 bg-background text-foreground text-sm font-light rounded-full hover:bg-accent transition-colors whitespace-nowrap">
                  Subscribe
                </button>
              </div>
              <p className="text-white/30 text-xs font-light mt-2 ml-4">
                Exclusive offers and updates
              </p>
            </div>
            
          </div>
          
          {/* Links grid - minimal */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
            
            {/* Shop */}
            <div>
              <h3 className="text-white/40 text-xs font-light tracking-widest uppercase mb-6">Shop</h3>
              <ul className="space-y-4">
                <li><a href="/menu" className="text-white/60 hover:text-white text-sm font-light transition-colors">Menu</a></li>
                <li><a href="/#products" className="text-white/60 hover:text-white text-sm font-light transition-colors">All Products</a></li>
                <li><a href="/support" className="text-white/60 hover:text-white text-sm font-light transition-colors">Support</a></li>
                <li><a href="/track-order" className="text-white/60 hover:text-white text-sm font-light transition-colors">Track Order</a></li>
              </ul>
            </div>
            
            {/* Company */}
            <div>
              <h3 className="text-white/40 text-xs font-light tracking-widest uppercase mb-6">Company</h3>
              <ul className="space-y-4">
                <li><a href="/about" className="text-white/60 hover:text-white text-sm font-light transition-colors">About</a></li>
                <li><a href="/partner-shops" className="text-white/60 hover:text-white text-sm font-light transition-colors">Partners</a></li>
                <li><a href="/become-courier" className="text-white/60 hover:text-white text-sm font-light transition-colors">Careers</a></li>
                <li><a href="/support" className="text-white/60 hover:text-white text-sm font-light transition-colors">Press</a></li>
              </ul>
            </div>
            
            {/* Support */}
            <div>
              <h3 className="text-white/40 text-xs font-light tracking-widest uppercase mb-6">Support</h3>
              <ul className="space-y-4">
                <li><a href="/faq" className="text-white/60 hover:text-white text-sm font-light transition-colors">FAQ</a></li>
                <li><a href="/track-order" className="text-white/60 hover:text-white text-sm font-light transition-colors">Track Order</a></li>
                <li><a href="/terms" className="text-white/60 hover:text-white text-sm font-light transition-colors">Terms</a></li>
                <li><a href="/privacy" className="text-white/60 hover:text-white text-sm font-light transition-colors">Privacy</a></li>
              </ul>
            </div>
            
            {/* Contact */}
            <div>
              <h3 className="text-white/40 text-xs font-light tracking-widest uppercase mb-6">Contact</h3>
              <ul className="space-y-4">
                <li className="text-white/60 text-sm font-light">(555) 123-4567</li>
                <li className="text-white/60 text-sm font-light">support@example.com</li>
                <li className="text-white/60 text-sm font-light">8 AM - 10 PM Daily</li>
              </ul>
            </div>
            
          </div>
          
          {/* Trust badges - ultra minimal */}
          <div className="flex flex-wrap justify-center gap-12 mb-16 pb-16 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.02] border border-white/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
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
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
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
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-left">
                <div className="text-white text-xs font-light">30-Min Delivery</div>
                <div className="text-white/30 text-[10px] font-light">Guaranteed</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.02] border border-white/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              © 2025 FloraIQ. All rights reserved.
            </p>
            <p className="text-white/20 text-[10px] font-light tracking-widest uppercase">
              Smart Cannabis Operations
            </p>
          </div>
          
        </div>
      </div>
      
    </footer>
  )
}

