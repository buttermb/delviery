import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface MenuProduct {
  name: string;
  price: number;
  description: string;
  image_url: string;
  category: string;
}

interface ColorConfig {
  bg: string;
  text: string;
  accent: string;
  cardBg: string;
  border: string;
}

interface AppearanceSettings {
  colors?: Partial<ColorConfig>;
  show_prices?: boolean;
  show_descriptions?: boolean;
  contact_info?: string;
}

interface MenuData {
  name: string;
  description: string;
  custom_message: string;
  show_product_images: boolean;
  products: MenuProduct[];
  appearance: AppearanceSettings;
}

const DEFAULT_COLORS: ColorConfig = {
  bg: '#f8f9fa',
  text: '#1a1a2e',
  accent: '#059669',
  cardBg: '#ffffff',
  border: '#e5e7eb',
};

type PageState = 'loading' | 'ready' | 'error' | 'not_found';

/**
 * StaticMenuPage — a minimal, public-facing page that renders a disposable
 * menu as a clean HTML list.  No admin chrome, no cart, no auth required.
 * Designed to load fast and be mobile-responsive.
 */
export default function StaticMenuPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>('loading');
  const [menu, setMenu] = useState<MenuData | null>(null);

  useEffect(() => {
    if (!token) {
      setState('not_found');
      return;
    }

    let cancelled = false;

    const fetchMenu = async () => {
      try {
        const result = await loadMenuDirect(token);
        if (cancelled) return;
        if (result) {
          setMenu(result);
          setState('ready');
        } else {
          setState('not_found');
        }
      } catch {
        if (cancelled) return;
        setState('error');
      }
    };

    fetchMenu();
    return () => { cancelled = true; };
  }, [token]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading menu...</div>
      </div>
    );
  }

  if (state === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Menu Not Found</h1>
          <p className="text-gray-500 text-sm">This menu page is no longer available or has expired.</p>
        </div>
      </div>
    );
  }

  if (state === 'error' || !menu) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-500 text-sm">Something went wrong loading this page.</p>
        </div>
      </div>
    );
  }

  const showImages = menu.show_product_images !== false;
  const showPrices = menu.appearance?.show_prices !== false;
  const showDescriptions = menu.appearance?.show_descriptions !== false;
  const contactInfo = menu.appearance?.contact_info ?? '';
  const colors: ColorConfig = { ...DEFAULT_COLORS, ...(menu.appearance?.colors ?? {}) };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg, color: colors.text }}>
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="text-center pb-6 mb-6" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: colors.text }}>
            {menu.name}
          </h1>
          {menu.description && (
            <p className="mt-2 text-sm sm:text-base" style={{ color: `${colors.text}99` }}>{menu.description}</p>
          )}
          <div className="mt-3 text-xs uppercase tracking-wider font-medium" style={{ color: `${colors.text}66` }}>
            {menu.products.length} {menu.products.length === 1 ? 'item' : 'items'}
          </div>
        </div>

        {/* Custom message */}
        {menu.custom_message && (
          <div className="mb-6 px-4 py-3 rounded-r-lg text-sm"
            style={{
              backgroundColor: `${colors.accent}15`,
              borderLeft: `3px solid ${colors.accent}`,
              color: colors.text,
            }}
          >
            {menu.custom_message}
          </div>
        )}

        {/* Products */}
        <div className="space-y-3">
          {menu.products.map((product, idx) => (
            <div
              key={idx}
              className="rounded-xl overflow-hidden flex hover:shadow-sm transition-shadow"
              style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}` }}
            >
              {showImages && product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 object-cover flex-shrink-0"
                  style={{ backgroundColor: `${colors.border}` }}
                  loading="lazy"
                />
              )}
              <div className="p-3 sm:p-4 flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex justify-between items-start gap-3">
                  <h3 className="font-semibold text-sm sm:text-base leading-tight" style={{ color: colors.text }}>
                    {product.name}
                  </h3>
                  {showPrices && product.price > 0 && (
                    <span className="text-sm sm:text-base font-bold shrink-0" style={{ color: colors.accent }}>
                      ${product.price.toFixed(2)}
                    </span>
                  )}
                </div>
                {product.category && (
                  <span
                    className="inline-block w-fit text-[11px] px-2 py-0.5 rounded-full uppercase tracking-wide font-medium"
                    style={{ backgroundColor: `${colors.border}`, color: `${colors.text}99` }}
                  >
                    {product.category}
                  </span>
                )}
                {showDescriptions && product.description && (
                  <p className="text-xs sm:text-sm line-clamp-2" style={{ color: `${colors.text}99` }}>
                    {product.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Contact info */}
        {contactInfo && (
          <div
            className="text-center mt-6 p-4 rounded-xl text-sm font-medium"
            style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, color: colors.text }}
          >
            {contactInfo}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 pt-6 text-xs" style={{ borderTop: `1px solid ${colors.border}`, color: `${colors.text}66` }}>
          Generated by FloraIQ
        </div>
      </div>
    </div>
  );
}

/** Direct Supabase query fallback when edge function is unavailable */
async function loadMenuDirect(token: string): Promise<MenuData | null> {
  try {
    const { data: menu, error: menuError } = await supabase
      .from('disposable_menus')
      .select('id, name, description, custom_message, show_product_images, appearance_settings, tenant_id')
      .eq('encrypted_url_token', token)
      .eq('status', 'active')
      .maybeSingle();

    if (menuError || !menu) return null;

    const { data: menuProducts } = await supabase
      .from('disposable_menu_products')
      .select(`
        product_id,
        custom_price,
        display_order,
        wholesale_inventory (
          product_name,
          base_price,
          description,
          image_url,
          category
        )
      `)
      .eq('menu_id', menu.id)
      .order('display_order', { ascending: true });

    const products: MenuProduct[] = (menuProducts ?? []).map((mp) => {
      const inv = mp.wholesale_inventory as Record<string, unknown> | null;
      return {
        name: (inv?.product_name as string) ?? 'Product',
        price: (mp.custom_price as number | null) ?? (inv?.base_price as number | null) ?? 0,
        description: (inv?.description as string) ?? '',
        image_url: (inv?.image_url as string) ?? '',
        category: (inv?.category as string) ?? '',
      };
    });

    const appearance = (menu.appearance_settings ?? {}) as AppearanceSettings;

    return {
      name: menu.name ?? 'Menu',
      description: typeof menu.description === 'string' ? menu.description : '',
      custom_message: (menu.custom_message as string) ?? '',
      show_product_images: menu.show_product_images !== false,
      products,
      appearance,
    };
  } catch (err: unknown) {
    logger.error('Failed to load menu directly', { token, error: String(err) });
    return null;
  }
}
