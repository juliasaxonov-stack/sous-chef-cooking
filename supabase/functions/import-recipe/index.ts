import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Canonical unit vocabulary (P2)
const UNIT_INSTRUCTIONS = `
Normalize all units to one of these canonical values (use the singular form):
  Volume: tsp, tbsp, fl oz, cup, pt, qt, gal, ml, l
  Weight: oz, lb, g, kg
  Count: piece, slice, clove, sprig, bunch, pinch, dash, drop, can, package
  Other: inch, cm
If a unit doesn't fit, use the closest canonical match or leave empty.`;

// Quantity normalization instructions (P1)
const QUANTITY_INSTRUCTIONS = `
Convert all quantities to decimal numbers as strings:
  "½" → "0.5", "1/3" → "0.333", "2½" → "2.5", "one" → "1"
If there is a range (e.g. "2-3"), use the midpoint as a string (e.g. "2.5").
If no quantity, omit the field.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Step 1: Scrape with Firecrawl
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http")) formattedUrl = `https://${formattedUrl}`;

    console.log("Scraping:", formattedUrl);

    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    const scrapeData = await scrapeRes.json();
    if (!scrapeRes.ok) {
      console.error("Firecrawl error:", scrapeData);
      if (scrapeRes.status === 402) {
        return new Response(JSON.stringify({ error: "Firecrawl credits exhausted. Please top up your Firecrawl plan." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(scrapeData.error || "Failed to scrape page");
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    if (!markdown) throw new Error("No content found on that page");

    console.log("Scraped content length:", markdown.length);

    // Step 2: Extract recipe with AI
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You extract recipes from web content. Return structured JSON only.
${QUANTITY_INSTRUCTIONS}
${UNIT_INSTRUCTIONS}
If the page is not a recipe, return {"error": "not_a_recipe"}.`,
          },
          {
            role: "user",
            content: `Extract the recipe from this page content.

Page content:
${markdown.slice(0, 8000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_recipe",
              description: "Extract structured recipe data from web page content",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  servings: { type: "number", description: "Number of servings as integer" },
                  cuisine: { type: "string", description: "Cuisine type, e.g. Italian, Mexican" },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Short descriptive tags, e.g. ['vegetarian', 'quick']",
                  },
                  ingredients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        original_text: { type: "string", description: "Exact original ingredient line" },
                        name: { type: "string", description: "Ingredient name only, no preparation" },
                        canonical_name: { type: "string", description: "Normalized ingredient name" },
                        quantity: { type: "string", description: "Decimal number as string, e.g. '0.5', '2.5'" },
                        unit: { type: "string", description: "Canonical unit from the approved vocabulary" },
                        preparation: { type: "string", description: "Preparation note, e.g. 'diced'" },
                        optional: { type: "boolean" },
                      },
                      required: ["name"],
                    },
                  },
                  steps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        instruction: { type: "string" },
                        duration_minutes: { type: "number", description: "Estimated duration in minutes as integer, if mentioned" },
                        action_type: { type: "string", description: "One of: prep, mix, cook, bake, rest, chill, serve" },
                      },
                      required: ["instruction"],
                    },
                  },
                  error: { type: "string" },
                },
                required: ["title"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_recipe" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI extraction failed");
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return structured data");

    const recipe = JSON.parse(toolCall.function.arguments);

    if (recipe.error) {
      return new Response(JSON.stringify({ error: "This doesn't appear to be a recipe page" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Extracted recipe:", recipe.title, "ingredients:", recipe.ingredients?.length, "steps:", recipe.steps?.length);

    return new Response(JSON.stringify(recipe), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-recipe error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
