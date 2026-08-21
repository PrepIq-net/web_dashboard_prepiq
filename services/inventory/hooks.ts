import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import {
  getCatalogItems,
  getIngredients,
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  confirmMenuItemReview,
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
  getPurchaseRecommendation,
  recomputePurchaseRecommendation,
  approvePurchaseRecommendation,
  sendPurchaseRecommendationToSuppliers,
  updatePurchaseRecommendationLine,
  receiveDelivery,
  getSupplierSummary,
  getIngredientCostTrend,
  getCostVariance,
  getPurchasingEfficiency,
  updateIngredientVarianceCause,
  getMenuItemPrice,
  updateMenuItemPrice,
  type IngredientPayload,
  type MenuItemPayload,
  type OnHandPayload,
  type IngredientSupplierPayload,
  type BatchRulePayload,
  type AvailabilityOverridePayload,
  type ReceiveDeliveryPayload,
  type IngredientVarianceCausePayload,
  type UpdateMenuItemPricePayload,
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
  purchaseRecommendation: (branchId: string, date: string) =>
    [...inventoryQueryKeys.all, "purchaseRecommendation", branchId, date] as const,
  supplierSummary: (branchId: string) =>
    [...inventoryQueryKeys.all, "supplierSummary", branchId] as const,
  costTrend: (branchId: string) =>
    [...inventoryQueryKeys.all, "costTrend", branchId] as const,
  costVariance: (branchId: string) =>
    [...inventoryQueryKeys.all, "costVariance", branchId] as const,
  purchasingEfficiency: (branchId: string) =>
    [...inventoryQueryKeys.all, "purchasingEfficiency", branchId] as const,
  menuItemPrice: (branchId: string, menuItemId: string) =>
    [...inventoryQueryKeys.all, "menuItemPrice", branchId, menuItemId] as const,
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

export function useConfirmMenuItemReview(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (menuItemId: string) => confirmMenuItemReview(branchId, menuItemId),
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
// HOOKS — PHASE 3/4: UNIFIED PURCHASE RECOMMENDATION
// ============================================================================

/** 404 (nothing computed for this date yet) is a real, distinct state —
 * not a transient failure worth retrying. */
function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function usePurchaseRecommendation(branchId: string, date: string, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.purchaseRecommendation(branchId, date),
    queryFn: () => getPurchaseRecommendation(branchId, date),
    enabled: enabled && Boolean(branchId) && Boolean(date),
    retry: (failureCount, error) => (isNotFound(error) ? false : failureCount < 2),
    staleTime: 60 * 1000,
  });
}

export function useRecomputePurchaseRecommendation(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => recomputePurchaseRecommendation(branchId, date),
    onSuccess: (data) => {
      queryClient.setQueryData(
        inventoryQueryKeys.purchaseRecommendation(branchId, data.generated_for_date),
        data
      );
    },
  });
}

export function useApprovePurchaseRecommendation(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recommendationId: string) => approvePurchaseRecommendation(branchId, recommendationId),
    onSuccess: (data) => {
      queryClient.setQueryData(
        inventoryQueryKeys.purchaseRecommendation(branchId, data.generated_for_date),
        data
      );
    },
  });
}

export function useSendPurchaseRecommendationToSuppliers(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recommendationId: string) =>
      sendPurchaseRecommendationToSuppliers(branchId, recommendationId),
    onSuccess: (data) => {
      queryClient.setQueryData(
        inventoryQueryKeys.purchaseRecommendation(branchId, data.recommendation.generated_for_date),
        data.recommendation
      );
    },
  });
}

export function useUpdatePurchaseRecommendationLine(branchId: string, date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, managerOverrideQty }: { lineId: string; managerOverrideQty: number | null }) =>
      updatePurchaseRecommendationLine(branchId, lineId, managerOverrideQty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.purchaseRecommendation(branchId, date) });
    },
  });
}

export function useReceiveDelivery(branchId: string, date?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReceiveDeliveryPayload) => receiveDelivery(branchId, data),
    onSuccess: () => {
      if (date) {
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.purchaseRecommendation(branchId, date) });
      }
      // A receipt changes what every one of these tabs reads: spend
      // (suppliers), the latest priced delivery (cost trend + variance),
      // and received-vs-planned counts (efficiency).
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.supplierSummary(branchId) });
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.costTrend(branchId) });
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.costVariance(branchId) });
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.purchasingEfficiency(branchId) });
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.onHand(branchId) });
    },
  });
}

// Records why one ingredient's actual usage missed prediction. Mirrors
// production-intelligence's useUpdateBranchDayNotes: no query invalidation —
// the EOD wizard keeps its own optimistic per-row state, same as
// DayVarianceCausePrompt does for the day-level cause.
export function useUpdateIngredientVarianceCause(branchId: string) {
  return useMutation({
    mutationFn: ({
      usageId,
      ...payload
    }: { usageId: string } & IngredientVarianceCausePayload) =>
      updateIngredientVarianceCause(branchId, usageId, payload),
  });
}

// ============================================================================
// HOOKS — PHASE 4: PURCHASING PAGE ANALYTICS
// ============================================================================

export function useSupplierSummary(branchId: string, windowDays = 90, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.supplierSummary(branchId),
    queryFn: () => getSupplierSummary(branchId, windowDays),
    enabled: enabled && Boolean(branchId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useIngredientCostTrend(branchId: string, windowDays = 90, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.costTrend(branchId),
    queryFn: () => getIngredientCostTrend(branchId, windowDays),
    enabled: enabled && Boolean(branchId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCostVariance(branchId: string, windowDays = 90, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.costVariance(branchId),
    queryFn: () => getCostVariance(branchId, windowDays),
    enabled: enabled && Boolean(branchId),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePurchasingEfficiency(branchId: string, windowDays = 90, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.purchasingEfficiency(branchId),
    queryFn: () => getPurchasingEfficiency(branchId, windowDays),
    enabled: enabled && Boolean(branchId),
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

// ============================================================================
// HOOKS — PRICE INTELLIGENCE PHASE A
// ============================================================================

export function useMenuItemPrice(branchId: string, menuItemId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: inventoryQueryKeys.menuItemPrice(branchId, menuItemId ?? ""),
    queryFn: () => getMenuItemPrice(branchId, menuItemId as string),
    enabled: enabled && Boolean(branchId) && Boolean(menuItemId),
  });
}

export function useUpdateMenuItemPrice(branchId: string, menuItemId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateMenuItemPricePayload) =>
      updateMenuItemPrice(branchId, menuItemId as string, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(inventoryQueryKeys.menuItemPrice(branchId, menuItemId ?? ""), data);
    },
  });
}
