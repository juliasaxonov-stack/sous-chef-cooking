import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Keep the most recent N turns to stay within token limits (P4)
const MAX_HISTORY_MESSAGES = 20;

interface Ingredient {
  quantity?: string | null;
  unit?: string | null;
  name: string;
  canonical_name?: string | null;
  preparation?: string | null;
  optional?: boolean;
}

interface Step {
  position: number;
  instruction: string;
  duration_minutes?: number | null;
  action_type?: string | null;
}

interface Recipe {
  title: string;
  servings: number;
  cuisine?: string | null;
  tags?: string[] | null;
  ingredients: Ingredient[];
  steps: Step[];
}

function buildIngredientLine(ing: Ingredient): string {
  const parts: string[] = [];
  if (ing.quantity) parts.push(ing.quantity);
  if (ing.unit) parts.push(ing.unit);
  const displayName = ing.canonical_name && ing.canonical_name !== ing.name
    ? `${ing.name} (${ing.canonical_name})`
    : ing.name;
  parts.push(displayName);
  const notes: string[] = [];
  if (ing.preparation) notes.push(ing.preparation);
  if (ing.optional) notes.push("optional");
  if (notes.length) parts.push(`[${notes.join(", ")}]`);
  return parts.join(" ");
}

function buildStepLine(step: Step): string {
  const meta: string[] = [];
  if (step.action_type) meta.push(step.action_type);
  if (step.duration_minutes) meta.push(`${step.duration_minutes} min`);
  const prefix = meta.length ? ` [${meta.join(", ")}]` : "";
  return `${step.position}.${prefix} ${step.instruction}`;
}

function buildSystemPrompt(recipe: Recipe): string {
  const lines: string[] = [
    `You are a helpful sous chef AI. You are helping a user cook the following recipe.`,
    `Answer questions about substitutions, technique, timing, scaling, and any cooking topics.`,
    `Be concise, practical, and direct — you're talking to someone in the kitchen.`,
    ``,
    `--- RECIPE ---`,
    `Title: ${recipe.title}`,
    `Servings: ${recipe.servings}`,
  ];

  if (recipe.cuisine) lines.push(`Cuisine: ${recipe.cuisine}`);
  if (recipe.tags?.length) lines.push(`Tags: ${recipe.tags.join(", ")}`);

  lines.push(``, `Ingredients:`);
  for (const ing of recipe.ingredients) {
    lines.push(`  - ${buildIngredientLine(ing)}`);
  }

  lines.push(``, `Steps:`);
  for (const step of recipe.steps) {
    lines.push(`  ${buildStepLine(step)}`);
  }

  lines.push(`--- END RECIPE ---`);
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, recipe } = await req.json() as { messages: Array<{ role: string; content: string }>; recipe: Recipe };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = buildSystemPrompt(recipe);

    // Rolling window: keep the most recent MAX_HISTORY_MESSAGES (P4)
    const windowedMessages = messages.length > MAX_HISTORY_MESSAGES
      ? messages.slice(-MAX_HISTORY_MESSAGES)
      : messages;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...windowedMessages,
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", response.status, text);
      throw new Error("AI request failed");
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
