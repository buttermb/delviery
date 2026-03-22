import { corsHeaders } from '../_shared/deps.ts';
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { validateMenuGenerate } from './validation.ts';
import { withCreditGate } from '../_shared/creditGate.ts';

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Wrap the handler with credit gating for free tier users (100 credits)
  return withCreditGate(req, 'menu_create', async (tenantId, serviceClient) => {
    try {
      const rawBody = await req.json();
      const {
        name,
        description,
        product_ids,
        min_order_quantity,
        max_order_quantity,
        security_settings,
        custom_prices,
        appearance_style,
        show_product_images,
        show_availability,
        show_contact_info,
        custom_message
      } = validateMenuGenerate(rawBody);

      console.error('Creating disposable menu:', { name, product_count: product_ids?.length });

      const generateAccessCode = (): string => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const randomBytes = new Uint8Array(8);
        crypto.getRandomValues(randomBytes);
        return Array.from(randomBytes, (b) => chars[b % chars.length]).join('');
      };

      const generateUrlToken = (): string => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        return Array.from(randomBytes, (b) => chars[b % chars.length]).join('');
      };

      const accessCode: string = (security_settings?.access_code as string) || generateAccessCode();
      const urlToken = generateUrlToken();

      console.error('Generated access code:', accessCode);

      // Hash the access code using SHA-256
      const encoder = new TextEncoder();
      const data = encoder.encode(accessCode);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const accessCodeHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      console.error('Generated hash:', accessCodeHash);

      // Get authenticated user for created_by field
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      const { data: { user } } = await serviceClient.auth.getUser(token);

      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate that all products belong to this tenant
      const { data: productsCheck, error: productsCheckError } = await serviceClient
        .from('wholesale_inventory')
        .select('id, tenant_id')
        .in('id', product_ids);

      if (productsCheckError) {
        console.error('Product validation error:', productsCheckError);
        return new Response(
          JSON.stringify({ error: 'Failed to validate products' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!productsCheck || productsCheck.length !== product_ids.length) {
        return new Response(
          JSON.stringify({ error: 'Some products not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify all products belong to the same tenant
      const invalidProducts = productsCheck.filter(p => p.tenant_id !== tenantId);
      if (invalidProducts.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Some products do not belong to your tenant' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.error('Creating menu with settings:', {
        name,
        description,
        product_count: product_ids.length,
        tenant_id: tenantId,
        security_settings,
        min_order_quantity,
        max_order_quantity
      });

      // Create the menu with all settings
      const { data: menu, error: menuError } = await serviceClient
        .from('disposable_menus')
        .insert({
          name,
          description,
          tenant_id: tenantId,
          access_code: accessCode,
          access_code_hash: accessCodeHash,
          encrypted_url_token: urlToken,
          status: 'active',
          created_by: user.id,
          min_order_quantity: min_order_quantity || 5,
          max_order_quantity: max_order_quantity || 50,
          security_settings: security_settings || {},
          appearance_style: appearance_style || 'professional',
          show_product_images: show_product_images !== false,
          show_availability: show_availability !== false,
          show_contact_info: show_contact_info || false,
          custom_message: custom_message || null,
        })
        .select()
        .single();

      if (menuError) {
        console.error('Menu creation error:', menuError);
        throw menuError;
      }

      console.error('Menu created successfully:', menu.id);

      // Create product associations in disposable_menu_products table
      const productAssociations = product_ids.map((productId: string, index: number) => ({
        menu_id: menu.id,
        product_id: productId,
        custom_price: custom_prices?.[productId] || null,
        display_availability: true,
        display_order: index
      }));

      console.error('Creating product associations:', productAssociations.length);

      const { data: products, error: productsError } = await serviceClient
        .from('disposable_menu_products')
        .insert(productAssociations)
        .select();

      if (productsError) {
        console.error('Product association error:', productsError);
        // Delete the menu if product association fails
        await serviceClient.from('disposable_menus').delete().eq('id', menu.id);
        throw new Error(`Failed to associate products: ${productsError.message}`);
      }

      console.error('Product associations created:', products.length);

      // Log security event
      await serviceClient.from('menu_security_events').insert({
        menu_id: menu.id,
        event_type: 'menu_created',
        severity: 'info',
        description: `Menu "${name}" created with ${products.length} products`,
        event_data: {
          menu_id: menu.id,
          access_code: accessCode,
          product_count: products.length
        }
      });

      const shareableUrl = `${req.headers.get('origin') || 'https://your-domain.com'}/m/${urlToken}`;

      return new Response(
        JSON.stringify({
          success: true,
          menu,
          products,
          access_code: accessCode,
          url_token: urlToken,
          shareable_url: shareableUrl
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error: unknown) {
      console.error('Error in menu-generate:', error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }); // End of withCreditGate
});
