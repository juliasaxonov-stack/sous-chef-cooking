

# Sous Chef — Updated Plan

## What Changed
Added a **recipe import** feature that lets users paste a URL from any recipe website and automatically extract the title, servings, ingredients, and steps.

## Overview
Everything from the previously approved plan remains. This addendum covers the new import feature.

## Recipe Import Feature

### How It Works
1. User taps "Import from URL" (on the Home screen or Create Recipe screen)
2. User pastes a recipe website URL
3. The app calls an edge function that uses **Firecrawl** to scrape the page, then uses **Gemini AI** to extract structured recipe data (title, servings, ingredients, steps) from the scraped markdown
4. The extracted recipe is shown in the Create/Edit Recipe form, pre-filled and editable
5. User can review, adjust, and save

### Implementation

**Firecrawl Connector** — used to scrape recipe pages into markdown.

**New Edge Function: `import-recipe`**
- Receives a URL from the client
- Calls Firecrawl scrape API (markdown format, main content only)
- Sends the markdown to Gemini with a prompt to extract structured recipe JSON (title, servings, ingredients array, steps array)
- Returns the structured data to the client

**New UI Component: `ImportRecipeDialog`**
- Simple dialog/drawer with a URL input and "Import" button
- Loading state while scraping + extracting
- On success, navigates to Create Recipe form pre-filled with extracted data
- Error handling for invalid URLs or failed extraction

**Integration Points**
- "Import from URL" button on the Home screen (next to the create FAB or as a menu option)
- Also accessible from the Create Recipe screen header

### Technical Details

```text
User pastes URL
      │
      ▼
  Edge Function
      │
      ├─► Firecrawl scrape (markdown)
      │
      ├─► Gemini: extract { title, servings, ingredients[], steps[] }
      │
      ▼
  Return structured JSON
      │
      ▼
  Pre-fill Create Recipe form
```

- Firecrawl connector will be linked via `standard_connectors--connect`
- The edge function validates the URL input with Zod
- Gemini extraction uses a strict JSON schema prompt to ensure consistent output
- Handles edge cases: recipes behind paywalls (graceful error), non-recipe pages (validation message)

## All Screens (Updated)

1. **Auth** — email/password login/signup
2. **Home** — recipe list, FAB to create, **"Import from URL" option**
3. **Create/Edit Recipe** — form with title, servings, ingredients, steps (can be pre-filled from import)
4. **Recipe Detail** — full recipe view, Start Cooking button, AI assistant drawer
5. **Cooking Mode** — step-by-step, large text, kitchen-friendly controls

Everything else (database schema, RLS, Cooking Mode, AI assistant) remains as previously planned.

