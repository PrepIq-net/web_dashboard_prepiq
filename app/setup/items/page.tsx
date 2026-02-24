"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  HandCash,
  Page,
  NavArrowRight,
} from "iconoir-react";

interface SeededItem {
  id: string;
  name: string;
  category: string;
  price: string;
  cost: string;
}

const MOCK_ITEMS: SeededItem[] = [
  {
    id: "1",
    name: "Butter Croissant",
    category: "Pastries",
    price: "4.50",
    cost: "0.80",
  },
  {
    id: "2",
    name: "Almond Croissant",
    category: "Pastries",
    price: "5.50",
    cost: "1.20",
  },
  {
    id: "3",
    name: "Oat Milk Latte (12oz)",
    category: "Beverages",
    price: "6.00",
    cost: "1.15",
  },
  {
    id: "4",
    name: "Spicy Chicken Bowl",
    category: "Mains",
    price: "14.50",
    cost: "",
  }, // No cost yet
  {
    id: "5",
    name: "Avocado Toast",
    category: "Mains",
    price: "12.00",
    cost: "3.50",
  },
  {
    id: "6",
    name: "Cold Brew",
    category: "Beverages",
    price: "5.00",
    cost: "0.90",
  },
];

const CATEGORIES = [
  "Pastries",
  "Beverages",
  "Mains",
  "Sides",
  "Retail",
  "Uncategorized",
];

export default function ItemConfirmationPage() {
  const router = useRouter();
  const [items, setItems] = useState<SeededItem[]>(MOCK_ITEMS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleUpdate(id: string, field: keyof SeededItem, value: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  async function handleConfirm() {
    setIsSubmitting(true);
    // Simulating API call to save items
    setTimeout(() => {
      // After items are saved, we move to the next step (forecast)
      router.push("/setup/forecast");
    }, 1200);
  }

  // Count items missing cost
  const missingCostCount = items.filter((i) => !i.cost.trim()).length;

  return (
    <div className="min-h-screen bg-[#141416] p-6 flex flex-col items-center">
      <div className="w-full max-w-4xl mt-12 mb-20">
        {/* Step Context */}
        <div className="flex items-center gap-2 mb-8">
          <Page className="h-4 w-4 text-[#A8821F]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            Step 3 — Item Confirmation
          </span>
        </div>

        <h1 className="font-display text-[32px] leading-[40px] font-semibold text-[#F5F5F7] mb-3">
          We detected {items.length} items.
        </h1>
        <p className="text-[14px] leading-[22px] text-[#8E8E93] max-w-2xl mb-8">
          This step transforms raw sales data into actionable items. Confirm the
          selling price and add an <strong>estimated cost</strong> so PrepIQ can
          track your profit margins and automatically calculate ingredient-level
          impacts.
        </p>

        {/* Warning if costs are missing */}
        {missingCostCount > 0 && (
          <div className="bg-[#C48B2A]/10 border border-[#C48B2A] rounded-[8px] p-4 flex items-start gap-3 mb-6">
            <HandCash className="h-5 w-5 text-[#C48B2A] shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-[#F5F5F7]">
                {missingCostCount}{" "}
                {missingCostCount === 1 ? "item is" : "items are"} missing a
                cost estimate.
              </p>
              <p className="text-[12px] text-[#C7C7CC] mt-1">
                Without a cost estimate, we cannot project your profitability on
                these items. You can add this later, but we recommend filling it
                in now.
              </p>
            </div>
          </div>
        )}

        {/* Table/List */}
        <div className="bg-[#1C1C1F] border border-[#2E2E33] rounded-[12px] overflow-hidden mb-8">
          {/* Header */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-4 p-4 border-b border-[#2E2E33] bg-[#232327]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Item Name
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Category
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Sell Price
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Est. Cost
            </div>
          </div>
          {/* Rows */}
          <div className="divide-y divide-[#2E2E33]">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-4 p-3 items-center hover:bg-[#232327]/50 transition-colors"
              >
                {/* Name (Readonly) */}
                <div className="text-[14px] font-medium text-[#F5F5F7] pl-1 truncate">
                  {item.name}
                </div>

                {/* Category */}
                <div>
                  <select
                    value={item.category}
                    onChange={(e) =>
                      handleUpdate(item.id, "category", e.target.value)
                    }
                    className="w-full h-9 bg-[#141416] border border-[#2E2E33] rounded-[6px] px-3 text-[13px] text-[#F5F5F7] focus:outline-none focus:border-[#A8821F] appearance-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#5A5A60]">
                    $
                  </span>
                  <input
                    type="text"
                    value={item.price}
                    onChange={(e) =>
                      handleUpdate(item.id, "price", e.target.value)
                    }
                    className="w-full h-9 bg-[#141416] border border-[#2E2E33] rounded-[6px] pl-6 pr-3 text-[13px] text-[#F5F5F7] focus:outline-none focus:border-[#A8821F] tabular-nums"
                  />
                </div>

                {/* Cost */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#5A5A60]">
                    $
                  </span>
                  <input
                    type="text"
                    value={item.cost}
                    onChange={(e) =>
                      handleUpdate(item.id, "cost", e.target.value)
                    }
                    placeholder="0.00"
                    className={`w-full h-9 bg-[#141416] border rounded-[6px] pl-6 pr-3 text-[13px] focus:outline-none tabular-nums
                      ${
                        !item.cost.trim()
                          ? "border-[#C48B2A]/50 placeholder-[#C48B2A]/30 text-[#C48B2A] focus:border-[#C48B2A]"
                          : "border-[#2E2E33] text-[#F5F5F7] focus:border-[#A8821F]"
                      }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-[#2E2E33] pt-6">
          <button
            onClick={() => router.push("/")}
            className="text-[13px] text-[#5A5A60] hover:text-[#8E8E93] transition-colors font-medium"
          >
            Skip for now
          </button>

          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="h-11 px-6 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] disabled:opacity-50 disabled:cursor-not-allowed text-[#141416] text-[14px] font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150"
          >
            {isSubmitting ? "Saving items..." : "Confirm & Continue"}
            {!isSubmitting && <NavArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
