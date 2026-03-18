import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { productName, category, strainType } = await req.json();

    // Generate appropriate prompt based on product type
    let prompt = '';
    
    if (category === 'flower') {
      prompt = `Ultra high resolution professional product photography of ${productName} cannabis flower buds. 
      Dense, frosty trichome-covered ${strainType || 'hybrid'} strain buds on a clean white background. 
      Show detailed crystal formations, vibrant colors ranging from deep green to purple hues, and orange pistils. 
      Studio lighting, macro photography, shallow depth of field. Commercial cannabis product photo style.`;
    } else if (category === 'concentrates') {
      prompt = `Ultra high resolution professional product photography of ${productName} cannabis concentrate. 
      Golden amber colored shatter or wax on a clean white background. Glass-like consistency with clarity. 
      Studio lighting showing translucency and purity. Commercial cannabis product photo style.`;
    } else if (category === 'edibles') {
      prompt = `Ultra high resolution professional product photography of ${productName} cannabis edibles. 
      Colorful gummies or chocolate on a clean white background. Appealing food photography style. 
      Studio lighting, vibrant colors, professional presentation.`;
    } else if (category === 'vapes') {
      prompt = `Ultra high resolution professional product photography of ${productName} cannabis vape cartridge. 
      Premium glass cartridge with golden oil on a clean white background. 
      Studio lighting showing clarity and quality. Commercial cannabis product photo style.`;
    }

    console.log('Generating image with prompt:', prompt);

    // Call Lovable AI API to generate image
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        modalities: ['image', 'text']
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', errorText);
      throw new Error(`AI API error: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error('No image generated');
    }

    console.log('Image generated successfully');

    return new Response(
      JSON.stringify({ imageUrl }),
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