import { Link } from 'react-router-dom';
import { Home, ShoppingBag, User } from 'lucide-react';

export default function GiveawayHeader() {
  return (
    <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex flex-col hover:opacity-80 transition-opacity">
            <span className="font-black text-white text-2xl tracking-tight">NYM</span>
            <span className="text-[10px] text-primary font-semibold tracking-wider uppercase">Premium Delivery</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-6">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>

            <Link
              to="/"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Shop</span>
            </Link>

            <Link
              to="/my-orders"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Account</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
