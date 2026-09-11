import { describe, expect, test } from "bun:test";
import { validateOrder } from "../src/rules";

// 2026-09-10 is a Thursday.
const TODAY = "2026-09-10";
const base = { customerName: "Ada", phone: "555-0100" };

describe("cake", () => {
  test("prices by size", () => {
    const r = validateOrder({ ...base, pickupDate: "2026-09-17", item: { type: "cake", size: 6, design: "dinosaur" } }, TODAY);
    expect(r).toEqual({ ok: true, price: 30 });
  });

  test("rejects sizes we do not make", () => {
    const r = validateOrder({ ...base, pickupDate: "2026-09-17", item: { type: "cake", size: 8 as any, design: "x" } }, TODAY);
    expect(r.ok).toBe(false);
  });

  test("rejects pickup less than a week out", () => {
    const r = validateOrder({ ...base, pickupDate: "2026-09-16", item: { type: "cake", size: 4, design: "x" } }, TODAY);
    expect(r).toEqual({ ok: false, error: "Cakes must be ordered at least a week ahead" });
  });
});

describe("cupcakes", () => {
  test("prices $2 each", () => {
    const r = validateOrder({ ...base, pickupDate: "2026-09-17", item: { type: "cupcakes", count: 12, design: "stars" } }, TODAY);
    expect(r).toEqual({ ok: true, price: 24 });
  });

  test("rejects fewer than 10 or more than 40", () => {
    for (const count of [9, 41]) {
      const r = validateOrder({ ...base, pickupDate: "2026-09-17", item: { type: "cupcakes", count, design: "x" } }, TODAY);
      expect(r.ok).toBe(false);
    }
  });

  test("rejects pickup less than a week out", () => {
    const r = validateOrder({ ...base, pickupDate: "2026-09-16", item: { type: "cupcakes", count: 10, design: "x" } }, TODAY);
    expect(r.ok).toBe(false);
  });
});

describe("bread", () => {
  test("is $10 a loaf when ordered Thursday for Friday", () => {
    const r = validateOrder({ ...base, pickupDate: "2026-09-11", item: { type: "bread", bread: "banana" } }, TODAY);
    expect(r).toEqual({ ok: true, price: 10 });
  });

  test("rejects unknown bread types", () => {
    const r = validateOrder({ ...base, pickupDate: "2026-09-11", item: { type: "bread", bread: "rye" as any } }, TODAY);
    expect(r.ok).toBe(false);
  });

  test("rejects pickup that is not a Friday", () => {
    const r = validateOrder({ ...base, pickupDate: "2026-09-12", item: { type: "bread", bread: "banana" } }, TODAY);
    expect(r.ok).toBe(false);
  });

  test("rejects ordering on Friday for that same Friday", () => {
    const r = validateOrder({ ...base, pickupDate: "2026-09-11", item: { type: "bread", bread: "banana" } }, "2026-09-11");
    expect(r.ok).toBe(false);
  });

  test("allows ordering Saturday for the coming Friday", () => {
    const r = validateOrder({ ...base, pickupDate: "2026-09-18", item: { type: "bread", bread: "blueberry" } }, "2026-09-12");
    expect(r.ok).toBe(true);
  });
});

test("rejects missing customer name or phone", () => {
  const r = validateOrder({ customerName: "", phone: "", pickupDate: "2026-09-17", item: { type: "cake", size: 4, design: "x" } }, TODAY);
  expect(r.ok).toBe(false);
});
