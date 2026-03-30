import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Recipe {
  id: string;
  title: string;
  servings: number;
  cuisine: string | null;
  tags: string[];
  raw_recipe_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ingredient {
  id?: string;
  original_text?: string;
  name: string;
  canonical_name?: string;
  quantity: string;
  unit: string;
  preparation?: string;
  optional?: boolean;
  sort_order: number;
}

export interface Step {
  id?: string;
  position: number;
  instruction: string;
  duration_minutes?: number | null;
  timer_suggested_minutes?: number | null;
  action_type?: string | null;
}

export interface RecipeWithDetails extends Recipe {
  ingredients: Ingredient[];
  steps: Step[];
}

type RecipeSaveData = {
  title: string;
  servings: number;
  cuisine?: string | null;
  tags?: string[];
  raw_recipe_text?: string;
  ingredients: Ingredient[];
  steps: Step[];
};

export const useRecipes = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["recipes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Recipe[];
    },
    enabled: !!user,
  });
};

export const useRecipe = (id: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["recipe", id],
    queryFn: async () => {
      if (!id) throw new Error("No recipe id");
      const [recipeRes, ingredientsRes, stepsRes] = await Promise.all([
        supabase.from("recipes").select("*").eq("id", id).single(),
        supabase.from("recipe_ingredients").select("*").eq("recipe_id", id).order("sort_order"),
        supabase.from("recipe_steps").select("*").eq("recipe_id", id).order("position"),
      ]);
      if (recipeRes.error) throw recipeRes.error;
      return {
        ...recipeRes.data,
        ingredients: ingredientsRes.data ?? [],
        steps: stepsRes.data ?? [],
      } as RecipeWithDetails;
    },
    enabled: !!user && !!id,
  });
};

export const useCreateRecipe = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: RecipeSaveData) => {
      const { data: recipe, error } = await supabase
        .from("recipes")
        .insert({
          title: data.title,
          servings: data.servings,
          cuisine: data.cuisine ?? null,
          tags: data.tags ?? [],
          raw_recipe_text: data.raw_recipe_text ?? null,
          user_id: user!.id,
        })
        .select()
        .single();
      if (error) throw error;

      if (data.ingredients.length > 0) {
        const { error: ingError } = await supabase.from("recipe_ingredients").insert(
          data.ingredients.map((ing, i) => ({
            recipe_id: recipe.id,
            name: ing.name,
            canonical_name: ing.canonical_name ?? null,
            original_text: ing.original_text ?? null,
            quantity: ing.quantity,
            unit: ing.unit,
            preparation: ing.preparation ?? null,
            optional: ing.optional ?? false,
            sort_order: i,
          }))
        );
        if (ingError) throw ingError;
      }

      if (data.steps.length > 0) {
        const { error: stepError } = await supabase.from("recipe_steps").insert(
          data.steps.map((step, i) => ({
            recipe_id: recipe.id,
            position: i + 1,
            instruction: step.instruction,
            duration_minutes: step.duration_minutes ?? null,
            timer_suggested_minutes: step.timer_suggested_minutes ?? null,
            action_type: step.action_type ?? null,
          }))
        );
        if (stepError) throw stepError;
      }

      return recipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
};

export const useUpdateRecipe = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & RecipeSaveData) => {
      const { error } = await supabase
        .from("recipes")
        .update({
          title: data.title,
          servings: data.servings,
          cuisine: data.cuisine ?? null,
          tags: data.tags ?? [],
          raw_recipe_text: data.raw_recipe_text ?? null,
        })
        .eq("id", id);
      if (error) throw error;

      // Delete then re-insert (replace-all strategy)
      const { error: delIngError } = await supabase.from("recipe_ingredients").delete().eq("recipe_id", id);
      if (delIngError) throw delIngError;

      const { error: delStepError } = await supabase.from("recipe_steps").delete().eq("recipe_id", id);
      if (delStepError) throw delStepError;

      if (data.ingredients.length > 0) {
        const { error: ingError } = await supabase.from("recipe_ingredients").insert(
          data.ingredients.map((ing, i) => ({
            recipe_id: id,
            name: ing.name,
            canonical_name: ing.canonical_name ?? null,
            original_text: ing.original_text ?? null,
            quantity: ing.quantity,
            unit: ing.unit,
            preparation: ing.preparation ?? null,
            optional: ing.optional ?? false,
            sort_order: i,
          }))
        );
        if (ingError) throw ingError;
      }

      if (data.steps.length > 0) {
        const { error: stepError } = await supabase.from("recipe_steps").insert(
          data.steps.map((step, i) => ({
            recipe_id: id,
            position: i + 1,
            instruction: step.instruction,
            duration_minutes: step.duration_minutes ?? null,
            timer_suggested_minutes: step.timer_suggested_minutes ?? null,
            action_type: step.action_type ?? null,
          }))
        );
        if (stepError) throw stepError;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["recipe", vars.id] });
    },
  });
};

export const useDeleteRecipe = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recipes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
};
