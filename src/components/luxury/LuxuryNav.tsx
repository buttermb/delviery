import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ShoppingCart, Menu } from 'lucide-react'
import NYMLogo from '../NYMLogo'

export default function LuxuryNav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  
  return (
    <>
      {/* Floating top bar - ultra minimal */}
      <div className="fixed top-0 left-0 right-0 z-50">
        
        {/* Subtle announcement - optional */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 backdrop-blur-xl border-b border-white/5">
          <div className="container mx-auto px-6 py-2">
            <p className="text-center text-xs text-white/60 font-light tracking-wide">
              Licensed NYC Delivery • Same-Day • Lab Verified
            </p>
          </div>
        </div>
        
        {/* Main nav - glass morphism */}
        <nav className={`transition-all duration-500 ${
          scrolled 
            ? 'bg-black/80 backdrop-blur-2xl border-b border-white/10 shadow-2xl' 
            : 'bg-transparent'
        }`}>
          <div className="container mx-auto px-6">
            <div className="flex items-center justify-between h-20">
              
              {/* Logo - ultra minimal */}
              <Link to="/" className="group flex items-center gap-3">
                <div className="relative w-10 h-10">
                  {/* Glowing orb effect */}
                  <div className="absolute inset-0 bg-emerald-500 rounded-full blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
                  <div className="relative w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center">
                    <span className="text-black font-bold text-sm">P</span>
                  </div>
                </div>
                <div className="flex flex-col -space-y-1">
                  <span className="text-white font-light text-sm tracking-wider">Premium</span>
                  <span className="text-white/40 text-[10px] font-light tracking-widest uppercase">Delivery</span>
                </div>
              </Link>
              
              {/* Center nav - minimal */}
              <div className="hidden md:flex items-center gap-12">
                <button 
                  onClick={() => {
                    if (window.location.pathname === '/') {
                      document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })
                    } else {
                      navigate('/#products')
                    }
                  }}
                  className="text-sm text-white/60 hover:text-white font-light tracking-wide transition-colors"
                >
                  Shop
                </button>
                <Link to="/support" className="text-sm text-white/60 hover:text-white font-light tracking-wide transition-colors">
                  Support
                </Link>
                <Link to="/track-order" className="text-sm text-white/60 hover:text-white font-light tracking-wide transition-colors">
                  Track Order
                </Link>
              </div>
              
              {/* Right actions - minimal */}
              <div className="flex items-center gap-6">
                {/* Search - icon only */}
                <button 
                  onClick={() => navigate('/')}
                  className="w-9 h-9 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                  aria-label="Search"
                  title="Search"
                >
                  <Search className="w-5 h-5" />
                </button>
                
                {/* Cart - icon only with badge */}
                <button 
                  onClick={() => navigate('/cart')}
                  className="relative w-9 h-9 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                  aria-label="Shopping cart"
                  title="Shopping cart"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-black text-[10px] font-medium rounded-full flex items-center justify-center">
                    0
                  </span>
                </button>
                
                {/* Mobile menu button */}
                <button 
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden w-9 h-9 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                  aria-label="Menu"
                  title="Menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </div>
              
            </div>
          </div>
        </nav>
      </div>
      
      {/* Spacer */}
      <div className="h-[88px]" />
    </>
  )
}

