import { useEffect, useState, useMemo } from 'react';
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
  accent: '#2563eb',
  cardBg: '#ffffff',
  border: '#e5e7eb',
};

type PageState = 'loading' | 'ready' | 'error' | 'not_found';

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

  // Group products by category
  const groupedProducts = useMemo(() => {
    if (!menu) return {};
    const groups: Record<string, MenuProduct[]> = {};
    for (const product of menu.products) {
      const cat = product.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(product);
    }
    return groups;
  }, [menu]);

  if (state === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#9ca3af', fontSize: 16 }}>Loading menu...</div>
      </div>
    );
  }

  if (state === 'not_found') {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '0 16px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Menu Not Found</h1>
          <p style={{ color: '#6b7280', fontSize: 14 }}>This menu page is no longer available or has expired.</p>
        </div>
      </div>
    );
  }

  if (state === 'error' || !menu) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '0 16px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Error</h1>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Something went wrong loading this page.</p>
        </div>
      </div>
    );
  }

  const showImages = menu.show_product_images !== false;
  const showPrices = menu.appearance?.show_prices !== false;
  const showDescriptions = menu.appearance?.show_descriptions !== false;
  const contactInfo = menu.appearance?.contact_info ?? '';
  const colors: ColorConfig = { ...DEFAULT_COLORS, ...(menu.appearance?.colors ?? {}) };
  const categories = Object.keys(groupedProducts);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.bg,
      color: colors.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 0 48px' }}>
        {/* Header */}
        <div style={{
          padding: '24px 16px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <div>
            <h1 style={{
              fontSize: 22,
              fontWeight: 700,
              color: colors.text,
              margin: 0,
              letterSpacing: '-0.02em',
            }}>
              {menu.name}
            </h1>
            {menu.description && (
              <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0' }}>{menu.description}</p>
            )}
          </div>
          <div style={{
            fontSize: 12,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}>
            {menu.products.length} {menu.products.length === 1 ? 'item' : 'items'}
          </div>
        </div>

        {/* Custom message */}
        {menu.custom_message && (
          <div style={{
            margin: '16px 16px 0',
            padding: '12px 16px',
            background: `${colors.accent}10`,
            borderLeft: `3px solid ${colors.accent}`,
            borderRadius: '0 8px 8px 0',
            fontSize: 14,
            color: colors.text,
          }}>
            {menu.custom_message}
          </div>
        )}

        {/* Products grouped by category */}
        {categories.map((category) => (
          <div key={category} style={{ marginTop: 24 }}>
            {/* Category header */}
            {categories.length > 1 && (
              <div style={{
                padding: '0 16px 8px',
                fontSize: 13,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#6b7280',
              }}>
                {category}
              </div>
            )}

            {/* Product cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px' }}>
              {groupedProducts[category].map((product, idx) => (
                <div
                  key={`${category}-${idx}`}
                  style={{
                    background: colors.cardBg,
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: `1px solid ${colors.border}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Full-width product image */}
                  {showImages && product.image_url && (
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/10', overflow: 'hidden', background: '#f3f4f6' }}>
                      <img
                        src={product.image_url}
                        alt={product.name}
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    </div>
                  )}

                  {/* Product info */}
                  <div style={{ padding: '14px 16px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <h3 style={{
                        fontSize: 17,
                        fontWeight: 700,
                        color: colors.text,
                        margin: 0,
                        lineHeight: 1.3,
                        textTransform: 'uppercase',
                        letterSpacing: '0.01em',
                      }}>
                        {product.name}
                      </h3>
                    </div>

                    {/* Price */}
                    {showPrices && product.price > 0 && (
                      <div style={{
                        marginTop: 6,
                        fontSize: 15,
                        fontWeight: 700,
                        color: colors.accent,
                      }}>
                        ${product.price.toFixed(2)}
                      </div>
                    )}

                    {/* Description */}
                    {showDescriptions && product.description && (
                      <p style={{
                        marginTop: 8,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: '#6b7280',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {product.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Contact info */}
        {contactInfo && (
          <div style={{
            margin: '24px 16px 0',
            padding: 16,
            background: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 500,
            color: colors.text,
          }}>
            {contactInfo}
          </div>
        )}

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: 32,
          padding: '24px 16px 0',
          borderTop: `1px solid ${colors.border}`,
          color: '#9ca3af',
          fontSize: 12,
        }}>
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
