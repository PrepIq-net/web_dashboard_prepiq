export const inventoryEndpoints = {
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
} as const;
