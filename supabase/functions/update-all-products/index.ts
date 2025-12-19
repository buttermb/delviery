import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Enhanced product data with proper descriptions
    const productUpdates = [
      // Flower products
      {
        name: 'Gelato #41 Premium',
        description: 'Top-shelf Gelato phenotype #41. Dense purple-tinged buds covered in frosty trichomes. Sweet creamy flavors with hints of berry and citrus. Balanced hybrid perfect for any time use. Lab-tested at 30.2% THCa.',
        prices: { '3.5g': 65, '7g': 117, '14g': 214.5, '28g': 390 },
        strain_type: 'hybrid',
        effects: ['relaxed', 'happy', 'uplifted', 'creative']
      },
      {
        name: 'OG Kush Classic',
        description: 'Legendary OG Kush strain with authentic genetics. Pine and earth flavors with diesel undertones. Powerful indica-dominant effects ideal for evening relaxation and pain relief. Dense, resinous buds with 24.3% THCa.',
        prices: { '3.5g': 55, '7g': 99, '14g': 181.5, '28g': 330 },
        strain_type: 'indica',
        effects: ['relaxed', 'sleepy', 'euphoric', 'happy']
      },
      {
        name: 'Wedding Cake Premium',
        description: 'Elite Wedding Cake phenotype with stunning purple and white coloration. Sweet vanilla and earthy flavors with a smooth, creamy exhale. Potent indica-dominant effects for deep relaxation. Premium quality at 27.8% THCa.',
        prices: { '3.5g': 70, '7g': 126, '14g': 231, '28g': 420 },
        strain_type: 'indica',
        effects: ['relaxed', 'happy', 'euphoric', 'sleepy']
      },
      {
        name: 'Gelato THCA Flower',
        description: 'Classic Gelato strain with balanced hybrid effects. Sweet dessert-like flavors reminiscent of ice cream and berries. Smooth smoke and beautiful trichome coverage. Perfect for daytime or evening use at 22.3% THCa.',
        prices: { '3.5g': 48, '7g': 86.4, '14g': 158.4, '28g': 288 },
        strain_type: 'hybrid',
        effects: ['happy', 'relaxed', 'uplifted', 'creative']
      },
      {
        name: 'OG Kush THCA Flower',
        description: 'Legendary indica strain perfect for deep relaxation and stress relief. Classic OG flavors of pine, earth, and lemon. Known for powerful body effects and mental calm. Premium indoor-grown at 25.8% THCa.',
        prices: { '3.5g': 50, '7g': 90, '14g': 165, '28g': 300 },
        strain_type: 'indica',
        effects: ['relaxed', 'sleepy', 'happy', 'euphoric']
      },
      {
        name: 'Purple Haze THCA Flower',
        description: 'Classic sativa-dominant strain with uplifting cerebral effects. Sweet berry and earthy flavors with a hint of spice. Energizing and creative, perfect for daytime activities. Vibrant purple hues at 23.5% THCa.',
        prices: { '3.5g': 45, '7g': 81, '14g': 148.5, '28g': 270 },
        strain_type: 'sativa',
        effects: ['energizing', 'creative', 'uplifted', 'focused']
      },
      {
        name: 'Jeeters Gelato Infused',
        description: 'Premium Jeeters infused pre-roll enhanced with cannabis oil for maximum potency. Sweet Gelato strain with dessert-like flavors. Balanced hybrid effects perfect for sharing or solo sessions. 32.4% THCa with added concentrate.',
        prices: { '3.5g': 55, '7g': 99, '14g': 181.5, '28g': 330 },
        strain_type: 'hybrid',
        effects: ['happy', 'relaxed', 'euphoric', 'uplifted']
      },
      {
        name: 'Jeeters Runtz XL',
        description: 'Jeeters XL pre-roll featuring exotic Runtz strain. Candy-like flavors with tropical fruit notes and a sweet finish. Balanced hybrid effects suitable for any time of day. Premium quality at 29.7% THCa.',
        prices: { '3.5g': 60, '7g': 108, '14g': 198, '28g': 360 },
        strain_type: 'hybrid',
        effects: ['happy', 'uplifted', 'relaxed', 'creative']
      },
      {
        name: 'Sluggers Blueberry Cookies',
        description: 'Premium Sluggers pre-roll featuring Blueberry Cookies strain. Indica-dominant hybrid with sweet blueberry and cookie dough flavors. Relaxing effects perfect for evening unwinding. High-quality flower at 28.5% THCa.',
        prices: { '3.5g': 45, '7g': 81, '14g': 148.5, '28g': 270 },
        strain_type: 'indica',
        effects: ['relaxed', 'happy', 'sleepy', 'euphoric']
      },
      {
        name: 'Sluggers Sunset Sherbet',
        description: 'Sluggers premium flower featuring Sunset Sherbet strain. Indica-dominant with fruity citrus notes and creamy undertones. Powerful relaxation with award-winning genetics. Top-shelf quality at 26.8% THCa.',
        prices: { '3.5g': 50, '7g': 90, '14g': 165, '28g': 300 },
        strain_type: 'indica',
        effects: ['relaxed', 'happy', 'euphoric', 'uplifted']
      },
    ];

    // Update flower products
    for (const update of productUpdates) {
      const { error } = await supabase
        .from('products')
        .update({
          description: update.description,
          prices: update.prices,
          strain_type: update.strain_type,
          effects: update.effects
        })
        .eq('name', update.name)
        .eq('category', 'flower');

      if (error) {
        console.error(`Error updating ${update.name}:`, error);
      } else {
        console.log(`Updated ${update.name}`);
      }
    }

    // Update concentrates to have proper pricing
    await supabase
      .from('products')
      .update({
        prices: { '1g': 55 }
      })
      .eq('name', 'Golden Shatter - Gelato');

    await supabase
      .from('products')
      .update({
        prices: { '1g': 65 }
      })
      .eq('name', 'Live Resin Sugar - Blue Dream');

    await supabase
      .from('products')
      .update({
        prices: { '1g': 65 },
        description: 'Premium solventless live rosin extraction. Full-spectrum terpene profile with maximum flavor retention. Golden colored, sticky consistency perfect for dabbing. No solvents used, just heat and pressure. 88.7% THCa purity.'
      })
      .eq('name', 'Live Rosin');

    await supabase
      .from('products')
      .update({
        prices: { '1g': 70 },
        description: 'Pure crystalline THCA diamonds with 95.2% potency. Nearly pure THCa in crystalline form with incredible clarity. For experienced users seeking maximum potency. Perfect for dabbing at low temperatures.'
      })
      .eq('name', 'THCA Diamonds');

    // Update vapes
    await supabase
      .from('products')
      .update({
        prices: { '1g': 65 },
        description: 'Premium live resin vape cartridge featuring Blue Dream strain. Full-spectrum cannabis oil preserving natural terpenes. Smooth vapor with sweet berry flavors. 510-thread compatible, lab-tested at 85.6% THCa.'
      })
      .eq('name', 'Live Resin Vape - Blue Dream');

    await supabase
      .from('products')
      .update({
        prices: { '1g': 55 },
        description: 'Live resin vape cartridge with classic Sour Diesel strain. Strain-specific terpenes for authentic diesel and citrus flavors. Energizing sativa effects in convenient vape form. 82.5% THCa with natural cannabis terpenes.'
      })
      .eq('name', 'Live Resin Vape Cart - Sour Diesel');

    return new Response(
      JSON.stringify({ message: 'Products updated successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});