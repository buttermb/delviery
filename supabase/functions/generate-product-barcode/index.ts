import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

// Request validation schema
const RequestSchema = z.object({
  sku: z.string().min(1).max(50),
  tenant_id: z.string().uuid(),
});

// Simple Code128 SVG generator (basic implementation)
function generateCode128SVG(data: string): string {
  // This is a simplified version - in production, use a proper barcode library
  // For now, we'll create a basic SVG that can be enhanced later
  const width = 200;
  const height = 100;
  
  // Basic SVG structure - actual barcode encoding would go here
  // Using a placeholder that will be replaced with proper barcode generation
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="white"/>
  <text x="${width/2}" y="${height/2}" text-anchor="middle" font-family="monospace" font-size="14">${data}</text>
  <text x="${width/2}" y="${height - 10}" text-anchor="middle" font-family="monospace" font-size="12">CODE128</text>
</svg>`;
}

serve(withZenProtection(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate request body
    const rawBody = await req.json();
    const validationResult = RequestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid input',
          details: validationResult.error.errors
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { sku, tenant_id } = validationResult.data;

    // Generate barcode using external API (barcodeapi.org) or create SVG
    // For MVP, we'll use barcodeapi.org which provides free Code128 barcodes
    const barcodeApiUrl = `https://barcodeapi.org/api/code128/${sku}`;
    
    let barcodeImageData: Uint8Array;
    let contentType = 'image/png';
    
    try {
      // Try to fetch from barcode API
      const barcodeResponse = await fetch(barcodeApiUrl);
      if (barcodeResponse.ok) {
        barcodeImageData = new Uint8Array(await barcodeResponse.arrayBuffer());
      } else {
        // Fallback: Generate simple SVG
        const barcodeSvg = generateCode128SVG(sku);
        barcodeImageData = new TextEncoder().encode(barcodeSvg);
        contentType = 'image/svg+xml';
      }
    } catch (error) {
      // Fallback: Generate simple SVG
      const barcodeSvg = generateCode128SVG(sku);
      barcodeImageData = new TextEncoder().encode(barcodeSvg);
      contentType = 'image/svg+xml';
    }
    
    // Upload to Supabase Storage
    const fileExtension = contentType === 'image/svg+xml' ? 'svg' : 'png';
    const storagePath = `${tenant_id}/barcodes/${sku}.${fileExtension}`;
    const bucketName = 'product-barcodes';

    // Check if bucket exists, create if not
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === bucketName);
    
    if (!bucketExists) {
      // Create bucket with public access for barcodes
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/svg+xml', 'image/png'],
        fileSizeLimit: 1048576 // 1MB
      });
      
      if (createError && !createError.message.includes('already exists')) {
        throw createError;
      }
    }

    // Upload barcode image to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, barcodeImageData, {
        contentType: contentType,
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    const barcodeUrl = urlData.publicUrl;

    return new Response(
      JSON.stringify({ 
        barcode_url: barcodeUrl,
        sku: sku
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}));

