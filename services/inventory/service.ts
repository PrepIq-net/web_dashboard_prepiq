import { z } from "zod";
import { apiClient, apiClientWithSchema } from "@/lib/api/client";
import { inventoryEndpoints } from "./endpoints";
import {
  catalogItemsResponseSchema,
  ingredientSchema,
  ingredientsResponseSchema,
  menuItemSchema,
  menuItemsResponseSchema,
  recipesResponseSchema,
  recipeSchema,
  wasteEventsResponseSchema,
  wasteAnalyticsSchema,
  prepBatchesResponseSchema,
  ingredientDemandSchema,
  autoGenerateRecipeResponseSchema,
  ingredientOnHandSchema,
  ingredientSupplierSchema,
  purchaseForecastSchema,
  itemBatchRuleSchema,
  itemAvailabilityOverrideSchema,
} from "./types";

export type IngredientPayload = {
  organization_id: string;
  name: string;
  category: string;
  unit: string;
  shelf_life_days?: number | null;
  is_perishable: boolean;
};

// ============================================================================
// SERVICE FUNCTIONS - CATALOG ITEMS
// ============================================================================

export async function getCatalogItems(organizationId: string) {
  return apiClientWithSchema(
    inventoryEndpoints.catalogItems.list(organizationId),
    catalogItemsResponseSchema,
    { method: "GET" }
  );
}

// ============================================================================
// SERVICE FUNCTIONS - INGREDIENTS
// ============================================================================

export async function getIngredients(organizationId: string) {
  return apiClientWithSchema(
    inventoryEndpoints.ingredients.list(organizationId),
    ingredientsResponseSchema,
    { method: "GET" }
  );
}

export async function createIngredient(data: IngredientPayload) {
  return apiClientWithSchema(
    inventoryEndpoints.ingredients.create,
    ingredientSchema,
    { method: "POST", body: data }
  );
}

export async function updateIngredient(ingredientId: string, data: Partial<IngredientPayload>) {
  return apiClientWithSchema(
    inventoryEndpoints.ingredients.update(ingredientId),
    ingredientSchema,
    { method: "PATCH", body: data }
  );
}

// ============================================================================
// SERVICE FUNCTIONS - MENU ITEMS
// ============================================================================

export async function getMenuItems(branchId: string) {
  return apiClientWithSchema(
    inventoryEndpoints.menuItems.list(branchId),
    menuItemsResponseSchema,
    { method: "GET" }
  );
}

export type MenuItemPayload = {
  name: string;
  category?: string;
  image?: File | null;
  instructions?: string;
  is_active?: boolean;
};

export async function createMenuItem(branchId: string, data: MenuItemPayload) {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value instanceof File ? value : String(value));
    }
  });

  return apiClientWithSchema(
    inventoryEndpoints.menuItems.create(branchId),
    menuItemSchema,
    { method: "POST", body: formData }
  );
}

export async function updateMenuItem(branchId: string, menuItemId: string, data: Partial<MenuItemPayload>) {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value instanceof File ? value : String(value));
    }
  });

  return apiClientWithSchema(
    inventoryEndpoints.menuItems.update(branchId, menuItemId),
    menuItemSchema,
    { method: "PATCH", body: formData }
  );
}

// ============================================================================
// SERVICE FUNCTIONS - RECIPE INTELLIGENCE
// ============================================================================

export async function autoGenerateRecipe(menuItemId: string) {
  return apiClientWithSchema(
    inventoryEndpoints.recipeIntelligence.autoGenerate(menuItemId),
    autoGenerateRecipeResponseSchema,
    { method: "POST" }
  );
}

// ============================================================================
// SERVICE FUNCTIONS - RECIPES
// ============================================================================

export async function getRecipes(menuItemId: string) {
  return apiClientWithSchema(
    inventoryEndpoints.recipes.list(menuItemId),
    recipesResponseSchema,
    { method: "GET" }
  );
}

export async function createRecipe(
  menuItemId: string,
  data: { ingredient: string; quantity: number; unit: string; waste_factor?: number }
) {
  return apiClientWithSchema(
    inventoryEndpoints.recipes.create(menuItemId),
    recipeSchema,
    {
      method: "POST",
      body: data,
    }
  );
}

export async function deleteRecipe(menuItemId: string, recipeId: string) {
  return apiClient(inventoryEndpoints.recipes.delete(menuItemId, recipeId), {
    method: "DELETE",
  });
}

// ============================================================================
// SERVICE FUNCTIONS - WASTE
// ============================================================================

export async function getWasteEvents(branchId: string) {
  return apiClientWithSchema(
    inventoryEndpoints.waste.events(branchId),
    wasteEventsResponseSchema,
    { method: "GET" }
  );
}

export async function getWasteAnalytics(branchId: string) {
  return apiClientWithSchema(
    inventoryEndpoints.waste.analytics(branchId),
    wasteAnalyticsSchema,
    { method: "GET" }
  );
}

// ============================================================================
// SERVICE FUNCTIONS - PREP BATCHES
// ============================================================================

export async function getPrepBatches(branchId: string) {
  return apiClientWithSchema(
    inventoryEndpoints.prepBatches.list(branchId),
    prepBatchesResponseSchema,
    { method: "GET" }
  );
}

// ============================================================================
// SERVICE FUNCTIONS - INGREDIENT DEMAND
// ============================================================================

export async function calculateIngredientDemand(branchId: string, date: string, productId?: string) {
  return apiClientWithSchema(
    inventoryEndpoints.demand.calculate,
    ingredientDemandSchema,
    { method: "POST", body: { branch_id: branchId, date, ...(productId ? { product_id: productId } : {}) } }
  );
}

// ============================================================================
// SERVICE FUNCTIONS — PHASE 4: ON-HAND STOCK
// ============================================================================

export async function getOnHand(branchId: string) {
  const parsed = await apiClientWithSchema(
    inventoryEndpoints.onHand.list(branchId),
    z.object({ branch_id: z.string(), records: z.array(ingredientOnHandSchema) }),
    { method: "GET" }
  );
  return { results: parsed.records };
}

export type OnHandPayload = {
  ingredient_id: string;
  quantity: number;
  unit: string;
  as_of_date: string;
  notes?: string;
};

export async function logOnHand(branchId: string, data: OnHandPayload) {
  return apiClientWithSchema(
    inventoryEndpoints.onHand.create(branchId),
    z.object({ id: z.string(), created: z.boolean() }),
    { method: "POST", body: data }
  );
}

// ============================================================================
// SERVICE FUNCTIONS — PHASE 4: INGREDIENT SUPPLIERS
// ============================================================================

export async function getIngredientSuppliers(branchId: string) {
  const parsed = await apiClientWithSchema(
    inventoryEndpoints.ingredientSuppliers.list(branchId),
    z.object({ branch_id: z.string(), suppliers: z.array(ingredientSupplierSchema) }),
    { method: "GET" }
  );
  return { results: parsed.suppliers };
}

export type IngredientSupplierPayload = {
  ingredient_id: string;
  supplier_name: string;
  pack_size?: number | null;
  pack_unit?: string;
  cost_per_pack?: number | null;
  lead_time_days?: number;
  is_primary?: boolean;
};

export async function createIngredientSupplier(branchId: string, data: IngredientSupplierPayload) {
  return apiClientWithSchema(
    inventoryEndpoints.ingredientSuppliers.create(branchId),
    z.object({ id: z.string() }),
    { method: "POST", body: data }
  );
}

// ============================================================================
// SERVICE FUNCTIONS — PHASE 4: PURCHASE FORECAST
// ============================================================================

export async function getPurchaseForecast(branchId: string, from: string, to: string) {
  const url = `${inventoryEndpoints.purchaseForecast.get(branchId)}?from=${from}&to=${to}`;
  return apiClientWithSchema(url, purchaseForecastSchema, { method: "GET" });
}

// ============================================================================
// SERVICE FUNCTIONS — PHASE 5: BATCH RULES
// ============================================================================

export async function getBatchRule(itemId: string) {
  try {
    const parsed = await apiClientWithSchema(
      inventoryEndpoints.batchRule.get(itemId),
      z.object({
        success: z.boolean().optional(),
        data: z.object({
          item_id: z.string(),
          rule: itemBatchRuleSchema.nullable(),
        }),
      }),
      { method: "GET" }
    );
    return parsed.data.rule;
  } catch {
    return null;
  }
}

export type BatchRulePayload = {
  batch_size?: number | null;
  min_prep?: number | null;
  max_prep?: number | null;
  notes?: string;
};

export async function upsertBatchRule(itemId: string, data: BatchRulePayload) {
  const parsed = await apiClientWithSchema(
    inventoryEndpoints.batchRule.update(itemId),
    z.object({
      item_id: z.string(),
      rule: itemBatchRuleSchema,
      created: z.boolean(),
    }),
    { method: "PUT", body: data }
  );
  return parsed.rule;
}

// ============================================================================
// SERVICE FUNCTIONS — PHASE 6: AVAILABILITY OVERRIDES
// ============================================================================

export async function getAvailabilityOverrides(branchId: string) {
  const parsed = await apiClientWithSchema(
    inventoryEndpoints.availabilityOverrides.list(branchId),
    z.object({
      success: z.boolean().optional(),
      data: z.object({
        branch_id: z.string(),
        overrides: z.array(itemAvailabilityOverrideSchema),
      }),
    }),
    { method: "GET" }
  );
  return { results: parsed.data.overrides };
}

export type AvailabilityOverridePayload = {
  item: string;
  start_date: string;
  end_date?: string | null;
  reason?: string;
  suppressed_demand?: boolean;
};

export async function createAvailabilityOverride(branchId: string, data: AvailabilityOverridePayload) {
  const { item, ...rest } = data;
  const parsed = await apiClientWithSchema(
    inventoryEndpoints.availabilityOverrides.create(branchId),
    z.object({ override: itemAvailabilityOverrideSchema }),
    { method: "POST", body: { item_id: item, ...rest } }
  );
  return parsed.override;
}

export async function deactivateAvailabilityOverride(branchId: string, overrideId: string) {
  const parsed = await apiClientWithSchema(
    inventoryEndpoints.availabilityOverrides.detail(branchId, overrideId),
    z.object({
      success: z.boolean().optional(),
      data: z.object({ override: itemAvailabilityOverrideSchema }),
    }),
    { method: "PATCH", body: { is_active: false } }
  );
  return parsed.data.override;
}
