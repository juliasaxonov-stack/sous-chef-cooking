-- P7: Cuisine and tags metadata on recipes

ALTER TABLE public.recipes ADD COLUMN cuisine TEXT;
ALTER TABLE public.recipes ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
