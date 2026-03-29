import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
            content: "You extract structured recipe data from raw text. Always return complete data.",
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
                  servings: { type: "number", description: "Number of servings" },
                  ingredients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        original_text: { type: "string", description: "Original ingredient line" },
                        name: { type: "string" },
                        canonical_name: { type: "string", description: "Normalized ingredient name" },
                        quantity: { type: "string" },
                        unit: { type: "string" },
                        preparation: { type: "string", description: "e.g. diced, minced" },
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
                        duration_minutes: { type: "number", description: "Estimated duration in minutes" },
                        action_type: { type: "string", description: "e.g. prep, cook, rest, mix" },
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

    console.log("Extracted recipe:", recipe.title);

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
