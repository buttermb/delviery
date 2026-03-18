import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('credits-packages');

const querySchema = z.object({
  tenant_slug: z.string().min(1).max(100),
});

interface CreditPackageResponse {
  id: string;
  name: string;
  slug: string | null;
  credits: number;
  bonus_credits: number;
  price_cents: number;
  price_per_credit: number;
  effective_credits: number;
  description: string | null;
  badge: string | null;
  is_featured: boolean;
  sort_order: number;
}

interface PurchaseLimitInfo {
  total_purchases: number;
  total_credits_purchased: number;
  last_purchase_at: string | null;
}

serve(
  withZenProtection(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
        logger.error('Missing required environment variables');
        return new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse tenant_slug from query params (GET) or body (POST)
      let tenantSlug: string;
      if (req.method === 'GET') {
        const url = new URL(req.url);
        const rawSlug = url.searchParams.get('tenant_slug');
        if (!rawSlug) {
          return new Response(
            JSON.stringify({ error: 'tenant_slug query parameter is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        tenantSlug = querySchema.parse({ tenant_slug: rawSlug }).tenant_slug;
      } else {
        const body = await req.json();
        tenantSlug = querySchema.parse(body).tenant_slug;
      }

      // Use service role to resolve tenant and fetch packages
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

      // Resolve tenant from slug
      const { data: tenant, error: tenantError } = await serviceClient
        .from('tenants')
        .select('id, slug, business_name')
        .eq('slug', tenantSlug)
        .maybeSingle();

      if (tenantError) {
        logger.error('Error resolving tenant', { tenantId: tenantSlug });
        return new Response(
          JSON.stringify({ error: 'Failed to resolve tenant' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!tenant) {
        return new Response(
          JSON.stringify({ error: 'Tenant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch active credit packages sorted by sort_order
      const { data: packages, error: packagesError } = await serviceClient
        .from('credit_packages')
        .select('id, name, slug, credits, bonus_credits, price_cents, description, badge, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (packagesError) {
        logger.error('Error fetching credit packages', { tenantId: tenant.id });
        return new Response(
          JSON.stringify({ error: 'Failed to fetch credit packages' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transform packages with calculated fields
      const transformedPackages: CreditPackageResponse[] = (packages || []).map((pkg) => {
        const bonusCredits = pkg.bonus_credits || 0;
        const effectiveCredits = pkg.credits + bonusCredits;
        const pricePerCredit = effectiveCredits > 0
          ? Math.round((pkg.price_cents / effectiveCredits) * 100) / 100
          : 0;

        return {
          id: pkg.id,
          name: pkg.name,
          slug: pkg.slug,
          credits: pkg.credits,
          bonus_credits: bonusCredits,
          price_cents: pkg.price_cents,
          price_per_credit: pricePerCredit,
          effective_credits: effectiveCredits,
          description: pkg.description,
          badge: pkg.badge,
          is_featured: pkg.badge !== null && pkg.badge !== '',
          sort_order: pkg.sort_order || 0,
        };
      });

      // Check user purchase limits if authenticated
      let purchaseLimits: PurchaseLimitInfo | null = null;
      const authHeader = req.headers.get('Authorization');

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: { Authorization: authHeader },
          },
        });

        const { data: { user } } = await userClient.auth.getUser();

        if (user) {
          // Verify user belongs to this tenant
          const { data: tenantUser } = await serviceClient
            .from('tenant_users')
            .select('id')
            .eq('user_id', user.id)
            .eq('tenant_id', tenant.id)
            .maybeSingle();

          if (tenantUser) {
            // Get purchase history for this tenant
            const { data: purchaseHistory } = await serviceClient
              .from('credit_transactions')
              .select('amount, created_at')
              .eq('tenant_id', tenant.id)
              .eq('transaction_type', 'purchase')
              .order('created_at', { ascending: false });

            const totalPurchases = purchaseHistory?.length || 0;
            const totalCreditsPurchased = (purchaseHistory || []).reduce(
              (sum, tx) => sum + (tx.amount || 0),
              0
            );
            const lastPurchaseAt = purchaseHistory && purchaseHistory.length > 0
              ? purchaseHistory[0].created_at
              : null;

            purchaseLimits = {
              total_purchases: totalPurchases,
              total_credits_purchased: totalCreditsPurchased,
              last_purchase_at: lastPurchaseAt,
            };
          }
        }
      }

      const response: {
        packages: CreditPackageResponse[];
        tenant: { id: string; slug: string; business_name: string };
        purchase_info?: PurchaseLimitInfo;
      } = {
        packages: transformedPackages,
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          business_name: tenant.business_name,
        },
      };

      if (purchaseLimits) {
        response.purchase_info = purchaseLimits;
      }

      logger.info('Credit packages fetched successfully', {
        tenantId: tenant.id,
        packageCount: transformedPackages.length.toString(),
      });

      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return new Response(
          JSON.stringify({ error: 'Invalid input', details: error.errors }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      logger.error('Unexpected error', {
        functionName: 'credits-packages',
      });

      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  })
);
