import { z } from "zod";

// ============================================================================
// SCHEMAS — match actual backend serializer field names
// ============================================================================

export const ingredientSchema = z.object({
  id: z.string(),
  organization: z.string(),
  organization_name: z.string().optional(),
  name: z.string(),
  category: z.string(),
  unit: z.string(),
  shelf_life_days: z.number().nullable(),
  is_perishable: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const menuItemSchema = z.object({
  id: z.string(),
  branch: z.string(),
  branch_name: z.string().optional(),
  catalog_item: z.string().nullable(),
  catalog_item_title: z.string().nullable().optional(),
  name: z.string(),
  category: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const recipeSchema = z.object({
  id: z.string(),
  menu_item: z.string(),
  menu_item_name: z.string().optional(),
  ingredient: z.string(),
  ingredient_name: z.string().optional(),
  ingredient_unit: z.string().optional(),
  quantity: z.string(), // DecimalField serializes as string
  unit: z.string(),
  waste_factor: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const prepBatchSchema = z.object({
  id: z.string(),
  branch: z.string(),
  branch_name: z.string().optional(),
  ingredient: z.string(),
  ingredient_name: z.string().optional(),
  quantity_prepared: z.string(), // DecimalField serializes as string
  unit: z.string(),
  prepared_at: z.string(),
  prepared_by: z.string().nullable(),
  prepared_by_display: z.string().nullable().optional(),
  notes: z.string(),
  created_at: z.string(),
});

export const wasteEventSchema = z.object({
  id: z.string(),
  branch: z.string(),
  branch_name: z.string().optional(),
  ingredient: z.string(),
  ingredient_name: z.string().optional(),
  quantity: z.string(), // DecimalField serializes as string
  unit: z.string(),
  reason: z.string(),
  recorded_at: z.string(),
  recorded_by: z.string().nullable(),
  recorded_by_display: z.string().nullable().optional(),
  notes: z.string(),
  created_at: z.string(),
});

// WasteAnalytics has a custom response shape (not a serializer model)
export const wasteAnalyticsSchema = z.object({
  branch_id: z.string(),
  branch_name: z.string(),
  date_from: z.string().nullable(),
  date_to: z.string().nullable(),
  total_waste_events: z.number(),
  by_ingredient: z.array(
    z.object({
      ingredient_id: z.string(),
      ingredient_name: z.string(),
      is_perishable: z.boolean(),
      total_waste: z.string(), // DecimalField serializes as string
    })
  ),
  by_reason: z.array(
    z.object({
      reason: z.string(),
      total_waste: z.string(),
    })
  ),
});

// Paginated list wrappers
export const ingredientsResponseSchema = z.object({
  count: z.number(),
  page: z.number(),
  page_size: z.number(),
  results: z.array(ingredientSchema),
});

export const menuItemsResponseSchema = z.object({
  count: z.number(),
  page: z.number(),
  page_size: z.number(),
  results: z.array(menuItemSchema),
});

export const recipesResponseSchema = z.object({
  count: z.number(),
  results: z.array(recipeSchema),
});

export const prepBatchesResponseSchema = z.object({
  count: z.number(),
  page: z.number(),
  page_size: z.number(),
  results: z.array(prepBatchSchema),
});

export const wasteEventsResponseSchema = z.object({
  count: z.number(),
  page: z.number(),
  page_size: z.number(),
  results: z.array(wasteEventSchema),
});

// ============================================================================
// TYPES
// ============================================================================

export type Ingredient = z.infer<typeof ingredientSchema>;
export type MenuItem = z.infer<typeof menuItemSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type PrepBatch = z.infer<typeof prepBatchSchema>;
export type WasteEvent = z.infer<typeof wasteEventSchema>;
export type WasteAnalytics = z.infer<typeof wasteAnalyticsSchema>;
