import { z } from "zod";

// ============================================================================
// SCHEMAS — match actual backend serializer field names
// ============================================================================

// Catalog items — org-scoped master item list used for promotion item selection
// Catalog uses StandardResultsSetPagination: {success, data: {count, results}}
export const catalogItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  item_type: z.string().optional(),
  unit: z.string().optional(),
});
export const catalogItemsResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z.object({
    count: z.number(),
    results: z.array(catalogItemSchema),
  }),
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;

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

export const menuItemAiReviewSchema = z.object({
  ai_provisioned: z.boolean().optional(),
  confidence: z.number().nullable().optional(),
  source_pos_name: z.string().nullable().optional(),
  pending_aliases: z
    .array(
      z.object({
        name: z.string().nullable().optional(),
        confidence: z.number().nullable().optional(),
      })
    )
    .optional(),
});

export const menuItemSchema = z.object({
  id: z.string(),
  branch: z.string(),
  branch_name: z.string().optional(),
  catalog_item: z.string().nullable(),
  catalog_item_title: z.string().nullable().optional(),
  name: z.string(),
  category: z.string(),
  image: z.string().optional().nullable(),
  instructions: z.string().optional(),
  is_active: z.boolean(),
  // Connector AI provenance: true while an AI match/provision decision for
  // this item awaits human confirmation.
  needs_review: z.boolean().optional(),
  ai_review: menuItemAiReviewSchema.nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type MenuItemAiReview = z.infer<typeof menuItemAiReviewSchema>;

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

// Auto-generate recipe response
export const autoGenerateRecipeResponseSchema = z.object({
  detail: z.string(),
  results: z.object({
    status: z.string(),
    source: z.string().optional(),
    ingredients_mapped: z.number().optional(),
    reason: z.string().optional(),
  }),
  menu_item: menuItemSchema.optional(),
});
export type AutoGenerateRecipeResponse = z.infer<typeof autoGenerateRecipeResponseSchema>;

// Ingredient demand (from /api/inventory/demand/calculate/)
// Handles both branch-level and per-item (product_id) responses
export const ingredientDemandSchema = z.object({
  date: z.string().optional(),
  branch_id: z.string().optional(),
  no_recipe: z.boolean().optional(),
  item_name: z.string().nullable().optional(),
  menu_item_id: z.string().optional(),
  planned_quantity: z.number().optional(),
  ingredients: z.array(
    z.object({
      ingredient_id: z.string().optional(),
      ingredient_name: z.string(),
      predicted_usage: z.string().optional(),
      quantity_for_plan: z.number().optional(),
      per_serving: z.number().optional(),
      waste_factor: z.number().optional(),
      unit: z.string(),
    })
  ),
  items_with_no_recipe: z.array(z.string()).optional(),
});
export type IngredientDemand = z.infer<typeof ingredientDemandSchema>;

// ============================================================================
// PHASE 4 — PURCHASE FORECAST TYPES
// ============================================================================

export const ingredientOnHandSchema = z.object({
  id: z.string(),
  ingredient_id: z.string(),
  ingredient_name: z.string().optional(),
  quantity: z.coerce.number(),
  unit: z.string(),
  as_of_date: z.string(),
  recorded_by: z.string().nullable().optional(),
  notes: z.string().optional(),
});
export type IngredientOnHand = z.infer<typeof ingredientOnHandSchema>;

export const ingredientSupplierSchema = z.object({
  id: z.string(),
  ingredient_id: z.string(),
  ingredient_name: z.string().optional(),
  supplier_name: z.string(),
  pack_size: z.coerce.number().nullable(),
  pack_unit: z.string(),
  cost_per_pack: z.coerce.number().nullable(),
  lead_time_days: z.number(),
  is_primary: z.boolean(),
  is_active: z.boolean(),
});
export type IngredientSupplier = z.infer<typeof ingredientSupplierSchema>;

export const purchaseForecastLineSchema = z.object({
  ingredient_id: z.string(),
  ingredient_name: z.string(),
  unit: z.string(),
  predicted_usage: z.coerce.number(),
  on_hand_qty: z.coerce.number(),
  on_hand_date: z.string().nullable().optional(),
  net_need: z.coerce.number(),
  pack_size: z.coerce.number().nullable(),
  pack_unit: z.string().optional(),
  packs_needed: z.number().nullable(),
  purchase_qty: z.coerce.number(),
  cost_per_pack: z.coerce.number().nullable().optional(),
  estimated_cost: z.coerce.number().nullable(),
  lead_time_days: z.number().optional(),
  supplier_name: z.string().optional(),
});
export const purchaseForecastSchema = z.object({
  branch_id: z.string(),
  horizon_start: z.string(),
  horizon_end: z.string(),
  lines: z.array(purchaseForecastLineSchema),
  total_estimated_cost: z.coerce.number().nullable(),
});
export type PurchaseForecast = z.infer<typeof purchaseForecastSchema>;
export type PurchaseForecastLine = z.infer<typeof purchaseForecastLineSchema>;

// ============================================================================
// PHASE 5 — BATCH RULES
// ============================================================================

export const itemBatchRuleSchema = z.object({
  id: z.string().optional(),
  batch_size: z.coerce.number().nullable(),
  min_prep: z.coerce.number().nullable(),
  max_prep: z.coerce.number().nullable(),
  notes: z.string().optional(),
  is_active: z.boolean().optional(),
});
export type ItemBatchRule = z.infer<typeof itemBatchRuleSchema>;

// ============================================================================
// PHASE 6 — AVAILABILITY OVERRIDES
// ============================================================================

export const itemAvailabilityOverrideSchema = z.object({
  id: z.string(),
  item_id: z.string(),
  item_title: z.string().nullable().optional(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  reason: z.string(),
  suppressed_demand: z.boolean(),
  is_active: z.boolean(),
});
export type ItemAvailabilityOverride = z.infer<typeof itemAvailabilityOverrideSchema>;
