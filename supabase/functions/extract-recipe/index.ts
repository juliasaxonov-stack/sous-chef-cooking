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
If a unit doesn't fit, use the closest canonical match or leave empty.
Store the exact original text in original_text.`;

// Quantity normalization instructions (P1)
const QUANTITY_INSTRUCTIONS = `
Convert all quantities to decimal numbers as strings:
  "½" → "0.5", "1/3" → "0.333", "2½" → "2.5", "one" → "1"
If there is a range (e.g. "2-3"), use the midpoint as a string (e.g. "2.5").
If no quantity, omit the field.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Please paste a longer recipe text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
            content: `You extract structured recipe data from raw text. Always return complete data.
${QUANTITY_INSTRUCTIONS}
${UNIT_INSTRUCTIONS}`,
          },
          {
            role: "user",
            content: `Extract the recipe from this text. Return structured JSON.

Text:
${text.slice(0, 10000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_recipe",
              description: "Extract structured recipe data from raw text",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Recipe title" },
                  servings: { type: "number", description: "Number of servings as an integer" },
                  cuisine: { type: "string", description: "Cuisine type, e.g. Italian, Mexican, Japanese" },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Short descriptive tags, e.g. ['vegetarian', 'quick', 'gluten-free']",
                  },
                  ingredients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        original_text: { type: "string", description: "Exact original ingredient line" },
                        name: { type: "string", description: "Ingredient name only, no preparation" },
                        canonical_name: { type: "string", description: "Normalized ingredient name, e.g. 'all-purpose flour'" },
                        quantity: { type: "string", description: "Decimal number as string, e.g. '0.5', '2.5'" },
                        unit: { type: "string", description: "Canonical unit from the approved vocabulary" },
                        preparation: { type: "string", description: "Preparation note, e.g. 'diced', 'at room temperature'" },
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
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      throw new Error("AI extraction failed");
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return structured data");

    const recipe = JSON.parse(toolCall.function.arguments);

    if (recipe.error) {
      return new Response(JSON.stringify({ error: "Could not extract a recipe from this text" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Extracted recipe:", recipe.title, "ingredients:", recipe.ingredients?.length, "steps:", recipe.steps?.length);

    return new Response(JSON.stringify(recipe), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-recipe error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
