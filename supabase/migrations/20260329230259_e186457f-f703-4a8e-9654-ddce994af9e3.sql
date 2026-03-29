
-- Add raw_recipe_text to recipes
ALTER TABLE public.recipes ADD COLUMN raw_recipe_text TEXT;

-- Create recipe_ingredients table
CREATE TABLE public.recipe_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  original_text TEXT,
  name TEXT NOT NULL,
  canonical_name TEXT,
  quantity TEXT,
  unit TEXT,
  preparation TEXT,
  optional BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Create recipe_steps table
CREATE TABLE public.recipe_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  duration_minutes INTEGER,
  timer_suggested_minutes INTEGER,
  action_type TEXT
);

-- Enable RLS
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_steps ENABLE ROW LEVEL SECURITY;

-- RLS for recipe_ingredients
CREATE POLICY "Users can view recipe_ingredients of their recipes" ON public.recipe_ingredients FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = recipe_ingredients.recipe_id AND recipes.user_id = auth.uid())
);
CREATE POLICY "Users can create recipe_ingredients for their recipes" ON public.recipe_ingredients FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = recipe_ingredients.recipe_id AND recipes.user_id = auth.uid())
);
CREATE POLICY "Users can update recipe_ingredients of their recipes" ON public.recipe_ingredients FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = recipe_ingredients.recipe_id AND recipes.user_id = auth.uid())
);
CREATE POLICY "Users can delete recipe_ingredients of their recipes" ON public.recipe_ingredients FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = recipe_ingredients.recipe_id AND recipes.user_id = auth.uid())
);

-- RLS for recipe_steps
CREATE POLICY "Users can view recipe_steps of their recipes" ON public.recipe_steps FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = recipe_steps.recipe_id AND recipes.user_id = auth.uid())
);
CREATE POLICY "Users can create recipe_steps for their recipes" ON public.recipe_steps FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = recipe_steps.recipe_id AND recipes.user_id = auth.uid())
);
CREATE POLICY "Users can update recipe_steps of their recipes" ON public.recipe_steps FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = recipe_steps.recipe_id AND recipes.user_id = auth.uid())
);
CREATE POLICY "Users can delete recipe_steps of their recipes" ON public.recipe_steps FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.recipes WHERE recipes.id = recipe_steps.recipe_id AND recipes.user_id = auth.uid())
);

-- Migrate data from old tables to new
INSERT INTO public.recipe_ingredients (recipe_id, name, quantity, unit, sort_order)
SELECT recipe_id, name, quantity, unit, sort_order FROM public.ingredients;

INSERT INTO public.recipe_steps (recipe_id, position, instruction)
SELECT recipe_id, step_number, instruction FROM public.steps;

-- Indexes
CREATE INDEX idx_recipe_ingredients_recipe_id ON public.recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_steps_recipe_id ON public.recipe_steps(recipe_id);
CREATE INDEX idx_recipe_steps_position ON public.recipe_steps(recipe_id, position);

-- Drop old tables
DROP TABLE public.ingredients;
DROP TABLE public.steps;
