import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCatalogItems,
  getIngredients,
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  getRecipes,
  createRecipe,
  deleteRecipe,
  getWasteEvents,
  getWasteAnalytics,
  getPrepBatches,
  createIngredient,
  updateIngredient,
  calculateIngredientDemand,
  autoGenerateRecipe,
  getOnHand,
  logOnHand,
  getIngredientSuppliers,
  createIngredientSupplier,
  getPurchaseForecast,
  getBatchRule,
  upsertBatchRule,
  getAvailabilityOverrides,
  createAvailabilityOverride,
  deactivateAvailabilityOverride,
  type IngredientPayload,
  type MenuItemPayload,
  type OnHandPayload,
  type IngredientSupplierPayload,
  type BatchRulePayload,
  type AvailabilityOverridePayload,
} from "./service";
// ============================================================================
// QUERY KEYS
// ============================================================================

export const inventoryQueryKeys = {
  all: ["inventory"] as const,
  catalogItems: (organizationId: string) =>
    [...inventoryQueryKeys.all, "catalogItems", organizationId] as const,
  ingredients: (organizationId: string) =>
    [...inventoryQueryKeys.all, "ingredients", organizationId] as const,
  menuItems: (branchId: string) =>
    [...inventoryQueryKeys.all, "menuItems", branchId] as const,
  recipes: (menuItemId: string) =>
    [...inventoryQueryKeys.all, "recipes", menuItemId] as const,
  wasteEvents: (branchId: string) =>
    [...inventoryQueryKeys.all, "wasteEvents", branchId] as const,
  wasteAnalytics: (branchId: string) =>
    [...inventoryQueryKeys.all, "wasteAnalytics", branchId] as const,
  prepBatches: (branchId: string) =>
    [...inventoryQueryKeys.all, "prepBatches", branchId] as const,
  ingredientDemand: (branchId: string, date: string) =>
    [...inventoryQueryKeys.all, "ingredientDemand", branchId, date] as const,
  onHand: (branchId: string) =>
    [...inventoryQueryKeys.all, "onHand", branchId] as const,
  ingredientSuppliers: (branchId: string) =>
    [...inventoryQueryKeys.all, "ingredientSuppliers", branchId] as const,
  purchaseForecast: (branchId: string, from: string, to: string) =>
    [...inventoryQueryKeys.all, "purchaseForecast", branchId, from, to] as const,
  batchRule: (itemId: string) =>
    [...inventoryQueryKeys.all, "batchRule", itemId] as const,
  availabilityOverrides: (branchId: string) =>
    [...inventoryQueryKeys.all, "availabilityOverrides", branchId] as const,
};

// ============================================================================
// HOOKS - CATALOG ITEMS
// ============================================================================

export function useCatalogItems(organizationId: string, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.catalogItems(organizationId),
    queryFn: () => getCatalogItems(organizationId),
    enabled: enabled && Boolean(organizationId),
    select: (data) => data.data.results,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// HOOKS - INGREDIENTS
// ============================================================================

export function useIngredients(organizationId: string, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.ingredients(organizationId),
    queryFn: () => getIngredients(organizationId),
    enabled: enabled && Boolean(organizationId),
    select: (data) => data.results,
  });
}

export function useCreateIngredient(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<IngredientPayload, "organization_id">) =>
      createIngredient({ ...data, organization_id: organizationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.ingredients(organizationId),
      });
    },
  });
}

export function useUpdateIngredient(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IngredientPayload> }) =>
      updateIngredient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.ingredients(organizationId),
      });
    },
  });
}

// ============================================================================
// HOOKS - MENU ITEMS
// ============================================================================

export function useMenuItems(branchId: string, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.menuItems(branchId),
    queryFn: () => getMenuItems(branchId),
    enabled: enabled && Boolean(branchId),
    select: (data) => data.results,
  });
}

export function useCreateMenuItem(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MenuItemPayload) => createMenuItem(branchId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.menuItems(branchId),
      });
    },
  });
}

export function useUpdateMenuItem(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MenuItemPayload> }) =>
      updateMenuItem(branchId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.menuItems(branchId),
      });
    },
  });
}

export function useAutoGenerateRecipe() {
  return useMutation({
    mutationFn: (menuItemId: string) => autoGenerateRecipe(menuItemId),
  });
}

// ============================================================================
// HOOKS - RECIPES
// ============================================================================

export function useRecipes(menuItemId: string, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.recipes(menuItemId),
    queryFn: () => getRecipes(menuItemId),
    enabled: enabled && Boolean(menuItemId),
    select: (data) => data.results,
  });
}

export function useCreateRecipe(menuItemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { ingredient: string; quantity: number; unit: string; waste_factor?: number }) =>
      createRecipe(menuItemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.recipes(menuItemId),
      });
    },
  });
}

export function useDeleteRecipe(menuItemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipeId: string) => deleteRecipe(menuItemId, recipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.recipes(menuItemId),
      });
    },
  });
}

// ============================================================================
// HOOKS - WASTE
// ============================================================================

export function useWasteEvents(branchId: string, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.wasteEvents(branchId),
    queryFn: () => getWasteEvents(branchId),
    enabled: enabled && Boolean(branchId),
    select: (data) => data.results,
  });
}

export function useWasteAnalytics(branchId: string, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.wasteAnalytics(branchId),
    queryFn: () => getWasteAnalytics(branchId),
    enabled: enabled && Boolean(branchId),
  });
}

// ============================================================================
// HOOKS - PREP BATCHES
// ============================================================================

export function usePrepBatches(branchId: string, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.prepBatches(branchId),
    queryFn: () => getPrepBatches(branchId),
    enabled: enabled && Boolean(branchId),
    select: (data) => data.results,
  });
}

// ============================================================================
// HOOKS - INGREDIENT DEMAND
// ============================================================================

export function useIngredientDemand(branchId: string, date: string, productId?: string) {
  return useMutation({
    mutationFn: () => calculateIngredientDemand(branchId, date, productId),
  });
}

// ============================================================================
// HOOKS — PHASE 4: ON-HAND STOCK
// ============================================================================

export function useOnHand(branchId: string, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.onHand(branchId),
    queryFn: () => getOnHand(branchId),
    enabled: enabled && Boolean(branchId),
    select: (data) => data.results,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogOnHand(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OnHandPayload) => logOnHand(branchId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.onHand(branchId) });
    },
  });
}

// ============================================================================
// HOOKS — PHASE 4: INGREDIENT SUPPLIERS
// ============================================================================

export function useIngredientSuppliers(branchId: string, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.ingredientSuppliers(branchId),
    queryFn: () => getIngredientSuppliers(branchId),
    enabled: enabled && Boolean(branchId),
    select: (data) => data.results,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateIngredientSupplier(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: IngredientSupplierPayload) => createIngredientSupplier(branchId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.ingredientSuppliers(branchId) });
    },
  });
}

// ============================================================================
// HOOKS — PHASE 4: PURCHASE FORECAST
// ============================================================================

export function usePurchaseForecast(branchId: string, from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.purchaseForecast(branchId, from, to),
    queryFn: () => getPurchaseForecast(branchId, from, to),
    enabled: enabled && Boolean(branchId) && Boolean(from) && Boolean(to),
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// HOOKS — PHASE 5: BATCH RULES
// ============================================================================

export function useBatchRule(itemId: string, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.batchRule(itemId),
    queryFn: () => getBatchRule(itemId),
    enabled: enabled && Boolean(itemId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertBatchRule(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BatchRulePayload) => upsertBatchRule(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.batchRule(itemId) });
    },
  });
}

// ============================================================================
// HOOKS — PHASE 6: AVAILABILITY OVERRIDES
// ============================================================================

export function useAvailabilityOverrides(branchId: string, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.availabilityOverrides(branchId),
    queryFn: () => getAvailabilityOverrides(branchId),
    enabled: enabled && Boolean(branchId),
    select: (data) => data.results,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAvailabilityOverride(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AvailabilityOverridePayload) => createAvailabilityOverride(branchId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.availabilityOverrides(branchId) });
    },
  });
}

export function useDeactivateAvailabilityOverride(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (overrideId: string) => deactivateAvailabilityOverride(branchId, overrideId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.availabilityOverrides(branchId) });
    },
  });
}
