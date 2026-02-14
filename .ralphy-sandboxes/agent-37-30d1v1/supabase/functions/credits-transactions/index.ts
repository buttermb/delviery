import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const TransactionTypeEnum = z.enum([
  'free_grant',
  'purchase',
  'usage',
  'refund',
  'bonus',
  'adjustment',
]);

const QueryParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  type: TransactionTypeEnum.optional(),
  date_from: z.string().datetime({ offset: true }).optional(),
  date_to: z.string().datetime({ offset: true }).optional(),
});

interface CursorData {
  created_at: string;
  id: string;
}

function encodeCursor(createdAt: string, id: string): string {
  return btoa(JSON.stringify({ created_at: createdAt, id }));
}

function decodeCursor(cursor: string): CursorData {
  const decoded = JSON.parse(atob(cursor));
  if (!decoded.created_at || !decoded.id) {
    throw new Error('Invalid cursor format');
  }
  return decoded as CursorData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tenantError || !tenantUser?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'No tenant access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantUser.tenant_id;

    // Parse and validate query parameters
    const url = new URL(req.url);
    const rawParams = {
      limit: url.searchParams.get('limit') ?? undefined,
      cursor: url.searchParams.get('cursor') ?? undefined,
      type: url.searchParams.get('type') ?? undefined,
      date_from: url.searchParams.get('date_from') ?? undefined,
      date_to: url.searchParams.get('date_to') ?? undefined,
    };

    const validation = QueryParamsSchema.safeParse(rawParams);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid query parameters', details: validation.error.issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { limit, cursor, type, date_from, date_to } = validation.data;

    // Build the transactions query
    let query = supabase
      .from('credit_transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1); // Fetch one extra to determine if there's a next page

    // Apply type filter
    if (type) {
      query = query.eq('transaction_type', type);
    }

    // Apply date range filters
    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    // Apply cursor for pagination (records before the cursor in descending order)
    if (cursor) {
      let cursorData: CursorData;
      try {
        cursorData = decodeCursor(cursor);
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid cursor' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // For descending order: get records with created_at < cursor OR same created_at but id < cursor
      query = query.or(
        `created_at.lt.${cursorData.created_at},and(created_at.eq.${cursorData.created_at},id.lt.${cursorData.id})`
      );
    }

    const { data: transactions, error: queryError } = await query;

    if (queryError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transactions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine if there's a next page
    const hasMore = (transactions?.length ?? 0) > limit;
    const results = hasMore ? transactions!.slice(0, limit) : (transactions ?? []);

    // Generate next cursor from the last item in results
    const nextCursor = hasMore && results.length > 0
      ? encodeCursor(results[results.length - 1].created_at, results[results.length - 1].id)
      : null;

    // Build totals query with same filters (type + date range)
    let totalsQuery = supabase
      .from('credit_transactions')
      .select('amount, transaction_type')
      .eq('tenant_id', tenantId);

    if (type) {
      totalsQuery = totalsQuery.eq('transaction_type', type);
    }
    if (date_from) {
      totalsQuery = totalsQuery.gte('created_at', date_from);
    }
    if (date_to) {
      totalsQuery = totalsQuery.lte('created_at', date_to);
    }

    const { data: totalsData, error: totalsError } = await totalsQuery;

    if (totalsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch totals' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate totals from the filtered transactions
    const totals = {
      total_earned: 0,
      total_spent: 0,
      net_change: 0,
      transaction_count: totalsData?.length ?? 0,
    };

    for (const row of totalsData ?? []) {
      if (row.amount > 0) {
        totals.total_earned += row.amount;
      } else {
        totals.total_spent += Math.abs(row.amount);
      }
      totals.net_change += row.amount;
    }

    return new Response(
      JSON.stringify({
        data: results,
        pagination: {
          has_more: hasMore,
          next_cursor: nextCursor,
          limit,
        },
        totals,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
