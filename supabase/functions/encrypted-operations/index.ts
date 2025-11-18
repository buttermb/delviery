// supabase/functions/encrypted-operations/index.ts
// Edge function for server-side operations on encrypted data
// Note: Server cannot decrypt data, but can work with encrypted fields and search indexes

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get user from token
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, table, searchHash, filters } = await req.json();

    switch (action) {
      case 'search':
        // Search using encrypted search indexes
        // Note: Client must provide the search hash (created client-side)
        if (!table || !searchHash) {
          return new Response(
            JSON.stringify({ error: 'Missing table or searchHash' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Determine which search index field to use based on table
        let searchIndexField = '';
        if (table === 'customers') {
          searchIndexField = 'email_search_index'; // or phone_search_index
        } else if (table === 'wholesale_clients') {
          searchIndexField = 'business_name_search_index';
        } else if (table === 'products') {
          searchIndexField = 'name_search_index';
        } else {
          return new Response(
            JSON.stringify({ error: 'Unsupported table for search' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Query using search index
        const { data: searchResults, error: searchError } = await supabaseClient
          .from(table)
          .select('*')
          .eq(searchIndexField, searchHash);

        if (searchError) {
          return new Response(
            JSON.stringify({ error: searchError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ results: searchResults }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'bulk_count':
        // Count encrypted records (without decrypting)
        if (!table) {
          return new Response(
            JSON.stringify({ error: 'Missing table' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { count, error: countError } = await supabaseClient
          .from(table)
          .select('*', { count: 'exact', head: true })
          .not('encryption_metadata', 'is', null);

        if (countError) {
          return new Response(
            JSON.stringify({ error: countError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ count }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'verify_encryption':
        // Verify if records are encrypted
        if (!table || !filters) {
          return new Response(
            JSON.stringify({ error: 'Missing table or filters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let query = supabaseClient.from(table).select('id, encryption_metadata');

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });

        const { data: records, error: verifyError } = await query.limit(1);

        if (verifyError) {
          return new Response(
            JSON.stringify({ error: verifyError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const isEncrypted = records && records.length > 0 && records[0].encryption_metadata !== null;

        return new Response(
          JSON.stringify({ encrypted: isEncrypted }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

