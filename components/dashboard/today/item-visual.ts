import {
  BirthdayCake,
  BreadSlice,
  CoffeeCup,
  Cookie,
  Cutlery,
  Egg,
  Fish,
  GlassHalf,
  IceCream,
  Leaf,
  Package,
  PizzaSlice,
} from "iconoir-react";

export type CategoryIcon = typeof Cutlery;

/**
 * What icon reads as "this item" before any photo has loaded.
 *
 * `product_category` is free-text and org-defined, so this is a best-effort
 * read of it — never authoritative. Ordered most-specific first: "iced
 * coffee" should draw a cup, not fall through to the generic drink glass.
 */
const CATEGORY_RULES: Array<{ icon: CategoryIcon; test: RegExp }> = [
  { icon: IceCream, test: /ice.?cream|gelato|sorbet|frozen (dessert|treat)/i },
  { icon: BirthdayCake, test: /cake|pastr|dessert|sweet|donut|doughnut/i },
  { icon: Cookie, test: /cookie|biscuit/i },
  { icon: BreadSlice, test: /bread|bakery|\bbun\b|\broll\b/i },
  { icon: PizzaSlice, test: /pizza/i },
  { icon: CoffeeCup, test: /coffee|espresso|latte|cappuccino|mocha|\btea\b|chai/i },
  {
    icon: GlassHalf,
    test: /juice|smoothie|shake|soda|cola|cocktail|\bwine\b|\bbeer\b|\bwater\b|beverage|\bdrink/i,
  },
  { icon: Fish, test: /fish|seafood|shrimp|prawn|salmon|tuna|sushi/i },
  { icon: Leaf, test: /salad|greens|vegetable|\bveg\b|healthy/i },
  { icon: Egg, test: /\begg|breakfast|omelette/i },
];

/** Reliable second read when the category text doesn't match anything —
 * the three-way prep classification is backend-computed, not free text. */
const PREPARATION_FALLBACK: Partial<Record<string, CategoryIcon>> = {
  STOCKED: Package,
  ASSEMBLED: GlassHalf,
  PREPARED: Cutlery,
};

export function classifyItemIcon(
  category?: string | null,
  preparationCode?: string | null,
): CategoryIcon {
  if (category) {
    const hit = CATEGORY_RULES.find((rule) => rule.test.test(category));
    if (hit) return hit.icon;
  }
  if (preparationCode && PREPARATION_FALLBACK[preparationCode]) {
    return PREPARATION_FALLBACK[preparationCode]!;
  }
  return Cutlery;
}
