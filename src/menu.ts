export const CAKES = {
  4: { serves: 8, price: 20 },
  6: { serves: 12, price: 30 },
  7: { serves: 18, price: 40 },
} as const;
export type CakeSize = keyof typeof CAKES;

export const CUPCAKES = { min: 10, max: 40, pricePer: 2 } as const;

export const BREADS = ["banana", "blueberry", "strawberry"] as const;
export type Bread = (typeof BREADS)[number];
export const BREAD_PRICE = 10;

export const MENU = {
  cakes: Object.entries(CAKES).map(([size, v]) => ({ size: Number(size), ...v })),
  cakeRules: "Tell us a design phrase. Order at least a week ahead.",
  cupcakes: { ...CUPCAKES, rules: "Tell us a design phrase. Order at least a week ahead." },
  breads: BREADS.map((type) => ({ type, price: BREAD_PRICE })),
  breadRules: "Order by Thursday, pick up Friday of the same week.",
};
