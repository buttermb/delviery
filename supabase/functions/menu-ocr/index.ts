import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";
import { withZenProtection } from "../_shared/zen-firewall.ts";

// Request schema
const MenuOcrRequestSchema = z.object({
  // Base64 encoded image data
  imageData: z.string().min(100).max(10000000), // Max ~7.5MB base64 (5MB image)
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  options: z.object({
    enhanceReadability: z.boolean().optional().default(true),
    extractTabularData: z.boolean().optional().default(true),
    targetCategory: z.string().optional(),
  }).optional().default({}),
});

// OCR-specific Claude prompt
const OCR_CANNABIS_PROMPT = `You are an expert OCR and cannabis menu data extractor. Your task is to:

1. First, extract ALL text visible in this image with high accuracy
2. Then, parse that text into structured cannabis product data

## Image Analysis Guidelines
- Look for tabular layouts (columns, rows, grids)
- Identify handwritten vs printed text
- Note any watermarks or background patterns to ignore
- Handle rotated or skewed text
- Pay attention to headers and column labels

## Text Extraction Priority
1. Product/strain names (often larger or bold)
2. Prices (look for $ symbols, number patterns)
3. THC/CBD percentages (XX% format)
4. Quantities/weights
5. Category indicators
6. Quality descriptors

## Common Menu Layouts
- **List format**: Each line is a product with inline details
- **Table format**: Headers define columns, products in rows
- **Card format**: Products in boxes/sections
- **Price list**: Name followed by price tiers

## Output Format
Return JSON with this structure:
{
  "rawTextExtracted": string,  // All text seen in image
  "products": [
    {
      "name": string,
      "category": "flower"|"concentrate"|"edible"|"preroll"|"vape"|"tincture"|"topical"|"other",
      "strainType": "indica"|"sativa"|"hybrid"|"unknown",
      "thcPercentage": number|null,
      "cbdPercentage": number|null,
      "prices": {
        "unit"?: number,
        "eighth"?: number,
        "quarter"?: number,
        "half"?: number,
        "ounce"?: number,
        "quarterPound"?: number,
        "halfPound"?: number,
        "pound"?: number
      },
      "quantity": number|null,
      "quantityUnit": string|null,
      "quality": "exotic"|"indoor"|"greenhouse"|"outdoor"|"mixed"|"unknown",
      "lineage": string|null,
      "notes": string|null,
      "confidence": number,
      "boundingBox": {
        "description": string  // e.g., "top-left section", "row 3"
      }
    }
  ],
  "imageQuality": {
    "readability": "good"|"fair"|"poor",
    "issues": string[]  // e.g., ["blurry text in bottom section", "low contrast"]
  },
  "layoutDetected": "list"|"table"|"card"|"mixed"|"unknown"
}

## Cannabis Knowledge Reference

### Weight Abbreviations
- lb/lbs = pound
- oz/z/zip = ounce
- qp = quarter pound
- hp = half pound
- g = gram
- 1/8, 8th = eighth ounce

### Price Patterns
- "$2.2k" or "2200" = $2,200
- "22/zip" = $22/ounce
- Multiple prices often mean tiered pricing (more quantity = lower price)

### Category Keywords
- Flower: bud, flower, nug, shake, smalls
- Concentrate: wax, shatter, rosin, live, diamonds, sauce, hash
- Edible: gummy, chocolate, candy, mg
- Preroll: joint, pre-roll, blunt
- Vape: cart, pod, disposable

### Quality Indicators
- Exotic/Top: exotic, za, zaza, fire, gas
- Indoor: indoor, light dep
- Greenhouse: gh, greenhouse
- Outdoor: out, outdoor, deps

Return ONLY valid JSON (no markdown code blocks, no explanations):`;

serve(withZenProtection(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client and verify auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!anthropicApiKey) {
      console.error("Missing ANTHROPIC_API_KEY environment variable");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user authentication
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parseResult = MenuOcrRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid request body", 
          details: parseResult.error.issues 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageData, mimeType, options } = parseResult.data;

    // Validate base64 format
    const base64Regex = /^[A-Za-z0-9+/]+=*$/;
    // Remove data URL prefix if present
    let cleanImageData = imageData;
    if (imageData.includes(',')) {
      cleanImageData = imageData.split(',')[1];
    }
    
    if (!base64Regex.test(cleanImageData.replace(/\s/g, ''))) {
      return new Response(
        JSON.stringify({ error: "Invalid base64 image data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context prompt
    let contextAdditions = "";
    if (options.targetCategory) {
      contextAdditions += `\nFocus primarily on ${options.targetCategory} products.\n`;
    }
    if (options.enhanceReadability) {
      contextAdditions += "\nPay extra attention to partially visible or faded text.\n";
    }
    if (options.extractTabularData) {
      contextAdditions += "\nLook for tabular structures and maintain row/column relationships.\n";
    }

    // Call Claude API with vision
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: cleanImageData,
                },
              },
              {
                type: "text",
                text: `${OCR_CANNABIS_PROMPT}${contextAdditions}`,
              },
            ],
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("Claude Vision API error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI OCR service error", details: errorText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claudeResult = await claudeResponse.json();
    const aiContent = claudeResult.content?.[0]?.text;

    if (!aiContent) {
      return new Response(
        JSON.stringify({ error: "No response from AI OCR service" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the AI response
    let ocrResult: unknown;
    try {
      // Clean up potential markdown
      let cleanedContent = aiContent.trim();
      if (cleanedContent.startsWith("```json")) {
        cleanedContent = cleanedContent.slice(7);
      } else if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent.slice(3);
      }
      if (cleanedContent.endsWith("```")) {
        cleanedContent = cleanedContent.slice(0, -3);
      }
      cleanedContent = cleanedContent.trim();

      ocrResult = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse OCR response as JSON:", parseError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to parse OCR response", 
          rawResponse: aiContent.slice(0, 1000) 
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = ocrResult as Record<string, unknown>;
    
    // Enhance products with IDs and validation
    const products = (result.products || []) as Array<Record<string, unknown>>;
    const enhancedProducts = products.map((product, index) => {
      const enhanced = {
        id: crypto.randomUUID(),
        rowNumber: index + 1,
        name: product.name || `Unknown Product ${index + 1}`,
        category: product.category || "other",
        strainType: product.strainType || "unknown",
        thcPercentage: typeof product.thcPercentage === "number" ? product.thcPercentage : null,
        cbdPercentage: typeof product.cbdPercentage === "number" ? product.cbdPercentage : null,
        prices: product.prices || {},
        quantity: typeof product.quantity === "number" ? product.quantity : null,
        quantityUnit: product.quantityUnit || null,
        quality: product.quality || "unknown",
        lineage: product.lineage || null,
        notes: product.notes || null,
        confidence: typeof product.confidence === "number" ? product.confidence : 0.5,
        boundingBox: product.boundingBox || null,
        validationWarnings: [] as string[],
      };

      // Add validation warnings
      const prices = enhanced.prices as Record<string, number>;
      if (enhanced.thcPercentage && enhanced.thcPercentage > 35) {
        enhanced.validationWarnings.push(`High THC (${enhanced.thcPercentage}%) - verify`);
      }
      if (prices.pound && (prices.pound < 500 || prices.pound > 4000)) {
        enhanced.validationWarnings.push(`Unusual lb price: $${prices.pound}`);
      }
      if (!enhanced.name || enhanced.name.includes("Unknown")) {
        enhanced.validationWarnings.push("Name not clearly read");
        enhanced.confidence = Math.min(enhanced.confidence, 0.4);
      }

      return enhanced;
    });

    // Build summary
    const summary = {
      totalProducts: enhancedProducts.length,
      byCategory: {} as Record<string, number>,
      byQuality: {} as Record<string, number>,
      averageConfidence: 0,
      productsWithWarnings: 0,
      imageQuality: result.imageQuality || { readability: "unknown", issues: [] },
      layoutDetected: result.layoutDetected || "unknown",
    };

    for (const product of enhancedProducts) {
      summary.byCategory[product.category] = (summary.byCategory[product.category] || 0) + 1;
      summary.byQuality[product.quality] = (summary.byQuality[product.quality] || 0) + 1;
      if (product.validationWarnings.length > 0) {
        summary.productsWithWarnings++;
      }
      summary.averageConfidence += product.confidence;
    }
    
    if (enhancedProducts.length > 0) {
      summary.averageConfidence /= enhancedProducts.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        rawTextExtracted: result.rawTextExtracted || "",
        products: enhancedProducts,
        summary,
        metadata: {
          parsedAt: new Date().toISOString(),
          inputType: "image",
          mimeType,
          model: "claude-sonnet-4-20250514",
        },
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: unknown) {
    console.error("Menu OCR error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));




