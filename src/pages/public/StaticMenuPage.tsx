import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ============================================
// TYPES
// ============================================

interface TieredPrice {
  label: string;
  price: number;
  weight_grams?: number;
  max_qty?: number;
  note?: string;
}

interface MenuProduct {
  id: string;
  name: string;
  base_price: number;
  prices: TieredPrice[] | null;
  description: string;
  image_url: string;
  category: string;
  strain_type: string;
  vendor: string;
  is_new: boolean;
  is_on_sale: boolean;
  badge: string | null;
  display_order: number;
  created_at: string;
}

interface MenuData {
  id: string;
  name: string;
  description: string;
  custom_message: string;
  show_product_images: boolean;
  tenant_id: string;
  appearance: AppearanceSettings;
  expiration_date: string | null;
  never_expires: boolean;
}

interface AppearanceSettings {
  colors?: Partial<ColorConfig>;
  show_prices?: boolean;
  show_descriptions?: boolean;
  contact_info?: string;
}

interface ColorConfig {
  bg: string;
  text: string;
  accent: string;
  cardBg: string;
  border: string;
}

interface CartItem {
  product: MenuProduct;
  tier: TieredPrice;
  quantity: number;
  line_total: number;
}

interface CartState {
  items: CartItem[];
  item_count: number;
  subtotal: number;
}

type PaymentMethod = 'cash' | 'venmo' | 'zelle' | 'cashapp';

interface OrderFormData {
  contact_phone: string;
  contact_email: string;
  customer_name: string;
  delivery_address: string;
  customer_notes: string;
  payment_method: PaymentMethod;
}

interface OrderResponse {
  order_id: string;
  status: string;
  total_amount: number;
}

type ViewState = 'menu' | 'cart' | 'order_form' | 'confirmation';
type PageLoadState = 'loading' | 'ready' | 'error' | 'not_found' | 'expired';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_COLORS: ColorConfig = {
  bg: '#F7F6F3',
  text: '#1C1C1E',
  accent: '#2D5016',
  cardBg: '#ffffff',
  border: '#E5E4E0',
};

const HEADING_FONT = '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const BODY_FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'cashapp', label: 'CashApp' },
];

const GLOBAL_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');
@keyframes spin { to { transform: rotate(360deg) } }
@keyframes checkScale { 0% { transform: scale(0) } 50% { transform: scale(1.1) } 100% { transform: scale(1) } }
@keyframes checkCircle { 0% { stroke-dashoffset: 166 } 100% { stroke-dashoffset: 0 } }
@keyframes checkMark { 0% { stroke-dashoffset: 48 } 100% { stroke-dashoffset: 0 } }
@keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
* { box-sizing: border-box; }
body { margin: 0; }
`;

// ============================================
// HELPERS
// ============================================

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function recalculateCart(items: CartItem[]): CartState {
  return {
    items,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.line_total, 0),
  };
}

// ============================================
// SVG ICON COMPONENTS
// ============================================

function IconFlower({ color = 'currentColor', size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L9 9h6l-3-7zM17.5 8c-1.2 0-2.3.4-3.2 1.1C13.4 8.4 12.2 8 11 8c-3.3 0-6 2.7-6 6s2.7 6 6 6c1.2 0 2.3-.4 3.2-1.1.9.7 2 1.1 3.2 1.1 3.3 0 6-2.7 6-6s-2.6-6-5.9-6z" fill={color} />
    </svg>
  );
}

function IconCart({ color = 'currentColor', size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM7.2 14.8v-.1l.9-1.7h7.4c.7 0 1.4-.4 1.7-1l3.9-7-1.7-1-3.9 7h-7L4.3 2H1v2h2l3.6 7.6-1.4 2.5c-.2.4-.2.8-.2 1.2 0 1.1.9 2 2 2h12v-2H7.4c-.1 0-.2-.1-.2-.2z" fill={color} />
    </svg>
  );
}

function IconFAQ({ color = 'currentColor', size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12zM11 5h2v6h-2zm0 8h2v2h-2z" fill={color} />
    </svg>
  );
}

function IconConcentrate({ color = 'currentColor', size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2a10 10 0 00-6.88 17.23l.9-1.79A8 8 0 1120 12a8 8 0 01-2.02 5.44l.9 1.79A10 10 0 0012 2zm0 6a4 4 0 100 8 4 4 0 000-8z" fill={color} />
    </svg>
  );
}

function IconEdible({ color = 'currentColor', size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M11 9h2V6h3V4h-3V1h-2v3H8v2h3v3zm-4 9c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-9.8-3.2v-.1l.9-1.7h7.4c.7 0 1.4-.4 1.7-1l3.9-7-1.7-1-3.9 7h-7L4.3 2H1v2h2l3.6 7.6L5.2 14c-.1.3-.2.6-.2 1 0 1.1.9 2 2 2h12v-2H7.4c-.1 0-.2-.1-.2-.2z" fill={color} />
    </svg>
  );
}

function IconPackage({ color = 'currentColor', size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H4V8h16v11zM4 6V5h16v1H4z" fill={color} />
    </svg>
  );
}

function IconClose({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconArrowLeft({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="#D33131" />
    </svg>
  );
}

function IconAlert({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#D33131" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconClock({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#B8860B" strokeWidth="2" />
      <path d="M12 7v5l3 3" stroke="#B8860B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaymentIcon({ method }: { method: PaymentMethod }) {
  const iconStyle = { stroke: 'currentColor', strokeWidth: 1.5 };
  if (method === 'cash') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2" {...iconStyle} />
      <path d="M6 15h3M2 10h20" {...iconStyle} strokeLinecap="round" />
    </svg>
  );
  if (method === 'venmo') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" {...iconStyle} />
      <path d="M8.5 14.5l2-2.5 2 2 3-3.5" {...iconStyle} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (method === 'zelle') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2v20M2 12h20" {...iconStyle} strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" {...iconStyle} />
    </svg>
  );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M17 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2z" {...iconStyle} />
      <path d="M12 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ============================================
// DATA FETCHING
// ============================================

async function loadMenuDirect(token: string): Promise<{ menu: MenuData; products: MenuProduct[] } | null> {
  try {
    const { data: menu, error: menuError } = await supabase
      .from('disposable_menus')
      .select('id, name, description, custom_message, show_product_images, appearance_settings, tenant_id, expiration_date, never_expires')
      .eq('encrypted_url_token', token)
      .eq('status', 'active')
      .maybeSingle();

    if (menuError || !menu) return null;

    if (!menu.never_expires && menu.expiration_date) {
      if (new Date(menu.expiration_date) < new Date()) {
        return { menu: { ...transformMenu(menu), expiration_date: menu.expiration_date, never_expires: false }, products: [] };
      }
    }

    const { data: menuProducts, error: productsError } = await supabase
      .from('disposable_menu_products')
      .select(`
        product_id,
        custom_price,
        prices,
        display_order,
        display_availability,
        wholesale_inventory!product_id (
          product_name,
          base_price,
          description,
          image_url,
          category,
          strain_type,
          created_at
        )
      `)
      .eq('menu_id', menu.id)
      .eq('display_availability', true)
      .order('display_order', { ascending: true });

    if (productsError) {
      logger.error('Failed to load menu products', { error: productsError.message });
      return null;
    }

    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const products: MenuProduct[] = (menuProducts ?? []).map((mp: Record<string, unknown>) => {
      const inv = (mp as Record<string, unknown>).wholesale_inventory as {
        product_name: string;
        base_price: number;
        description: string;
        image_url: string;
        category: string;
        strain_type: string;
        created_at: string;
      } | null;

      if (!inv) return null;

      const basePrice = mp.custom_price != null ? Number(mp.custom_price) : Number(inv.base_price ?? 0);
      const createdAt = new Date(inv.created_at);
      const isNew = createdAt > twoWeeksAgo;
      const isOnSale = mp.custom_price != null && Number(mp.custom_price) < Number(inv.base_price);

      let vendor = '';
      if (inv.description) {
        const vendorMatch = inv.description.match(/^By\s+(.+?)(?:\n|$)/i);
        if (vendorMatch) vendor = vendorMatch[1].trim();
      }

      let tieredPrices: TieredPrice[] | null = null;
      const prices = mp.prices;
      if (prices && Array.isArray(prices) && prices.length > 0) {
        tieredPrices = prices as TieredPrice[];
      }

      return {
        id: mp.product_id as string,
        name: inv.product_name,
        base_price: basePrice,
        prices: tieredPrices,
        description: inv.description ?? '',
        image_url: inv.image_url ?? '',
        category: inv.category ?? 'Uncategorized',
        strain_type: inv.strain_type ?? '',
        vendor,
        is_new: isNew,
        is_on_sale: isOnSale,
        badge: null,
        display_order: (mp.display_order as number) ?? 0,
        created_at: inv.created_at,
      };
    }).filter(Boolean) as MenuProduct[];

    return { menu: transformMenu(menu), products };
  } catch (err: unknown) {
    logger.error('Failed to load menu directly', { token, error: String(err) });
    return null;
  }
}

function transformMenu(menu: Record<string, unknown>): MenuData {
  const appearance = (menu.appearance_settings ?? {}) as AppearanceSettings;
  return {
    id: menu.id as string,
    name: (menu.name as string) ?? 'Menu',
    description: typeof menu.description === 'string' ? menu.description : '',
    custom_message: (menu.custom_message as string) ?? '',
    show_product_images: menu.show_product_images !== false,
    tenant_id: menu.tenant_id as string,
    appearance,
    expiration_date: (menu.expiration_date as string) ?? null,
    never_expires: (menu.never_expires as boolean) ?? false,
  };
}

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  const shimmerBg = 'linear-gradient(90deg, #E8E8E4 0%, #F0F0EC 50%, #E8E8E4 100%)';
  const shimmerStyle = { backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' };
  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F3', fontFamily: BODY_FONT }}>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Header skeleton */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 24px 24px' }}>
          <div style={{ width: 100, height: 14, background: shimmerBg, borderRadius: 7, marginBottom: 12, ...shimmerStyle }} />
          <div style={{ width: 180, height: 28, background: shimmerBg, borderRadius: 8, marginBottom: 10, ...shimmerStyle }} />
          <div style={{ width: 240, height: 12, background: shimmerBg, borderRadius: 6, marginBottom: 6, ...shimmerStyle }} />
          <div style={{ width: 110, height: 24, background: shimmerBg, borderRadius: 12, marginTop: 8, ...shimmerStyle }} />
        </div>
        <div style={{ height: 1, background: '#E5E4E0' }} />
        {/* Card skeletons */}
        {[0, 1].map(i => (
          <div key={i} style={{ background: '#fff', borderRadius: 14, margin: '16px 16px 0', overflow: 'hidden', border: '1px solid #EEEEE9' }}>
            <div style={{ width: '100%', height: 200, background: shimmerBg, ...shimmerStyle }} />
            <div style={{ padding: '14px 16px' }}>
              <div style={{ width: i === 0 ? 140 : 110, height: 18, background: shimmerBg, borderRadius: 6, marginBottom: 8, ...shimmerStyle }} />
              <div style={{ width: i === 0 ? 100 : 80, height: 12, background: '#EEEEE9', borderRadius: 6, marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {[64, 56, 68, 58].slice(0, i === 0 ? 4 : 3).map((w, j) => (
                  <div key={j} style={{ width: w, height: 30, background: '#EEEEE9', borderRadius: 15 }} />
                ))}
              </div>
              <div style={{ width: '100%', height: 44, background: '#E5E4E0', borderRadius: 10, marginTop: 14 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function StaticMenuPage() {
  const { token } = useParams<{ token: string }>();

  const [loadState, setLoadState] = useState<PageLoadState>('loading');
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [products, setProducts] = useState<MenuProduct[]>([]);

  const [view, setView] = useState<ViewState>('menu');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('');
  const [menuExpanded, setMenuExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartState>({ items: [], item_count: 0, subtotal: 0 });

  const [orderForm, setOrderForm] = useState<OrderFormData>({
    contact_phone: '',
    contact_email: '',
    customer_name: '',
    delivery_address: '',
    customer_notes: '',
    payment_method: 'cash',
  });
  const [orderResponse, setOrderResponse] = useState<OrderResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const categorySectionsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const groupedProducts = useMemo(() => {
    const groups: Record<string, MenuProduct[]> = {};
    for (const product of products) {
      const cat = product.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(product);
    }
    return groups;
  }, [products]);

  const categories = useMemo(() => Object.keys(groupedProducts), [groupedProducts]);
  const colors: ColorConfig = useMemo(() => ({
    ...DEFAULT_COLORS,
    ...(menu?.appearance?.colors ?? {}),
  }), [menu]);
  const showImages = menu?.show_product_images !== false;
  const showPrices = menu?.appearance?.show_prices !== false;
  const showDescriptions = menu?.appearance?.show_descriptions !== false;

  // ============================================
  // DATA FETCH + REALTIME SYNC
  // ============================================

  const fetchMenu = useCallback(async (tkn: string, silent = false) => {
    try {
      const result = await loadMenuDirect(tkn);
      if (!result) { if (!silent) setLoadState('not_found'); return; }
      if (!result.menu.never_expires && result.menu.expiration_date) {
        if (new Date(result.menu.expiration_date) < new Date()) {
          setMenu(result.menu);
          if (!silent) setLoadState('expired');
          return;
        }
      }
      setMenu(result.menu);
      setProducts(result.products);
      if (!silent) setLoadState('ready');
    } catch {
      if (!silent) setLoadState('error');
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!token) { setLoadState('not_found'); return; }
    fetchMenu(token);
  }, [token, fetchMenu]);

  // Realtime: re-fetch when admin updates menu products, menu settings, or product data
  useEffect(() => {
    if (!menu?.id || !token) return;

    const channel = supabase
      .channel(`public-menu-${menu.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'disposable_menu_products',
        filter: `menu_id=eq.${menu.id}`,
      }, () => { fetchMenu(token, true); })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'disposable_menus',
        filter: `id=eq.${menu.id}`,
      }, () => { fetchMenu(token, true); })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'products',
      }, () => { fetchMenu(token, true); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [menu?.id, token, fetchMenu]);

  // Re-fetch when user returns to the tab (covers cases where realtime missed updates)
  useEffect(() => {
    if (!token || loadState !== 'ready') return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchMenu(token, true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [token, loadState, fetchMenu]);

  // ============================================
  // SCROLL TRACKING
  // ============================================

  useEffect(() => {
    if (loadState !== 'ready' || categories.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cat = entry.target.getAttribute('data-category');
            if (cat) setActiveCategory(cat);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );
    for (const [, el] of categorySectionsRef.current) observer.observe(el);
    if (!activeCategory && categories.length > 0) setActiveCategory(categories[0]);
    return () => observer.disconnect();
  }, [loadState, categories, activeCategory]);

  // ============================================
  // CART OPERATIONS
  // ============================================

  const addToCart = useCallback((product: MenuProduct, tier: TieredPrice, quantity = 1) => {
    setCart(prev => {
      const existingIndex = prev.items.findIndex(
        item => item.product.id === product.id && item.tier.label === tier.label
      );
      let newItems: CartItem[];
      if (existingIndex >= 0) {
        newItems = prev.items.map((item, i) => {
          if (i !== existingIndex) return item;
          const maxQty = tier.max_qty ?? 99;
          const newQty = Math.min(item.quantity + quantity, maxQty);
          return { ...item, quantity: newQty, line_total: tier.price * newQty };
        });
      } else {
        const maxQty = tier.max_qty ?? 99;
        const clampedQty = Math.min(quantity, maxQty);
        newItems = [...prev.items, { product, tier, quantity: clampedQty, line_total: tier.price * clampedQty }];
      }
      return recalculateCart(newItems);
    });
    if ('vibrate' in navigator) navigator.vibrate(10);
  }, []);

  const removeFromCart = useCallback((productId: string, tierLabel: string) => {
    setCart(prev => {
      const newItems = prev.items.filter(item => !(item.product.id === productId && item.tier.label === tierLabel));
      return recalculateCart(newItems);
    });
  }, []);

  const updateCartQuantity = useCallback((productId: string, tierLabel: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(prev => {
        const newItems = prev.items.filter(item => !(item.product.id === productId && item.tier.label === tierLabel));
        return recalculateCart(newItems);
      });
      return;
    }
    setCart(prev => {
      const newItems = prev.items.map(item => {
        if (item.product.id !== productId || item.tier.label !== tierLabel) return item;
        const maxQty = item.tier.max_qty ?? 99;
        const clamped = Math.min(newQuantity, maxQty);
        return { ...item, quantity: clamped, line_total: item.tier.price * clamped };
      });
      return recalculateCart(newItems);
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart({ items: [], item_count: 0, subtotal: 0 });
  }, []);

  // ============================================
  // ORDER SUBMISSION
  // ============================================

  const placeOrder = useCallback(async () => {
    if (cart.items.length === 0 || !menu) return;
    const phoneDigits = orderForm.contact_phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setPhoneError('Please enter a valid 10-digit phone number');
      return;
    }
    setPhoneError('');
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await supabase.functions.invoke('menu-order-place', {
        body: {
          menu_id: menu.id,
          order_items: cart.items.map(item => ({
            product_id: item.product.id,
            product_name: item.product.name,
            tier_label: item.tier.label,
            tier_price: item.tier.price,
            quantity: item.quantity,
            line_total: item.line_total,
          })),
          total_amount: cart.subtotal,
          payment_method: orderForm.payment_method,
          contact_phone: phoneDigits,
          contact_email: orderForm.contact_email || undefined,
          customer_name: orderForm.customer_name || undefined,
          customer_notes: orderForm.customer_notes || undefined,
          delivery_address: orderForm.delivery_address || undefined,
        },
      });
      if (response.error) throw new Error(response.error.message || 'Order failed');
      setOrderResponse({
        order_id: response.data?.order_id || 'PENDING',
        status: 'confirmed',
        total_amount: cart.subtotal,
      });
      setView('confirmation');
      clearCart();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [cart, menu, orderForm, clearCart]);

  const scrollToCategory = useCallback((category: string) => {
    const el = categorySectionsRef.current.get(category);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveCategory(category);
    }
  }, []);

  // Body scroll lock
  useEffect(() => {
    if (lightboxImage || view === 'cart' || view === 'order_form') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [lightboxImage, view]);

  // ============================================
  // RENDER: LOADING
  // ============================================

  if (loadState === 'loading') return <LoadingSkeleton />;

  // ============================================
  // RENDER: NOT FOUND
  // ============================================

  if (loadState === 'not_found') {
    return (
      <div style={{ minHeight: '100vh', background: '#F7F6F3', fontFamily: BODY_FONT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{GLOBAL_STYLES}</style>
        <div style={{ textAlign: 'center', padding: '0 32px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <IconAlert />
          </div>
          <h1 style={{ fontFamily: HEADING_FONT, fontSize: 20, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>Menu Not Found</h1>
          <p style={{ color: '#8E8E93', fontSize: 14, maxWidth: 280, margin: '0 auto', lineHeight: '20px' }}>
            This menu doesn't exist or the link may be incorrect. Double-check the URL.
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: EXPIRED
  // ============================================

  if (loadState === 'expired') {
    return (
      <div style={{ minHeight: '100vh', background: '#F7F6F3', fontFamily: BODY_FONT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{GLOBAL_STYLES}</style>
        <div style={{ textAlign: 'center', padding: '0 32px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FFF8E6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <IconClock />
          </div>
          <h1 style={{ fontFamily: HEADING_FONT, fontSize: 20, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>Menu Expired</h1>
          <p style={{ color: '#8E8E93', fontSize: 14, maxWidth: 280, margin: '0 auto', lineHeight: '20px' }}>
            This menu is no longer available.
            {menu?.expiration_date && <><br />It expired on <strong style={{ color: '#1C1C1E' }}>{new Date(menu.expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></>}
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: ERROR
  // ============================================

  if (loadState === 'error' || !menu) {
    return (
      <div style={{ minHeight: '100vh', background: '#F7F6F3', fontFamily: BODY_FONT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{GLOBAL_STYLES}</style>
        <div style={{ textAlign: 'center', padding: '0 32px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <IconAlert />
          </div>
          <h1 style={{ fontFamily: HEADING_FONT, fontSize: 20, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>Something Went Wrong</h1>
          <p style={{ color: '#8E8E93', fontSize: 14, marginBottom: 20 }}>Couldn't load the menu. Please try again.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '12px 28px', background: '#1C1C1E', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: BODY_FONT }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: ORDER CONFIRMATION
  // ============================================

  if (view === 'confirmation' && orderResponse) {
    return (
      <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: BODY_FONT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
        <style>{GLOBAL_STYLES}</style>

        {/* Success icon */}
        <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#EDF3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="40" height="40" viewBox="0 0 52 52" style={{ animation: 'checkScale 0.5s ease' }}>
            <circle cx="26" cy="26" r="25" fill="none" stroke="#2D5016" strokeWidth="2" strokeDasharray="166" style={{ animation: 'checkCircle 0.6s ease-in-out forwards' }} />
            <path fill="none" stroke="#2D5016" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M14.1 27.2l7.1 7.2 16.7-16.8" strokeDasharray="48" style={{ animation: 'checkMark 0.3s 0.6s ease-in-out forwards', strokeDashoffset: 48 }} />
          </svg>
        </div>

        <h1 style={{ fontFamily: HEADING_FONT, fontSize: 28, fontWeight: 700, color: colors.accent, letterSpacing: '-0.02em', marginBottom: 10 }}>Order Placed</h1>
        <p style={{ fontSize: 15, color: '#8E8E93', marginBottom: 28, maxWidth: 280, lineHeight: '22px' }}>
          We'll reach out within 30 minutes to confirm your order and arrange delivery.
        </p>

        {/* Order reference */}
        {orderResponse.order_id !== 'PENDING' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 24px', background: '#F7F6F3', borderRadius: 10, marginBottom: 24 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Order Reference</span>
            <span style={{ fontFamily: HEADING_FONT, fontSize: 18, fontWeight: 600, color: '#1C1C1E', marginTop: 2, letterSpacing: '0.04em' }}>
              ORD-{orderResponse.order_id.slice(0, 4).toUpperCase()}
            </span>
          </div>
        )}

        {/* Total */}
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', marginBottom: 32 }}>
          Total: {formatCurrency(orderResponse.total_amount)}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
          <button
            onClick={() => { setView('menu'); setOrderResponse(null); setOrderForm({ contact_phone: '', contact_email: '', customer_name: '', delivery_address: '', customer_notes: '', payment_method: 'cash' }); }}
            style={{ padding: 15, background: colors.accent, color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: BODY_FONT }}
          >
            Browse More
          </button>
          <button
            onClick={() => { setView('menu'); setOrderResponse(null); }}
            style={{ padding: 15, background: '#F7F6F3', color: '#48484A', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: BODY_FONT }}
          >
            Order Again
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: ORDER FORM
  // ============================================

  if (view === 'order_form') {
    return (
      <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: BODY_FONT }}>
        <style>{GLOBAL_STYLES}</style>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '56px 24px 32px' }}>
          {/* Back */}
          <button onClick={() => setView('cart')} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8E8E93', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginBottom: 20, padding: '8px 0', background: 'none', border: 'none', fontFamily: BODY_FONT }}>
            <IconArrowLeft /> Back to cart
          </button>

          <h1 style={{ fontFamily: HEADING_FONT, fontSize: 26, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.02em', marginBottom: 16 }}>Place Your Order</h1>

          {/* Order summary */}
          <div style={{ background: '#F7F6F3', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
            {cart.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#48484A', padding: '3px 0' }}>
                <span>{item.product.name} — {item.tier.label} x{item.quantity}</span>
                <span style={{ fontWeight: 600, color: '#1C1C1E' }}>{formatCurrency(item.line_total)}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #E5E4E0', paddingTop: 8, marginTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
              <span>Total</span>
              <span>{formatCurrency(cart.subtotal)}</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#D33131', fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Phone */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, fontWeight: 600, color: '#1C1C1E', marginBottom: 6, marginTop: 20 }}>
            Phone number <span style={{ color: '#D33131' }}>*</span>
          </label>
          <input
            type="tel"
            value={orderForm.contact_phone}
            onChange={e => { setOrderForm(prev => ({ ...prev, contact_phone: formatPhone(e.target.value) })); setPhoneError(''); }}
            placeholder="(555) 123-4567"
            style={{ width: '100%', padding: '13px 14px', border: `1.5px solid ${phoneError ? '#D33131' : '#E5E4E0'}`, borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box', WebkitAppearance: 'none' as never, fontFamily: BODY_FONT, transition: 'border-color 0.2s' }}
            onFocus={e => { if (!phoneError) e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accent}14`; }}
            onBlur={e => { if (!phoneError) e.currentTarget.style.borderColor = '#E5E4E0'; e.currentTarget.style.boxShadow = 'none'; }}
          />
          {phoneError && <div style={{ color: '#D33131', fontSize: 12, marginTop: 4 }}>{phoneError}</div>}

          {/* Name */}
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1C1C1E', marginBottom: 6, marginTop: 14 }}>Name</label>
          <input
            type="text"
            value={orderForm.customer_name}
            onChange={e => setOrderForm(prev => ({ ...prev, customer_name: e.target.value }))}
            placeholder="Your name (optional)"
            style={{ width: '100%', padding: '13px 14px', border: '1.5px solid #E5E4E0', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: BODY_FONT }}
          />

          {/* Delivery address */}
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1C1C1E', marginBottom: 6, marginTop: 14 }}>Delivery address</label>
          <textarea
            value={orderForm.delivery_address}
            onChange={e => setOrderForm(prev => ({ ...prev, delivery_address: e.target.value }))}
            placeholder="Street address (optional)"
            style={{ width: '100%', padding: '13px 14px', border: '1.5px solid #E5E4E0', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box', minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
          />

          {/* Payment method */}
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1C1C1E', marginBottom: 10, marginTop: 20 }}>Payment method</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PAYMENT_METHODS.map(pm => {
              const isActive = orderForm.payment_method === pm.value;
              return (
                <button
                  key={pm.value}
                  onClick={() => setOrderForm(prev => ({ ...prev, payment_method: pm.value }))}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                    padding: '14px 0', width: 80,
                    border: `2px solid ${isActive ? colors.accent : '#E5E4E0'}`,
                    borderRadius: 12, cursor: 'pointer',
                    background: isActive ? '#EDF3E8' : 'white',
                    color: isActive ? colors.accent : '#48484A',
                    transition: 'all 0.2s',
                    fontFamily: BODY_FONT,
                  }}
                >
                  <PaymentIcon method={pm.value} />
                  <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 500 }}>{pm.label}</span>
                </button>
              );
            })}
          </div>

          {/* Disclaimer + submit */}
          <p style={{ fontSize: 11, color: '#8E8E93', lineHeight: '16px', margin: '24px 0 14px', textAlign: 'center' }}>
            By placing this order you agree to be contacted at the phone number provided. Minimum order may apply.
          </p>
          <button
            onClick={placeOrder}
            disabled={isSubmitting || cart.items.length === 0}
            style={{
              width: '100%', padding: 16, background: isSubmitting ? `${colors.accent}99` : colors.accent, color: 'white',
              border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: BODY_FONT,
            }}
          >
            {isSubmitting && <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
            {isSubmitting ? 'Placing Order...' : `Submit Order \u2014 ${formatCurrency(cart.subtotal)}`}
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: MAIN MENU VIEW (+ CART DRAWER OVERLAY)
  // ============================================

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, color: colors.text, fontFamily: BODY_FONT, WebkitFontSmoothing: 'antialiased' }}>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: `calc(70px + env(safe-area-inset-bottom, 0px))` }}>

        {/* ===== MENU HEADER ===== */}
        <div style={{ padding: '32px 24px 24px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: HEADING_FONT, fontSize: 32, fontWeight: 700, color: colors.text, margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: '36px' }}>
            {menu.name}
          </h1>
          {menu.description && (
            <p style={{ fontFamily: BODY_FONT, fontSize: 14, color: '#8E8E93', margin: '8px auto 0', maxWidth: 400, lineHeight: '20px' }}>{menu.description}</p>
          )}
          <span style={{ display: 'inline-block', fontFamily: BODY_FONT, fontSize: 12, fontWeight: 500, color: colors.accent, background: '#EDF3E8', padding: '4px 12px', borderRadius: 20, marginTop: 12 }}>
            {products.length} {products.length === 1 ? 'item' : 'items'} available
          </span>
        </div>

        {/* Collapsible toggle */}
        <button
          onClick={() => setMenuExpanded(prev => !prev)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '12px 24px',
            borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}`,
            background: 'none', border: 'none',
            borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: colors.border,
            borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: colors.border,
            cursor: 'pointer', fontFamily: BODY_FONT,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: '#48484A' }}>Full Menu</span>
          <span style={{ fontSize: 13, color: '#48484A' }}>&mdash;</span>
          <span style={{ fontSize: 13, color: '#8E8E93' }}>tap to {menuExpanded ? 'collapse' : 'expand'}</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: menuExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M1 1L5 5L9 1" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Custom message */}
        {menu.custom_message && (
          <div style={{ margin: '16px 16px 0', padding: '12px 16px', background: `${colors.accent}10`, borderLeft: `3px solid ${colors.accent}`, borderRadius: '0 8px 8px 0', fontSize: 14, color: colors.text }}>
            {menu.custom_message}
          </div>
        )}

        {/* ===== PRODUCT LIST ===== */}
        {menuExpanded && products.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 32px', color: '#8E8E93' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F7F6F3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <IconCart color="#C7C7CC" size={28} />
            </div>
            <div style={{ fontFamily: HEADING_FONT, fontSize: 18, fontWeight: 700, color: '#1C1C1E' }}>This menu is empty</div>
            <p style={{ fontSize: 14, marginTop: 6 }}>Check back later for available items.</p>
          </div>
        )}

        {menuExpanded && categories.map((category) => (
          <div
            key={category}
            data-category={category}
            ref={el => { if (el) categorySectionsRef.current.set(category, el); }}
          >
            {/* Category header */}
            {categories.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 24px 12px' }}>
                <span style={{ fontFamily: HEADING_FONT, fontSize: 13, fontWeight: 700, color: '#1C1C1E', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                  {category}
                </span>
                <div style={{ flex: 1, height: 1, background: colors.border }} />
                <span style={{ fontFamily: BODY_FONT, fontSize: 11, fontWeight: 500, color: '#8E8E93', whiteSpace: 'nowrap' }}>
                  {groupedProducts[category].length} {groupedProducts[category].length === 1 ? 'strain' : 'strains'}
                </span>
              </div>
            )}

            {/* Product cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px' }}>
              {groupedProducts[category].map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  colors={colors}
                  showImages={showImages}
                  showPrices={showPrices}
                  showDescriptions={showDescriptions}
                  cart={cart}
                  onAddToCart={addToCart}
                  onImageClick={setLightboxImage}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Contact info */}
        {menu.appearance?.contact_info && (
          <div style={{ margin: '24px 16px 0', padding: 16, background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 14, textAlign: 'center', fontSize: 14, fontWeight: 500, color: colors.text }}>
            {menu.appearance.contact_info}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 32, padding: '24px 16px 0', borderTop: `1px solid ${colors.border}`, color: '#C7C7CC', fontSize: 12 }}>
          Powered by FloraIQ
        </div>
      </div>

      {/* ===== CATEGORY NAV BAR ===== */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'white', borderTop: `1px solid ${colors.border}`,
        display: 'flex', justifyContent: 'space-around',
        padding: '8px 0',
        paddingBottom: `calc(8px + env(safe-area-inset-bottom, 0px))`,
        zIndex: 1000,
      }}>
        {categories.slice(0, 4).map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => scrollToCategory(cat)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                cursor: 'pointer', fontSize: 10,
                color: isActive ? colors.accent : '#8E8E93',
                fontWeight: isActive ? 600 : 500,
                padding: '4px 12px', minWidth: 60,
                background: 'none', border: 'none',
                transition: 'color 0.2s',
                fontFamily: BODY_FONT,
              }}
            >
              {getCategoryIconSVG(cat, isActive ? colors.accent : '#8E8E93')}
              <span style={{ maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
            </button>
          );
        })}

        {/* Cart tab */}
        <button
          onClick={() => setView('cart')}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            cursor: 'pointer', fontSize: 10,
            color: view === 'cart' ? colors.accent : '#1C1C1E',
            fontWeight: view === 'cart' ? 600 : 500,
            padding: '4px 12px', minWidth: 60,
            background: 'none', border: 'none',
            position: 'relative',
            fontFamily: BODY_FONT,
          }}
        >
          <div style={{ position: 'relative' }}>
            <IconCart color={view === 'cart' ? colors.accent : '#1C1C1E'} />
            {cart.item_count > 0 && (
              <span style={{
                position: 'absolute', top: -5, right: -8,
                background: '#D33131', color: 'white',
                fontSize: 9, minWidth: 16, height: 16, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
              }}>
                {cart.item_count}
              </span>
            )}
          </div>
          <span>Cart</span>
        </button>
      </div>

      {/* ===== CART DRAWER ===== */}
      {view === 'cart' && (
        <>
          <div onClick={() => setView('menu')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1500 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            maxHeight: '80vh', background: 'white',
            borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 30px rgba(0,0,0,0.15)',
            zIndex: 1501, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
              <div style={{ width: 36, height: 4, background: '#D1D5DB', borderRadius: 2 }} />
            </div>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: HEADING_FONT, fontSize: 20, fontWeight: 700 }}>Your Cart</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#8E8E93' }}>{cart.item_count} {cart.item_count === 1 ? 'item' : 'items'}</span>
              </div>
              <button onClick={() => setView('menu')} style={{ width: 32, height: 32, borderRadius: '50%', background: '#F3F4F6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#48484A' }}>
                <IconClose size={14} />
              </button>
            </div>

            {/* Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
              {cart.items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#8E8E93' }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F7F6F3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <IconCart color="#C7C7CC" size={28} />
                  </div>
                  <div style={{ fontFamily: HEADING_FONT, fontSize: 18, fontWeight: 700, color: '#1C1C1E' }}>Cart is Empty</div>
                  <p style={{ fontSize: 14, marginTop: 8 }}>Browse the menu and add<br />items to get started.</p>
                </div>
              ) : (
                cart.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: '1px solid #F0F0F0' }}>
                    {/* Thumbnail */}
                    {item.product.image_url ? (
                      <img src={item.product.image_url} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 52, height: 52, borderRadius: 10, background: `linear-gradient(135deg, ${colors.accent}88, ${colors.accent})`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18 }}>
                        {item.product.name.charAt(0)}
                      </div>
                    )}
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product.name}</div>
                      <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>{item.tier.label} &mdash; {formatCurrency(item.tier.price)}</div>
                      {/* Qty controls */}
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E4E0', borderRadius: 8, overflow: 'hidden' }}>
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.tier.label, item.quantity - 1)}
                            style={{ width: 30, height: 28, background: '#F9FAFB', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#48484A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >&minus;</button>
                          <div style={{ width: 32, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #E5E4E0', borderRight: '1px solid #E5E4E0', fontSize: 13, fontWeight: 600 }}>
                            {item.quantity}
                          </div>
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.tier.label, item.quantity + 1)}
                            style={{ width: 30, height: 28, background: '#F9FAFB', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#48484A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >+</button>
                        </div>
                      </div>
                    </div>
                    {/* Price + delete */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{formatCurrency(item.line_total)}</span>
                      <button onClick={() => removeFromCart(item.product.id, item.tier.label)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {cart.items.length > 0 && (
              <div style={{ padding: '16px 20px 32px', borderTop: '1px solid #E5E4E0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#8E8E93' }}>Subtotal ({cart.item_count} {cart.item_count === 1 ? 'item' : 'items'})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontFamily: HEADING_FONT, fontSize: 22, fontWeight: 700 }}>{formatCurrency(cart.subtotal)}</span>
                </div>
                <button
                  onClick={() => setView('order_form')}
                  style={{
                    width: '100%', padding: 16, background: colors.accent, color: 'white',
                    border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontFamily: BODY_FONT,
                  }}
                >
                  Place Order <IconArrowRight />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== IMAGE LIGHTBOX ===== */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.95)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 40, height: 40, background: 'rgba(255,255,255,0.12)',
              borderRadius: '50%', border: 'none', color: 'white',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2001,
            }}
          >
            <IconClose />
          </button>
          <img
            src={lightboxImage}
            alt=""
            style={{ maxWidth: '95%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 12 }}
            onClick={e => e.stopPropagation()}
          />
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M19 12l-7 7-7-7" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span style={{ fontFamily: BODY_FONT, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Tap anywhere to close</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// PRODUCT CARD COMPONENT
// ============================================

function ProductCard({
  product, colors, showImages, showPrices, showDescriptions, cart, onAddToCart, onImageClick,
}: {
  product: MenuProduct;
  colors: ColorConfig;
  showImages: boolean;
  showPrices: boolean;
  showDescriptions: boolean;
  cart: CartState;
  onAddToCart: (product: MenuProduct, tier: TieredPrice, qty?: number) => void;
  onImageClick: (url: string) => void;
}) {
  const [selectedTier, setSelectedTier] = useState<TieredPrice | null>(
    product.prices && product.prices.length > 0 ? product.prices[0] : null
  );

  const hasTiers = product.prices && product.prices.length > 0;
  const cartItem = cart.items.find(
    item => item.product.id === product.id && item.tier.label === (selectedTier?.label ?? 'unit')
  );

  const handleAdd = () => {
    const tier: TieredPrice = selectedTier ?? { label: 'unit', price: product.base_price };
    onAddToCart(product, tier);
  };

  return (
    <div style={{
      background: colors.cardBg, borderRadius: 14, overflow: 'hidden',
      border: `1px solid #EEEEE9`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {/* Image */}
      {showImages && product.image_url && (
        <div
          onClick={() => onImageClick(product.image_url)}
          style={{ position: 'relative', width: '100%', aspectRatio: '16/10', overflow: 'hidden', background: '#f3f4f6', cursor: 'pointer' }}
        >
          <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      {/* No image placeholder */}
      {showImages && !product.image_url && (
        <div style={{
          width: '100%', aspectRatio: '16/10',
          background: `linear-gradient(135deg, ${colors.accent}cc 0%, ${colors.accent} 40%, ${colors.accent}aa 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, fontWeight: 800, color: 'rgba(255,255,255,0.6)',
          fontFamily: HEADING_FONT,
        }}>
          {product.name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Info */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontFamily: HEADING_FONT, fontSize: 18, fontWeight: 700, color: colors.text, margin: 0, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
            {product.name}
          </h3>
          {product.is_new && (
            <span style={{ display: 'inline-block', fontFamily: BODY_FONT, fontSize: 10, fontWeight: 700, color: 'white', background: colors.accent, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              New
            </span>
          )}
          {product.is_on_sale && (
            <span style={{ display: 'inline-block', fontFamily: BODY_FONT, fontSize: 10, fontWeight: 700, color: '#7A5A00', background: '#FFF3D0', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Sale
            </span>
          )}
        </div>

        {product.vendor && (
          <div style={{ fontFamily: BODY_FONT, fontSize: 13, color: '#8E8E93', marginTop: 3 }}>By {product.vendor}</div>
        )}
        {product.strain_type && (
          <div style={{ fontFamily: BODY_FONT, fontSize: 12, color: '#8E8E93', marginTop: 2, textTransform: 'capitalize' }}>{product.strain_type}</div>
        )}

        {showDescriptions && product.description && !product.description.startsWith('By ') && (
          <p style={{
            fontFamily: BODY_FONT, marginTop: 8, fontSize: 13, lineHeight: 1.5, color: '#8E8E93',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {product.description}
          </p>
        )}
      </div>

      {/* Tiered pricing */}
      {showPrices && hasTiers && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '12px 16px 0' }}>
          {product.prices!.map((tier) => {
            const isSelected = selectedTier?.label === tier.label;
            return (
              <button
                key={tier.label}
                onClick={() => setSelectedTier(tier)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 20,
                  border: `1.5px solid ${isSelected ? colors.accent : '#E5E4E0'}`,
                  background: isSelected ? colors.accent : 'white',
                  cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                  fontFamily: BODY_FONT,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 500, color: isSelected ? 'white' : '#48484A' }}>{tier.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? 'white' : '#1C1C1E' }}>{formatCurrency(tier.price)}</span>
                {tier.note && <span style={{ fontSize: 9, fontWeight: 600, color: isSelected ? 'rgba(255,255,255,0.8)' : '#B8860B', textTransform: 'uppercase' }}>{tier.note}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Flat pricing */}
      {showPrices && !hasTiers && product.base_price > 0 && (
        <div style={{ padding: '8px 16px 0', fontFamily: BODY_FONT, fontSize: 17, fontWeight: 700, color: colors.accent }}>
          {formatCurrency(product.base_price)}
        </div>
      )}

      {/* Add to cart */}
      {showPrices && (
        <button
          onClick={handleAdd}
          style={{
            width: 'calc(100% - 32px)', margin: '14px 16px 16px',
            padding: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: cartItem ? colors.accent : '#1C1C1E', color: 'white',
            border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14,
            cursor: 'pointer', transition: 'background 0.2s, transform 0.1s',
            fontFamily: BODY_FONT,
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {cartItem ? (
            <><IconCheck /> Added &mdash; {selectedTier?.label} {formatCurrency(selectedTier?.price ?? product.base_price)}</>
          ) : (
            <><IconPlus /> Add to Cart</>
          )}
        </button>
      )}
    </div>
  );
}

// ============================================
// CATEGORY ICON HELPER
// ============================================

function getCategoryIconSVG(category: string, color: string): React.ReactNode {
  const lower = category.toLowerCase();
  if (lower.includes('flower') || lower.includes('bud') || lower.includes('premium') || lower.includes('value') || lower.includes('mid')) return <IconFlower color={color} />;
  if (lower.includes('concentrate') || lower.includes('rosin') || lower.includes('wax') || lower.includes('extract')) return <IconConcentrate color={color} />;
  if (lower.includes('edible') || lower.includes('gummy') || lower.includes('food')) return <IconEdible color={color} />;
  if (lower.includes('faq') || lower.includes('info')) return <IconFAQ color={color} />;
  return <IconPackage color={color} />;
}
