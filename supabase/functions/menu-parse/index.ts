// Edge runtime types omitted to avoid OpenAI dependency
import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";
import { withZenProtection } from "../_shared/zen-firewall.ts";
import { sanitizeString } from "../_shared/validation.ts";

// Request schema
const MenuParseRequestSchema = z.object({
  content: z.string().min(1).max(100000), // Max 100KB of text
  format: z.enum(['excel_data', 'csv_data', 'text', 'structured']),
  options: z.object({
    detectDuplicates: z.boolean().optional().default(true),
    strictValidation: z.boolean().optional().default(false),
    targetCategory: z.string().optional(),
  }).optional().default({}),
});

// Master prompt for cannabis menu parsing
const CANNABIS_PARSING_PROMPT = `You are an expert cannabis wholesale data parser. Your task is to extract structured product data from messy, unstructured cannabis menu text.

## Context
You're parsing wholesale cannabis inventory data that may come from:
- Pasted spreadsheet data (tab/comma separated)
- Text messages or notes
- OCR from images
- Various document formats

## Output Format
Return a JSON array of products. Each product must have this structure:
{
  "name": string,           // Product/strain name (required)
  "category": string,       // flower|concentrate|edible|preroll|vape|tincture|topical|other
  "strainType": string,     // indica|sativa|hybrid|unknown
  "thcPercentage": number|null,
  "cbdPercentage": number|null,
  "prices": {
    "unit"?: number,        // Per unit/gram price
    "eighth"?: number,      // 1/8 oz price
    "quarter"?: number,     // 1/4 oz price  
    "half"?: number,        // 1/2 oz price
    "ounce"?: number,       // 1 oz price
    "quarterPound"?: number, // QP price
    "halfPound"?: number,   // HP price
    "pound"?: number        // LB price
  },
  "quantity": number|null,  // Available quantity (in units or lbs)
  "quantityUnit": string,   // "lbs"|"units"|"oz"|"g"|null
  "quality": string,        // exotic|indoor|greenhouse|outdoor|mixed|unknown
  "lineage": string|null,   // Parent strains
  "effects": string[],      // Array of effects
  "notes": string|null,     // Additional notes
  "confidence": number      // 0-1 confidence score for this parse
}

## Cannabis Knowledge Base

### Weight Conversions
- 1 lb = 16 oz = 448g
- 1 oz = 28g
- 1/8 oz = 3.5g
- QP = Quarter Pound = 4 oz
- HP = Half Pound = 8 oz
- Zip/Z = 1 oz

### Price Pattern Recognition
- "$2.2k" or "2200" for lb = $2,200/lb
- "$150/oz" or "150z" = $150/oz
- "22/zip" = $22/ounce (likely per unit or eighth)
- Tiered pricing: "2k/1800/1600" = prices at different quantities

### Category Keywords
- Flower: bud, flower, nug, shake, trim, smalls
- Concentrate: wax, shatter, live resin, rosin, diamonds, sauce, badder, crumble, hash
- Edible: gummy, chocolate, cookie, brownie, candy, mg, milligram
- Preroll: joint, preroll, pre-roll, blunt, infused
- Vape: cart, cartridge, pod, disposable, pen
- Tincture: tincture, drops, sublingual, oil
- Topical: cream, lotion, balm, salve, patch

### Quality Tiers
- Exotic/Top-shelf: exotic, exo, za, zaza, top, fire, gas, loud
- Indoor: indoor, in, light dep
- Greenhouse: greenhouse, gh, deps, mixed light
- Outdoor: outdoor, out, sun-grown, dep

### Stock Status Indicators
- In stock: available, in, yes, ✓, have, got
- Low stock: limited, few, running low, last
- Out of stock: out, no, sold, gone, x, -

### Common Strain Database (for validation)
Known strains and their genetics:
- OG Kush: Hybrid
- Blue Dream: Sativa-dominant
- Girl Scout Cookies (GSC): Hybrid
- Gorilla Glue (GG4): Hybrid
- Wedding Cake: Indica-dominant
- Gelato: Hybrid
- Zkittlez: Indica
- Purple Punch: Indica
- Runtz: Hybrid
- Biscotti: Indica

## Parsing Rules
1. Always extract the product name first
2. Look for THC percentages (15-35% common range, flag >35% for review)
3. Parse all price points mentioned
4. Detect quantity/availability when present
5. Classify quality tier from descriptors
6. Assign confidence score based on data completeness

## Error Handling
- If a field is unclear, set it to null with lower confidence
- Flag prices that seem unusually high (>$4000/lb) or low (<$500/lb)
- Note any parsing ambiguities in the "notes" field

Parse the following menu data and return ONLY valid JSON (no markdown, no explanation):`;

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
    console.log("menu-parse: Request received");
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lovableApiKey) {
      console.error("Missing LOVABLE_API_KEY environment variable");
      return new Response(
        JSON.stringify({ error: "AI service not configured. LOVABLE_API_KEY is required." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract token from Authorization header
    const authHeader = req.headers.get("Authorization");
    console.log("menu-parse: Auth header present:", !!authHeader);
    
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("menu-parse: No valid authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const token = authHeader.substring(7); // Remove "Bearer " prefix
    
    // Create client with the user's JWT to verify auth
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Verify the JWT by getting the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    console.log("menu-parse: Auth result - user:", !!user, "error:", authError?.message);
    
    if (authError || !user) {
      console.error("menu-parse: Auth failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("menu-parse: User authenticated:", user.id);

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

    const parseResult = MenuParseRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid request body", 
          details: (parseResult as { success: false; error: { issues: unknown[] } }).error.issues 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { content, format, options } = parseResult.data;
    const sanitizedContent = sanitizeString(content);

    // Build the prompt based on format
    let contextPrefix = "";
    switch (format) {
      case "excel_data":
        contextPrefix = "This is tab-separated data from a spreadsheet. The first row may be headers:\n\n";
        break;
      case "csv_data":
        contextPrefix = "This is comma-separated data. The first row may be headers:\n\n";
        break;
      case "text":
        contextPrefix = "This is freeform text/notes containing product information:\n\n";
        break;
      case "structured":
        contextPrefix = "This is already partially structured data:\n\n";
        break;
    }

    // Add target category context if provided
    let categoryContext = "";
    if (options.targetCategory) {
      categoryContext = `\nNote: Focus primarily on ${options.targetCategory} products.\n`;
    }

    console.log("Calling Lovable AI Gateway for menu parsing...");

    // Call Lovable AI Gateway (OpenAI-compatible API)
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: CANNABIS_PARSING_PROMPT + categoryContext,
          },
          {
            role: "user",
            content: contextPrefix + sanitizedContent,
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lovable AI Gateway error:", aiResponse.status, errorText);
      
      // Handle rate limiting
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Handle payment required
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI parsing service error", details: errorText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices?.[0]?.message?.content;

    if (!aiContent) {
      console.error("No content in AI response:", JSON.stringify(aiResult));
      return new Response(
        JSON.stringify({ error: "No response from AI service" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the AI response as JSON
    let parsedProducts: unknown[];
    try {
      // Clean up potential markdown code blocks
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

      parsedProducts = JSON.parse(cleanedContent);
      
      if (!Array.isArray(parsedProducts)) {
        parsedProducts = [parsedProducts];
      }
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to parse AI response", 
          rawResponse: aiContent.slice(0, 500) 
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Basic validation and enhancement of parsed products
    const enhancedProducts = parsedProducts.map((product: unknown, index: number) => {
      const p = product as Record<string, unknown>;
      return {
        id: crypto.randomUUID(),
        rowNumber: index + 1,
        name: p.name || `Unknown Product ${index + 1}`,
        category: p.category || "other",
        strainType: p.strainType || "unknown",
        thcPercentage: typeof p.thcPercentage === "number" ? p.thcPercentage : null,
        cbdPercentage: typeof p.cbdPercentage === "number" ? p.cbdPercentage : null,
        prices: p.prices || {},
        quantity: typeof p.quantity === "number" ? p.quantity : null,
        quantityUnit: p.quantityUnit || null,
        quality: p.quality || "unknown",
        lineage: p.lineage || null,
        effects: Array.isArray(p.effects) ? p.effects : [],
        notes: p.notes || null,
        confidence: typeof p.confidence === "number" ? p.confidence : 0.5,
        validationWarnings: [] as string[],
      };
    });

    // Add validation warnings
    for (const product of enhancedProducts) {
      // Check for unusually high THC
      if (product.thcPercentage && product.thcPercentage > 35) {
        product.validationWarnings.push(`THC percentage (${product.thcPercentage}%) is unusually high - verify accuracy`);
      }
      
      // Check for suspicious prices
      const prices = product.prices as Record<string, number>;
      if (prices.pound && prices.pound < 500) {
        product.validationWarnings.push(`Price per pound ($${prices.pound}) seems unusually low`);
      }
      if (prices.pound && prices.pound > 4000) {
        product.validationWarnings.push(`Price per pound ($${prices.pound}) seems unusually high`);
      }
      
      // Check for missing required data
      if (!product.name || product.name.includes("Unknown")) {
        product.validationWarnings.push("Product name could not be determined");
        product.confidence = Math.min(product.confidence, 0.3);
      }
      
      if (Object.keys(prices).length === 0) {
        product.validationWarnings.push("No pricing information found");
        product.confidence = Math.min(product.confidence, 0.5);
      }
    }

    // Calculate summary stats
    const summary = {
      totalProducts: enhancedProducts.length,
      byCategory: {} as Record<string, number>,
      byQuality: {} as Record<string, number>,
      averageConfidence: 0,
      productsWithWarnings: 0,
    };

    for (const product of enhancedProducts) {
      // Count by category
      summary.byCategory[product.category] = (summary.byCategory[product.category] || 0) + 1;
      // Count by quality
      summary.byQuality[product.quality] = (summary.byQuality[product.quality] || 0) + 1;
      // Count warnings
      if (product.validationWarnings.length > 0) {
        summary.productsWithWarnings++;
      }
      // Sum confidence
      summary.averageConfidence += product.confidence;
    }
    
    if (enhancedProducts.length > 0) {
      summary.averageConfidence /= enhancedProducts.length;
    }

    console.log(`Successfully parsed ${enhancedProducts.length} products`);

    return new Response(
      JSON.stringify({
        success: true,
        products: enhancedProducts,
        summary,
        metadata: {
          parsedAt: new Date().toISOString(),
          inputFormat: format,
          inputLength: content.length,
          model: "google/gemini-2.5-flash",
        },
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: unknown) {
    console.error("Menu parse error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
