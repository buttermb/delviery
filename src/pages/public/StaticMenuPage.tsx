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

interface MenuData {
  name: string;
  description: string;
  custom_message: string;
  show_product_images: boolean;
  products: MenuProduct[];
}

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
        // Try the edge function first for consistent server-side rendering
        const { data, error } = await supabase.functions.invoke('serve-menu-page', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          body: undefined,
        });

        // If edge function fails, fall back to direct DB query
        if (error || !data) {
          const result = await loadMenuDirect(token);
          if (cancelled) return;
          if (result) {
            setMenu(result);
            setState('ready');
          } else {
            setState('not_found');
          }
          return;
        }

        if (cancelled) return;
        setMenu(data);
        setState('ready');
      } catch {
        if (cancelled) return;
        // Fall back to direct query
        const result = await loadMenuDirect(token);
        if (cancelled) return;
        if (result) {
          setMenu(result);
          setState('ready');
        } else {
          setState('error');
        }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="text-center pb-6 mb-6 border-b border-gray-200">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            {menu.name}
          </h1>
          {menu.description && (
            <p className="mt-2 text-gray-500 text-sm sm:text-base">{menu.description}</p>
          )}
          <div className="mt-3 text-xs uppercase tracking-wider text-gray-400 font-medium">
            {menu.products.length} {menu.products.length === 1 ? 'item' : 'items'}
          </div>
        </div>

        {/* Custom message */}
        {menu.custom_message && (
          <div className="mb-6 px-4 py-3 bg-blue-50 border-l-3 border-blue-500 rounded-r-lg text-sm text-blue-800">
            {menu.custom_message}
          </div>
        )}

        {/* Products */}
        <div className="space-y-3">
          {menu.products.map((product, idx) => (
            <div
              key={idx}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden flex hover:shadow-sm transition-shadow"
            >
              {showImages && product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 object-cover flex-shrink-0 bg-gray-100"
                  loading="lazy"
                />
              )}
              <div className="p-3 sm:p-4 flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex justify-between items-start gap-3">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-900 leading-tight">
                    {product.name}
                  </h3>
                  {product.price > 0 && (
                    <span className="text-sm sm:text-base font-bold text-emerald-600 shrink-0">
                      ${product.price.toFixed(2)}
                    </span>
                  )}
                </div>
                {product.category && (
                  <span className="inline-block w-fit text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wide font-medium">
                    {product.category}
                  </span>
                )}
                {product.description && (
                  <p className="text-xs sm:text-sm text-gray-500 line-clamp-2">{product.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 pt-6 border-t border-gray-200 text-xs text-gray-400">
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
      .select('id, name, description, custom_message, show_product_images, tenant_id')
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

    return {
      name: menu.name ?? 'Menu',
      description: typeof menu.description === 'string' ? menu.description : '',
      custom_message: (menu.custom_message as string) ?? '',
      show_product_images: menu.show_product_images !== false,
      products,
    };
  } catch (err: unknown) {
    logger.error('Failed to load menu directly', { token, error: String(err) });
    return null;
  }
}
