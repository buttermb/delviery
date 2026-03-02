import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

// Request validation schema
const RequestSchema = z.object({
  sku: z.string().min(1).max(50),
  tenant_id: z.string().uuid(),
});

// Simple Code128 SVG generator - fallback when external API fails
// Note: This generates a visual representation but may not be scanner-readable
function generateFallbackBarcodeSVG(data: string): string {
  const width = 250;
  const height = 80;
  const barWidth = 2;
  const barHeight = 50;
  const startX = 20;
  const textY = height - 8;

  // Generate pseudo-random bars based on the data string
  // This creates a visual barcode pattern (not a real Code128 encoding)
  let bars = '';
  let x = startX;

  // Start pattern
  for (let i = 0; i < 3; i++) {
    bars += `<rect x="${x}" y="10" width="${barWidth}" height="${barHeight}" fill="black"/>`;
    x += barWidth * 2;
  }
  x += barWidth;

  // Data pattern - create bars based on character codes
  for (let i = 0; i < data.length && x < width - 40; i++) {
    const charCode = data.charCodeAt(i);
    // Create varying bar patterns
    for (let j = 0; j < 4; j++) {
      const isBar = ((charCode >> j) & 1) === 1;
      if (isBar) {
        bars += `<rect x="${x}" y="10" width="${barWidth}" height="${barHeight}" fill="black"/>`;
      }
      x += barWidth;
    }
    x += barWidth; // Space between characters
  }

  // End pattern
  for (let i = 0; i < 3; i++) {
    bars += `<rect x="${x}" y="10" width="${barWidth}" height="${barHeight}" fill="black"/>`;
    x += barWidth * 2;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="white"/>
  ${bars}
  <text x="${width/2}" y="${textY}" text-anchor="middle" font-family="monospace" font-size="12">${data}</text>
</svg>`;
}

// Fetch with timeout helper
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
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
          details: (validationResult as { success: false; error: { errors: unknown[] } }).error.errors
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { sku, tenant_id } = validationResult.data;

    // Generate barcode using external API (barcodeapi.org) or create SVG fallback
    const barcodeApiUrl = `https://barcodeapi.org/api/code128/${encodeURIComponent(sku)}`;

    let barcodeImageData: Uint8Array;
    let contentType = 'image/png';
    let isFallback = false;

    try {
      // Try to fetch from barcode API with 5 second timeout
      const barcodeResponse = await fetchWithTimeout(barcodeApiUrl, 5000);
      if (barcodeResponse.ok) {
        barcodeImageData = new Uint8Array(await barcodeResponse.arrayBuffer());
        // Verify we got actual image data
        if (barcodeImageData.length < 100) {
          throw new Error('Received invalid barcode image data');
        }
      } else {
        throw new Error(`Barcode API returned status ${barcodeResponse.status}`);
      }
    } catch (error) {
      // Fallback: Generate SVG barcode representation
      console.warn(`Barcode API failed for SKU ${sku}, using SVG fallback:`, error);
      const barcodeSvg = generateFallbackBarcodeSVG(sku);
      barcodeImageData = new TextEncoder().encode(barcodeSvg);
      contentType = 'image/svg+xml';
      isFallback = true;
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
        sku: sku,
        is_fallback: isFallback,
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

