import { BREADS, BREAD_PRICE, CAKES, CUPCAKES, type Bread, type CakeSize } from "./menu";

export type Item =
  | { type: "cake"; size: CakeSize; design: string }
  | { type: "cupcakes"; count: number; design: string }
  | { type: "bread"; bread: Bread };

export interface OrderInput {
  customerName: string;
  phone: string;
  /** YYYY-MM-DD */
  pickupDate: string;
  item: Item;
}

export type Validation = { ok: true; price: number } | { ok: false; error: string };

const DAY_MS = 86_400_000;
const FRIDAY = 5;

// Dates are calendar days with no timezone; parse as UTC so day math is exact.
function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / DAY_MS;
}

function fail(error: string): Validation {
  return { ok: false, error };
}

export function validateOrder(input: OrderInput, today: string): Validation {
  if (!input.customerName?.trim()) return fail("Customer name is required");
  if (!input.phone?.trim()) return fail("Phone number is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.pickupDate ?? "") || Number.isNaN(Date.parse(input.pickupDate))) {
    return fail("Pickup date must be YYYY-MM-DD");
  }
  const days = daysBetween(today, input.pickupDate);
  const item = input.item;

  switch (item?.type) {
    case "cake": {
      if (!(item.size in CAKES)) return fail(`We only make ${Object.keys(CAKES).join('", "')}" cakes`);
      if (!item.design?.trim()) return fail("A design phrase is required");
      if (days < 7) return fail("Cakes must be ordered at least a week ahead");
      return { ok: true, price: CAKES[item.size].price };
    }
    case "cupcakes": {
      if (!Number.isInteger(item.count) || item.count < CUPCAKES.min || item.count > CUPCAKES.max) {
        return fail(`Cupcakes are ordered in batches of ${CUPCAKES.min} to ${CUPCAKES.max}`);
      }
      if (!item.design?.trim()) return fail("A design phrase is required");
      if (days < 7) return fail("Cupcakes must be ordered at least a week ahead");
      return { ok: true, price: item.count * CUPCAKES.pricePer };
    }
    case "bread": {
      if (!BREADS.includes(item.bread)) return fail(`Bread types are ${BREADS.join(", ")}`);
      // Pickup is the coming Friday; orders open Saturday and close Thursday (1..6 days ahead).
      if (new Date(input.pickupDate).getUTCDay() !== FRIDAY) return fail("Bread is picked up on Fridays");
      if (days < 1 || days > 6) return fail("Bread must be ordered by Thursday for that Friday");
      return { ok: true, price: BREAD_PRICE };
    }
    default:
      return fail("Item type must be cake, cupcakes, or bread");
  }
}
