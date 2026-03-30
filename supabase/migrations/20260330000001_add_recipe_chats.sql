-- P3: Persistent chat history per recipe per user

CREATE TABLE public.recipe_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(recipe_id, user_id)
);

ALTER TABLE public.recipe_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recipe chats" ON public.recipe_chats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recipe chats" ON public.recipe_chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipe chats" ON public.recipe_chats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipe chats" ON public.recipe_chats
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_recipe_chats_recipe_user ON public.recipe_chats(recipe_id, user_id);

CREATE TRIGGER update_recipe_chats_updated_at
  BEFORE UPDATE ON public.recipe_chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
