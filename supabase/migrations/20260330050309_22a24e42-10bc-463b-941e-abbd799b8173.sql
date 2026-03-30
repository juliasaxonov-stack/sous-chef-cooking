
-- Migration 2: Add cuisine and tags columns to recipes
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS cuisine text;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
