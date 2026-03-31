import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { isMenuExpired, sanitizeColors, DEFAULT_COLORS } from './utils.ts';
import type { AppearanceSettings } from './utils.ts';
import { buildMenuPage, buildAccessCodePage, buildErrorPage } from './html-templates.ts';
import {
  fetchMenuByToken,
  verifyAccessCode,
  logFailedAccessAttempt,
  logMenuView,
  fetchMenuProducts,
} from './data-fetching.ts';

/**
 * serve-menu-page: Returns a self-contained, mobile-responsive HTML page
 * for a disposable menu. No JavaScript framework required -- pure HTML + CSS.
 *
 * GET /serve-menu-page?token=<encrypted_url_token>
 */

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
    const { menu, error: menuError } = await fetchMenuByToken(supabase, token);

    if (menuError || !menu) {
      return new Response(
        buildErrorPage('Menu Not Found', 'This menu page is no longer available or has expired.'),
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Security check 1: Menu must be active (not burned)
    if (menu.status !== 'active') {
      return new Response(
        buildErrorPage('Menu Unavailable', 'This menu is no longer available.'),
        { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Security check 2: Menu must not be expired
    if (isMenuExpired(menu.expiration_date as string | null, !!menu.never_expires)) {
      return new Response(
        buildErrorPage('Menu Expired', 'This menu has expired and is no longer available.'),
        { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Security check 3: Access code verification
    const accessCodeHash = menu.access_code_hash as string | null;
    const hasAccessCode = accessCodeHash && accessCodeHash.length > 0 && accessCodeHash !== 'none';

    if (hasAccessCode) {
      const providedCode = url.searchParams.get('code');

      if (!providedCode) {
        return new Response(
          buildAccessCodePage(menu.name as string ?? 'Menu'),
          { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      const codeMatches = await verifyAccessCode(providedCode, accessCodeHash);
      if (!codeMatches) {
        await logFailedAccessAttempt(supabase, menu.id as string);
        return new Response(
          buildAccessCodePage(menu.name as string ?? 'Menu', 'Invalid access code. Please try again.'),
          { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    }

    // Fetch products
    const { products, error: productsError } = await fetchMenuProducts(supabase, menu.id as string);

    if (productsError || !products) {
      return new Response(
        buildErrorPage('Error', 'Unable to load menu products.'),
        { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Log view
    await logMenuView(supabase, menu.id as string);

    // Parse appearance settings
    const appearance = (menu.appearance_settings ?? {}) as AppearanceSettings;
    const colors = sanitizeColors({ ...DEFAULT_COLORS, ...(appearance.colors ?? {}) });
    const showImages = menu.show_product_images !== false;
    const showPrices = appearance.show_prices !== false;
    const showDescriptions = appearance.show_descriptions !== false;
    const contactInfo = typeof appearance.contact_info === 'string' ? appearance.contact_info : '';
    const description = typeof menu.description === 'string' ? menu.description : '';

    const html = buildMenuPage({
      title: menu.name as string ?? 'Menu',
      description,
      customMessage: menu.custom_message as string ?? '',
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
