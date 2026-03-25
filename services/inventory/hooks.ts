import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getIngredients,
  getMenuItems,
  getRecipes,
  createRecipe,
  deleteRecipe,
  getWasteEvents,
  getWasteAnalytics,
  getPrepBatches,
  createIngredient,
  updateIngredient,
  type IngredientPayload,
} from "./service";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const inventoryQueryKeys = {
  all: ["inventory"] as const,
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
};

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
    mutationFn: (data: { ingredient_id: string; quantity: number }) =>
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
