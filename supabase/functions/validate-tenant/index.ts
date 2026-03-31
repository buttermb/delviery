import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slug } = await req.json()
    
    if (!slug) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Missing slug' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      )
    }
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const { data: tenant, error } = await supabaseClient
      .from('tenants')
      .select('id, slug, subscription_status')
      .eq('slug', slug)
      .maybeSingle()

    if (error || !tenant) {
      console.error(`[validate-tenant] Tenant not found: ${slug}`)
      return new Response(
        JSON.stringify({ valid: false, error: 'Tenant not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 
        }
      )
    }
    
    console.error(`[validate-tenant] Valid tenant: ${slug}`)
    return new Response(
      JSON.stringify({ valid: true, tenant }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    )
  } catch (error) {
    console.error('[validate-tenant] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ valid: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
})
