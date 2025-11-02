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
        <div className="bg-primary/5 backdrop-blur-xl border-b border-white/5">
          <div className="container mx-auto px-6 py-2">
            <p className="text-center text-xs text-muted-foreground font-light tracking-wide">
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
                  <div className="absolute inset-0 bg-primary/30 rounded-full blur-md opacity-40 group-hover:opacity-60 transition-opacity" />
                  <div className="relative w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-sm">P</span>
                  </div>
                </div>
                <div className="flex flex-col -space-y-1">
                  <span className="text-foreground font-light text-sm tracking-wider">Premium</span>
                  <span className="text-muted-foreground text-[10px] font-light tracking-widest uppercase">Delivery</span>
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
                  className="text-sm text-muted-foreground hover:text-foreground font-light tracking-wide transition-colors"
                >
                  Shop
                </button>
                <Link to="/support" className="text-sm text-muted-foreground hover:text-foreground font-light tracking-wide transition-colors">
                  Support
                </Link>
                <Link to="/track-order" className="text-sm text-muted-foreground hover:text-foreground font-light tracking-wide transition-colors">
                  Track Order
                </Link>
              </div>
              
              {/* Right actions - minimal */}
              <div className="flex items-center gap-6">
                {/* Search - icon only */}
                <button 
                  onClick={() => navigate('/')}
                  className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Search"
                  title="Search"
                >
                  <Search className="w-5 h-5" />
                </button>
                
                {/* Cart - icon only with badge */}
                <button 
                  onClick={() => navigate('/cart')}
                  className="relative w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Shopping cart"
                  title="Shopping cart"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-medium rounded-full flex items-center justify-center">
                    0
                  </span>
                </button>
                
                {/* Mobile menu button */}
                <button 
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
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

