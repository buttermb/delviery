/**
 * Storefront Header Component
 * Navigation header for customer-facing storefront
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingCart,
  Menu,
  X,
  Search,
  User,
  Package,
  Home,
  Grid3X3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface NavLink {
  label: string;
  href: string;
  icon?: typeof Home;
}

interface StorefrontHeaderProps {
  storeSlug: string;
  storeName: string;
  logoUrl?: string | null;
  accentColor?: string | null;
  cartItemCount?: number;
  onCartClick?: () => void;
  onSearch?: (query: string) => void;
  navLinks?: NavLink[];
  showSearch?: boolean;
}

const DEFAULT_NAV_LINKS: NavLink[] = [
  { label: 'Home', href: '', icon: Home },
  { label: 'Menu', href: '/menu', icon: Grid3X3 },
  { label: 'Track Order', href: '/track', icon: Package },
];

export default function StorefrontHeader({
  storeSlug,
  storeName,
  logoUrl,
  accentColor,
  cartItemCount = 0,
  onCartClick,
  onSearch,
  navLinks = DEFAULT_NAV_LINKS,
  showSearch = true,
}: StorefrontHeaderProps) {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  const isActiveLink = (href: string) => {
    const fullPath = `/store/${storeSlug}${href}`;
    return location.pathname === fullPath;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo / Brand */}
          <Link
            to={`/store/${storeSlug}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-10 w-auto object-contain" />
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: accentColor || '#16a34a' }}
              >
                {storeName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-bold text-xl hidden sm:inline">{storeName}</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  to={`/store/${storeSlug}${link.href}`}
                  className={cn(
                    'px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2',
                    isActiveLink(link.href)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Search */}
            {showSearch && onSearch && (
              <form onSubmit={handleSearch} className="relative">
                <Input
                  type="search"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-10"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </form>
            )}

            {/* Cart Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={onCartClick}
              className="relative"
              aria-label="Shopping cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Mobile Menu + Cart */}
          <div className="flex md:hidden items-center gap-2">
            {/* Mobile Cart */}
            <Button
              variant="outline"
              size="icon"
              onClick={onCartClick}
              className="relative"
              aria-label="Shopping cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </Badge>
              )}
            </Button>

            {/* Mobile Menu */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    {logoUrl ? (
                      <img src={logoUrl} alt={storeName} className="h-8 w-auto object-contain" />
                    ) : (
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: accentColor || '#16a34a' }}
                      >
                        {storeName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {storeName}
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-6 space-y-4">
                  {/* Mobile Search */}
                  {showSearch && onSearch && (
                    <form onSubmit={handleSearch} className="relative">
                      <Input
                        type="search"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </form>
                  )}

                  {/* Mobile Navigation Links */}
                  <nav className="flex flex-col gap-2">
                    {navLinks.map((link) => {
                      const Icon = link.icon;
                      return (
                        <Link
                          key={link.href}
                          to={`/store/${storeSlug}${link.href}`}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            'px-4 py-3 rounded-md text-sm font-medium transition-colors flex items-center gap-3',
                            isActiveLink(link.href)
                              ? 'bg-primary text-primary-foreground'
                              : 'text-foreground hover:bg-muted'
                          )}
                        >
                          {Icon && <Icon className="h-5 w-5" />}
                          {link.label}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
