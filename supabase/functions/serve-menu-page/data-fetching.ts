/**
 * Data fetching logic for the menu page: menu lookup, access code verification,
 * product fetching, and view logging.
 */

import type { ProductData } from './utils.ts';

/**
 * Fetch a menu by its encrypted URL token.
 * Returns the menu record or null if not found.
 */
export async function fetchMenuByToken(
  supabase: ReturnType<typeof import('../_shared/deps.ts').createClient>,
  token: string
): Promise<{ menu: Record<string, unknown> | null; error: unknown }> {
  const { data: menu, error: menuError } = await supabase
    .from('disposable_menus')
    .select('id, name, description, tenant_id, status, custom_message, show_product_images, appearance_settings, expiration_date, never_expires, security_settings, access_code_hash')
    .eq('encrypted_url_token', token)
    .maybeSingle();

  return { menu, error: menuError };
}

/**
 * Verify an access code against the stored hash using SHA-256.
 * Returns true if the code matches.
 */
export async function verifyAccessCode(
  providedCode: string,
  storedHash: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(providedCode));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const providedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return providedHash === storedHash;
}

/**
 * Log a failed access code attempt.
 */
export async function logFailedAccessAttempt(
  supabase: ReturnType<typeof import('../_shared/deps.ts').createClient>,
  menuId: string
): Promise<void> {
  await supabase.from('menu_access_logs').insert({
    menu_id: menuId,
    access_type: 'failed_access_code',
  }).then(() => { /* fire and forget */ });
}

/**
 * Log a successful menu page view.
 */
export async function logMenuView(
  supabase: ReturnType<typeof import('../_shared/deps.ts').createClient>,
  menuId: string
): Promise<void> {
  await supabase.from('menu_access_logs').insert({
    menu_id: menuId,
    access_type: 'static_page_view',
  }).then(() => { /* fire and forget */ });
}

/**
 * Fetch products for a given menu and transform them into ProductData.
 */
export async function fetchMenuProducts(
  supabase: ReturnType<typeof import('../_shared/deps.ts').createClient>,
  menuId: string
): Promise<{ products: ProductData[] | null; error: unknown }> {
  const { data: menuProducts, error: productsError } = await supabase
    .from('disposable_menu_products')
    .select(`
      product_id,
      custom_price,
      display_order,
      wholesale_inventory (
        id,
        product_name,
        base_price,
        description,
        image_url,
        category
      )
    `)
    .eq('menu_id', menuId)
    .order('display_order', { ascending: true });

  if (productsError) {
    return { products: null, error: productsError };
  }

  const products = (menuProducts ?? []).map((mp) => {
    const inv = mp.wholesale_inventory as Record<string, unknown> | null;
    return {
      name: (inv?.product_name as string) ?? 'Product',
      price: (mp.custom_price as number | null) ?? (inv?.base_price as number | null) ?? 0,
      description: (inv?.description as string) ?? '',
      image_url: (inv?.image_url as string) ?? '',
      category: (inv?.category as string) ?? '',
    };
  });

  return { products, error: null };
}
