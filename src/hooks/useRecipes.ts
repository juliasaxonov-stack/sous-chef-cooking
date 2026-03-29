import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Recipe {
  id: string;
  title: string;
  servings: number;
  created_at: string;
  updated_at: string;
}

export interface Ingredient {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
  sort_order: number;
}

export interface Step {
  id?: string;
  step_number: number;
  instruction: string;
}

export interface RecipeWithDetails extends Recipe {
  ingredients: Ingredient[];
  steps: Step[];
}

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
        supabase.from("ingredients").select("*").eq("recipe_id", id).order("sort_order"),
        supabase.from("steps").select("*").eq("recipe_id", id).order("step_number"),
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
    mutationFn: async (data: { title: string; servings: number; ingredients: Ingredient[]; steps: Step[] }) => {
      const { data: recipe, error } = await supabase
        .from("recipes")
        .insert({ title: data.title, servings: data.servings, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;

      if (data.ingredients.length > 0) {
        const { error: ingError } = await supabase.from("ingredients").insert(
          data.ingredients.map((ing, i) => ({
            recipe_id: recipe.id,
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            sort_order: i,
          }))
        );
        if (ingError) throw ingError;
      }

      if (data.steps.length > 0) {
        const { error: stepError } = await supabase.from("steps").insert(
          data.steps.map((step, i) => ({
            recipe_id: recipe.id,
            step_number: i + 1,
            instruction: step.instruction,
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
    mutationFn: async ({ id, ...data }: { id: string; title: string; servings: number; ingredients: Ingredient[]; steps: Step[] }) => {
      const { error } = await supabase
        .from("recipes")
        .update({ title: data.title, servings: data.servings })
        .eq("id", id);
      if (error) throw error;

      // Replace ingredients and steps
      await supabase.from("ingredients").delete().eq("recipe_id", id);
      await supabase.from("steps").delete().eq("recipe_id", id);

      if (data.ingredients.length > 0) {
        await supabase.from("ingredients").insert(
          data.ingredients.map((ing, i) => ({
            recipe_id: id,
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            sort_order: i,
          }))
        );
      }

      if (data.steps.length > 0) {
        await supabase.from("steps").insert(
          data.steps.map((step, i) => ({
            recipe_id: id,
            step_number: i + 1,
            instruction: step.instruction,
          }))
        );
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
