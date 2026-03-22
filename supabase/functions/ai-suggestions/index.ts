/**
 * AI Suggestions Edge Function
 * Provides AI-powered product and business suggestions based on tenant data.
 * Credit-gated: 100 credits per request (ai_suggestions action key).
 */

import { corsHeaders, z, type SupabaseClient } from '../_shared/deps.ts';
import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts';

const RequestSchema = z.object({
  type: z.enum(['stale_products', 'reorder', 'pricing', 'general']).default('general'),
  limit: z.number().int().min(1).max(20).default(5),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return withCreditGate(req, CREDIT_ACTIONS.AI_SUGGESTIONS, async (tenantId, serviceClient) => {
    try {
      const rawBody = await req.json();
      const parsed = RequestSchema.safeParse(rawBody);

      if (!parsed.success) {
        return new Response(
          JSON.stringify({
            error: 'Invalid input',
            details: parsed.error.errors,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { type, limit } = parsed.data;
      const suggestions = await generateSuggestions(serviceClient, tenantId, type, limit);

      return new Response(
        JSON.stringify({ suggestions }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('AI suggestions error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to generate suggestions',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Suggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata: Record<string, unknown>;
}

interface Product {
  id: string;
  name: string;
  price: number;
  status?: string;
  stock_quantity?: number;
  low_stock_threshold?: number;
}

// ---------------------------------------------------------------------------
// Suggestion generators
// ---------------------------------------------------------------------------

async function generateSuggestions(
  client: SupabaseClient,
  tenantId: string,
  type: string,
  limit: number
): Promise<Suggestion[]> {
  switch (type) {
    case 'stale_products':
      return getStaleProductSuggestions(client, tenantId, limit);
    case 'reorder':
      return getReorderSuggestions(client, tenantId, limit);
    case 'pricing':
      return getPricingSuggestions(client, tenantId, limit);
    default:
      return getGeneralSuggestions(client, tenantId, limit);
  }
}

async function getStaleProductSuggestions(
  client: SupabaseClient,
  tenantId: string,
  limit: number
): Promise<Suggestion[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: activeProducts } = await client
    .from('products')
    .select('id, name, price')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');

  if (!activeProducts || activeProducts.length === 0) return [];

  const productIds = activeProducts.map((p: Product) => p.id);

  const { data: soldItems } = await client
    .from('order_items')
    .select('product_id')
    .in('product_id', productIds)
    .gte('created_at', thirtyDaysAgo.toISOString());

  const soldProductIds = new Set(
    soldItems?.map((i: { product_id: string }) => i.product_id) ?? []
  );
  const staleProducts = activeProducts.filter(
    (p: Product) => !soldProductIds.has(p.id)
  );

  return staleProducts.slice(0, limit).map((product: Product) => ({
    id: crypto.randomUUID(),
    type: 'stale_product',
    title: `"${product.name}" hasn't sold in 30+ days`,
    description: `Consider running a promotion, bundling with popular items, or adjusting the price ($${product.price}).`,
    priority: 'medium' as const,
    metadata: { productId: product.id, productName: product.name, price: product.price },
  }));
}

async function getReorderSuggestions(
  client: SupabaseClient,
  tenantId: string,
  limit: number
): Promise<Suggestion[]> {
  const { data: lowStockProducts } = await client
    .from('products')
    .select('id, name, stock_quantity, low_stock_threshold')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .not('low_stock_threshold', 'is', null)
    .order('stock_quantity', { ascending: true })
    .limit(limit);

  if (!lowStockProducts) return [];

  return lowStockProducts
    .filter(
      (p: Product) =>
        p.stock_quantity != null &&
        p.low_stock_threshold != null &&
        p.stock_quantity <= p.low_stock_threshold
    )
    .map((product: Product) => {
      const isOutOfStock = product.stock_quantity === 0;
      return {
        id: crypto.randomUUID(),
        type: 'reorder',
        title: isOutOfStock
          ? `"${product.name}" is out of stock`
          : `"${product.name}" is running low (${product.stock_quantity} left)`,
        description: `Threshold is ${product.low_stock_threshold} units. Consider placing a reorder.`,
        priority: isOutOfStock ? ('critical' as const) : ('high' as const),
        metadata: {
          productId: product.id,
          productName: product.name,
          currentStock: product.stock_quantity,
          threshold: product.low_stock_threshold,
        },
      };
    });
}

async function getPricingSuggestions(
  client: SupabaseClient,
  tenantId: string,
  limit: number
): Promise<Suggestion[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: products } = await client
    .from('products')
    .select('id, name, price')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .limit(limit);

  if (!products || products.length === 0) return [];

  const suggestions: Suggestion[] = [];

  for (const product of products as Product[]) {
    const { count } = await client
      .from('order_items')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', product.id)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (count && count > 10) {
      suggestions.push({
        id: crypto.randomUUID(),
        type: 'pricing',
        title: `"${product.name}" sold ${count} times this month`,
        description: `High demand may support a price increase from $${product.price}.`,
        priority: 'low',
        metadata: {
          productId: product.id,
          productName: product.name,
          currentPrice: product.price,
          salesCount: count,
        },
      });
    }
  }

  return suggestions.slice(0, limit);
}

async function getGeneralSuggestions(
  client: SupabaseClient,
  tenantId: string,
  limit: number
): Promise<Suggestion[]> {
  const [stale, reorder, pricing] = await Promise.all([
    getStaleProductSuggestions(client, tenantId, Math.ceil(limit / 3)),
    getReorderSuggestions(client, tenantId, Math.ceil(limit / 3)),
    getPricingSuggestions(client, tenantId, Math.ceil(limit / 3)),
  ]);

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...stale, ...reorder, ...pricing]
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, limit);
}
