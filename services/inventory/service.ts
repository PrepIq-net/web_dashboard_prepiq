import { apiClient, apiClientWithSchema } from "@/lib/api/client";
import { inventoryEndpoints } from "./endpoints";
import {
  ingredientSchema,
  ingredientsResponseSchema,
  menuItemsResponseSchema,
  recipesResponseSchema,
  recipeSchema,
  wasteEventsResponseSchema,
  wasteAnalyticsSchema,
  prepBatchesResponseSchema,
  ingredientDemandSchema,
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

export async function calculateIngredientDemand(branchId: string, date: string) {
  return apiClientWithSchema(
    inventoryEndpoints.demand.calculate,
    ingredientDemandSchema,
    { method: "POST", body: { branch_id: branchId, date } }
  );
}
