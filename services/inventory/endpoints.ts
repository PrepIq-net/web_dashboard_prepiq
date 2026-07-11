export const inventoryEndpoints = {
  // Catalog items (org-scoped master catalog — used for promotion item selection)
  catalogItems: {
    list: (organizationId: string) =>
      `/api/catalog/items/?organization_id=${organizationId}&page_size=200`,
  },

  // Ingredients (org-scoped, filter by organization_id query param)
  ingredients: {
    list: (organizationId: string) => `/api/inventory/ingredients/?organization_id=${organizationId}`,
    create: "/api/inventory/ingredients/",
    detail: (ingredientId: string) => `/api/inventory/ingredients/${ingredientId}/`,
    update: (ingredientId: string) => `/api/inventory/ingredients/${ingredientId}/`,
    delete: (ingredientId: string) => `/api/inventory/ingredients/${ingredientId}/`,
  },

  // Menu Items (branch scoped)
  menuItems: {
    list: (branchId: string) => `/api/inventory/branches/${branchId}/menu-items/`,
    create: (branchId: string) => `/api/inventory/branches/${branchId}/menu-items/`,
    detail: (branchId: string, menuItemId: string) => 
      `/api/inventory/branches/${branchId}/menu-items/${menuItemId}/`,
    update: (branchId: string, menuItemId: string) => 
      `/api/inventory/branches/${branchId}/menu-items/${menuItemId}/`,
    delete: (branchId: string, menuItemId: string) =>
      `/api/inventory/branches/${branchId}/menu-items/${menuItemId}/`,
    confirmReview: (branchId: string, menuItemId: string) =>
      `/api/inventory/branches/${branchId}/menu-items/${menuItemId}/confirm-review/`,
  },

  // Recipes (menu-item scoped)
  recipes: {
    list: (menuItemId: string) => `/api/inventory/menu-items/${menuItemId}/recipes/`,
    create: (menuItemId: string) => `/api/inventory/menu-items/${menuItemId}/recipes/`,
    detail: (menuItemId: string, recipeId: string) => 
      `/api/inventory/menu-items/${menuItemId}/recipes/${recipeId}/`,
    update: (menuItemId: string, recipeId: string) => 
      `/api/inventory/menu-items/${menuItemId}/recipes/${recipeId}/`,
    delete: (menuItemId: string, recipeId: string) => 
      `/api/inventory/menu-items/${menuItemId}/recipes/${recipeId}/`,
  },

  // Demand & Usage
  demand: {
    calculate: "/api/inventory/demand/calculate/",
    history: "/api/inventory/demand/history/",
    recordActual: "/api/inventory/demand/record-actual/",
  },

  // Prep Batches
  prepBatches: {
    list: (branchId: string) => `/api/inventory/branches/${branchId}/prep-batches/`,
    create: (branchId: string) => `/api/inventory/branches/${branchId}/prep-batches/`,
  },

  // Waste Events & Analytics
  waste: {
    events: (branchId: string) => `/api/inventory/branches/${branchId}/waste-events/`,
    analytics: (branchId: string) => `/api/inventory/branches/${branchId}/waste-analytics/`,
  },

  // Recipe Intelligence
  recipeIntelligence: {
    autoGenerate: (menuItemId: string) =>
      `/api/inventory/menu-items/${menuItemId}/auto-generate-recipe/`,
  },

  // Phase 4 — On-hand stock
  onHand: {
    list:   (branchId: string) => `/api/inventory/branches/${branchId}/on-hand/`,
    create: (branchId: string) => `/api/inventory/branches/${branchId}/on-hand/`,
  },

  // Phase 4 — Ingredient suppliers
  ingredientSuppliers: {
    list:   (branchId: string) => `/api/inventory/branches/${branchId}/ingredient-suppliers/`,
    create: (branchId: string) => `/api/inventory/branches/${branchId}/ingredient-suppliers/`,
  },

  // Phase 4 — Purchase forecast
  purchaseForecast: {
    get: (branchId: string) => `/api/inventory/branches/${branchId}/purchase-forecast/`,
  },

  // Phase 5 — Batch rules (catalog-scoped)
  batchRule: {
    get:    (itemId: string) => `/api/catalog/items/${itemId}/batch-rule/`,
    update: (itemId: string) => `/api/catalog/items/${itemId}/batch-rule/`,
  },

  // Phase 6 — Availability overrides (catalog-scoped)
  availabilityOverrides: {
    list:   (branchId: string) => `/api/catalog/branches/${branchId}/availability-overrides/`,
    create: (branchId: string) => `/api/catalog/branches/${branchId}/availability-overrides/`,
    detail: (branchId: string, overrideId: string) =>
      `/api/catalog/branches/${branchId}/availability-overrides/${overrideId}/`,
  },
} as const;
