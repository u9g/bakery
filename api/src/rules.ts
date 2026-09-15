import { z } from "zod";
import { BREADS, BREAD_PRICE, CAKE_SIZES, CAKES, CUPCAKES } from "./menu.ts";

const design = z.string().trim().min(1, "A design phrase is required");

export const OrderRequest = z.object({
  customerName: z.string().trim().min(1, "Customer name is required"),
  phone: z.string().trim().min(1, "Phone number is required"),
  pickupDate: z.iso.date("Pickup date must be YYYY-MM-DD"),
  item: z.discriminatedUnion(
    "type",
    [
      z.object({
        type: z.literal("cake"),
        size: z.literal(CAKE_SIZES, `We only make ${CAKE_SIZES.join('", "')}" cakes`),
        design,
      }),
      z.object({
        type: z.literal("cupcakes"),
        count: z
          .int()
          .min(CUPCAKES.min, `Cupcakes are ordered in batches of ${CUPCAKES.min} to ${CUPCAKES.max}`)
          .max(CUPCAKES.max, `Cupcakes are ordered in batches of ${CUPCAKES.min} to ${CUPCAKES.max}`),
        design,
      }),
      z.object({
        type: z.literal("bread"),
        bread: z.enum(BREADS, `Bread types are ${BREADS.join(", ")}`),
      }),
    ],
    "Item type must be cake, cupcakes, or bread",
  ),
});
export type OrderRequest = z.infer<typeof OrderRequest>;

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

export function validateOrder(input: unknown, today: string): Validation {
  const parsed = OrderRequest.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);
  const { item, pickupDate } = parsed.data;
  const days = daysBetween(today, pickupDate);

  switch (item.type) {
    case "cake":
      if (days < 7) return fail("Cakes must be ordered at least a week ahead");
      return { ok: true, price: CAKES[item.size].price };
    case "cupcakes":
      if (days < 7) return fail("Cupcakes must be ordered at least a week ahead");
      return { ok: true, price: item.count * CUPCAKES.pricePer };
    case "bread":
      // Pickup is the coming Friday; orders open Saturday and close Thursday (1..6 days ahead).
      if (new Date(pickupDate).getUTCDay() !== FRIDAY) return fail("Bread is picked up on Fridays");
      if (days < 1 || days > 6) return fail("Bread must be ordered by Thursday for that Friday");
      return { ok: true, price: BREAD_PRICE };
  }
}
