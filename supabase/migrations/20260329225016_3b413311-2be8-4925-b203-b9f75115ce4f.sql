
-- Create recipes table
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  servings INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ingredients table
CREATE TABLE public.ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Create steps table
CREATE TABLE public.steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  instruction TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steps ENABLE ROW LEVEL SECURITY;

-- Recipes RLS policies
CREATE POLICY "Users can view their own recipes" ON public.recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own recipes" ON public.recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own recipes" ON public.recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own recipes" ON public.recipes FOR DELETE USING (auth.uid() = user_id);

-- Ingredients RLS policies (via recipe ownership)
CREATE POLICY "Users can view ingredients of their recipes" ON public.ingredients FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = ingredients.recipe_id AND recipes.user_id = auth.uid())
);
CREATE POLICY "Users can create ingredients for their recipes" ON public.ingredients FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = ingredients.recipe_id AND recipes.user_id = auth.uid())
);
CREATE POLICY "Users can update ingredients of their recipes" ON public.ingredients FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = ingredients.recipe_id AND recipes.user_id = auth.uid())
);
CREATE POLICY "Users can delete ingredients of their recipes" ON public.ingredients FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = ingredients.recipe_id AND recipes.user_id = auth.uid())
);

-- Steps RLS policies (via recipe ownership)
CREATE POLICY "Users can view steps of their recipes" ON public.steps FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = steps.recipe_id AND recipes.user_id = auth.uid())
);
CREATE POLICY "Users can create steps for their recipes" ON public.steps FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = steps.recipe_id AND recipes.user_id = auth.uid())
);
CREATE POLICY "Users can update steps of their recipes" ON public.steps FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = steps.recipe_id AND recipes.user_id = auth.uid())
);
CREATE POLICY "Users can delete steps of their recipes" ON public.steps FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = steps.recipe_id AND recipes.user_id = auth.uid())
);

-- Indexes for performance
CREATE INDEX idx_recipes_user_id ON public.recipes(user_id);
CREATE INDEX idx_ingredients_recipe_id ON public.ingredients(recipe_id);
CREATE INDEX idx_steps_recipe_id ON public.steps(recipe_id);
CREATE INDEX idx_steps_step_number ON public.steps(recipe_id, step_number);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
