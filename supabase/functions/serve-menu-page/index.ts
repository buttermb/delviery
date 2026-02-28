import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

/**
 * serve-menu-page: Returns a self-contained, mobile-responsive HTML page
 * for a disposable menu. No JavaScript framework required — pure HTML + CSS.
 *
 * GET /serve-menu-page?token=<encrypted_url_token>
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPrice(price: number | null | undefined): string {
  if (price == null || price === 0) return '';
  return `$${price.toFixed(2)}`;
}

interface ColorConfig {
  bg: string;
  text: string;
  accent: string;
  cardBg: string;
  border: string;
}

const DEFAULT_COLORS: ColorConfig = {
  bg: '#f8f9fa',
  text: '#1a1a2e',
  accent: '#059669',
  cardBg: '#ffffff',
  border: '#e5e7eb',
};

interface AppearanceSettings {
  colors?: Partial<ColorConfig>;
  show_prices?: boolean;
  show_descriptions?: boolean;
  contact_info?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token || token.length < 10) {
      return new Response(
        buildErrorPage('Invalid Link', 'This menu page link is not valid.'),
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch menu by token
    const { data: menu, error: menuError } = await supabase
      .from('disposable_menus')
      .select('id, name, description, tenant_id, status, custom_message, show_product_images, appearance_settings')
      .eq('encrypted_url_token', token)
      .eq('status', 'active')
      .maybeSingle();

    if (menuError || !menu) {
      return new Response(
        buildErrorPage('Menu Not Found', 'This menu page is no longer available or has expired.'),
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Fetch products for this menu
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
      .eq('menu_id', menu.id)
      .order('display_order', { ascending: true });

    if (productsError) {
      return new Response(
        buildErrorPage('Error', 'Unable to load menu products.'),
        { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Log view
    await supabase.from('menu_access_logs').insert({
      menu_id: menu.id,
      access_type: 'static_page_view',
    }).then(() => { /* fire and forget */ });

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

    // Parse appearance settings
    const appearance = (menu.appearance_settings ?? {}) as AppearanceSettings;
    const colors: ColorConfig = {
      ...DEFAULT_COLORS,
      ...(appearance.colors ?? {}),
    };
    const showImages = menu.show_product_images !== false;
    const showPrices = appearance.show_prices !== false;
    const showDescriptions = appearance.show_descriptions !== false;
    const contactInfo = typeof appearance.contact_info === 'string' ? appearance.contact_info : '';
    const description = typeof menu.description === 'string' ? menu.description : '';

    const html = buildMenuPage({
      title: menu.name ?? 'Menu',
      description,
      customMessage: menu.custom_message ?? '',
      products,
      showImages,
      showPrices,
      showDescriptions,
      contactInfo,
      colors,
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (_error: unknown) {
    return new Response(
      buildErrorPage('Error', 'Something went wrong loading this page.'),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
});

interface ProductData {
  name: string;
  price: number;
  description: string;
  image_url: string;
  category: string;
}

interface BuildProductCardOptions {
  product: ProductData;
  showImage: boolean;
  showPrice: boolean;
  showDescription: boolean;
  colors: ColorConfig;
}

function buildProductCard({ product, showImage, showPrice, showDescription, colors }: BuildProductCardOptions): string {
  const imageHtml = showImage && product.image_url
    ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" class="product-img" loading="lazy" />`
    : '';

  const categoryBadge = product.category
    ? `<span class="category-badge">${escapeHtml(product.category)}</span>`
    : '';

  const descHtml = showDescription && product.description
    ? `<p class="product-desc">${escapeHtml(product.description)}</p>`
    : '';

  const priceHtml = showPrice && product.price > 0
    ? `<span class="product-price">${formatPrice(product.price)}</span>`
    : '';

  return `
    <div class="product-card" style="background:${colors.cardBg};border-color:${colors.border}">
      ${imageHtml}
      <div class="product-info">
        <div class="product-header">
          <h3 class="product-name">${escapeHtml(product.name)}</h3>
          ${priceHtml}
        </div>
        ${categoryBadge}
        ${descHtml}
      </div>
    </div>`;
}

interface BuildMenuPageOptions {
  title: string;
  description: string;
  customMessage: string;
  products: ProductData[];
  showImages: boolean;
  showPrices: boolean;
  showDescriptions: boolean;
  contactInfo: string;
  colors: ColorConfig;
}

function buildMenuPage(opts: BuildMenuPageOptions): string {
  const { title, description, customMessage, products, showImages, showPrices, showDescriptions, contactInfo, colors } = opts;

  const productCards = products.map((p) => buildProductCard({
    product: p,
    showImage: showImages,
    showPrice: showPrices,
    showDescription: showDescriptions,
    colors,
  })).join('\n');

  const descHtml = description
    ? `<p class="menu-desc">${escapeHtml(description)}</p>`
    : '';

  const messageHtml = customMessage
    ? `<div class="custom-message">${escapeHtml(customMessage)}</div>`
    : '';

  const contactHtml = contactInfo
    ? `<div class="contact-info">${escapeHtml(contactInfo)}</div>`
    : '';

  const countText = products.length === 1 ? '1 item' : `${products.length} items`;

  // Determine if dark theme for lighter muted colors
  const isDark = isColorDark(colors.bg);
  const mutedText = isDark ? '#94a3b8' : '#6b7280';
  const headerBorder = isDark ? '#334155' : '#e5e7eb';
  const badgeBg = isDark ? '#334155' : '#f3f4f6';
  const badgeText = isDark ? '#94a3b8' : '#6b7280';
  const messageBg = isDark ? '#1e3a5f' : '#eff6ff';
  const messageText = isDark ? '#93c5fd' : '#1e40af';
  const messageBorder = isDark ? '#3b82f6' : '#3b82f6';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: ${colors.bg};
      color: ${colors.text};
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 24px 16px 48px; }
    .header {
      text-align: center;
      padding: 32px 0 24px;
      border-bottom: 1px solid ${headerBorder};
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: ${colors.text};
    }
    .menu-desc {
      margin-top: 8px;
      color: ${mutedText};
      font-size: 15px;
    }
    .item-count {
      margin-top: 12px;
      font-size: 13px;
      color: ${mutedText};
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 500;
    }
    .custom-message {
      background: ${messageBg};
      border-left: 3px solid ${messageBorder};
      padding: 12px 16px;
      margin-bottom: 24px;
      border-radius: 0 8px 8px 0;
      font-size: 14px;
      color: ${messageText};
    }
    .products-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .product-card {
      background: ${colors.cardBg};
      border: 1px solid ${colors.border};
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: row;
      transition: box-shadow 0.15s;
    }
    .product-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .product-img {
      width: 100px;
      height: 100px;
      object-fit: cover;
      flex-shrink: 0;
      background: ${badgeBg};
    }
    .product-info {
      padding: 14px 16px;
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .product-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .product-name {
      font-size: 16px;
      font-weight: 600;
      color: ${colors.text};
      line-height: 1.3;
    }
    .product-price {
      font-size: 16px;
      font-weight: 700;
      color: ${colors.accent};
      white-space: nowrap;
      flex-shrink: 0;
    }
    .category-badge {
      display: inline-block;
      background: ${badgeBg};
      color: ${badgeText};
      font-size: 11px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      width: fit-content;
    }
    .product-desc {
      font-size: 13px;
      color: ${mutedText};
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .contact-info {
      text-align: center;
      padding: 16px;
      margin-top: 24px;
      font-size: 14px;
      font-weight: 500;
      color: ${colors.text};
      border: 1px solid ${colors.border};
      border-radius: 12px;
      background: ${colors.cardBg};
    }
    .footer {
      text-align: center;
      padding: 32px 0 16px;
      border-top: 1px solid ${headerBorder};
      margin-top: 32px;
      color: ${mutedText};
      font-size: 12px;
    }

    @media (max-width: 480px) {
      .container { padding: 16px 12px 32px; }
      .header { padding: 24px 0 16px; }
      .header h1 { font-size: 22px; }
      .product-img { width: 80px; height: 80px; }
      .product-name { font-size: 14px; }
      .product-price { font-size: 14px; }
      .product-info { padding: 10px 12px; }
    }

    @media print {
      body { background: #fff; }
      .product-card { break-inside: avoid; border: 1px solid #ddd; }
      .product-card:hover { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
      ${descHtml}
      <div class="item-count">${countText}</div>
    </div>
    ${messageHtml}
    <div class="products-grid">
      ${productCards}
    </div>
    ${contactHtml}
    <div class="footer">
      Generated by FloraIQ &middot; ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </div>
  </div>
</body>
</html>`;
}

/** Simple check if a hex color is dark (for adaptive text colors). */
function isColorDark(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return false;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  // Perceived brightness formula
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

function buildErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; background: #f8f9fa; color: #374151;
    }
    .error-box { text-align: center; padding: 48px 24px; }
    .error-box h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #111827; }
    .error-box p { font-size: 15px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="error-box">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}
