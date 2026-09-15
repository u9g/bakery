import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { openDb } from "../src/db.ts";
import { createServer } from "../src/server.ts";

let url: string;
let server: Awaited<ReturnType<typeof createServer>>;

beforeAll(async () => {
  server = await createServer({ db: openDb(":memory:"), port: 0, today: () => "2026-09-10" });
  url = `http://localhost:${server.port}`;
});
afterAll(() => server.stop());

const j = async (res: Response | Promise<Response>): Promise<any> => (await res).json();
const post = (body: unknown) =>
  fetch(`${url}/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("GET /menu lists cakes, cupcakes and breads", async () => {
  const menu = await j(fetch(`${url}/menu`));
  expect(menu.cakes.map((c: any) => c.size)).toEqual([4, 6, 7]);
  expect(menu.cupcakes.pricePer).toBe(2);
  expect(menu.breads.map((b: any) => b.type)).toEqual(["banana", "blueberry", "strawberry"]);
});

test("POST /orders stores a valid order with price and confirmation code", async () => {
  const res = await post({ customerName: "Ada", phone: "555-0100", pickupDate: "2026-09-17", item: { type: "cake", size: 7, design: "rocket" } });
  expect(res.status).toBe(201);
  const order = await j(res);
  expect(order.price).toBe(40);
  expect(order.confirmationCode).toMatch(/^[A-Z0-9]{6}$/);

  const fetched = await j(fetch(`${url}/orders/${order.id}`));
  expect(fetched).toEqual(order);
});

test("POST /orders rejects invalid orders with 400 and a reason", async () => {
  const res = await post({ customerName: "Ada", phone: "555-0100", pickupDate: "2026-09-12", item: { type: "cake", size: 7, design: "rocket" } });
  expect(res.status).toBe(400);
  expect((await j(res)).error).toBe("Cakes must be ordered at least a week ahead");
});

test("POST /orders rejects malformed JSON", async () => {
  const res = await fetch(`${url}/orders`, { method: "POST", body: "{" });
  expect(res.status).toBe(400);
});

test("GET /orders lists stored orders", async () => {
  const list = await j(fetch(`${url}/orders`));
  expect(list.length).toBe(1);
  expect(list[0].customerName).toBe("Ada");
});

test("GET /orders/:id returns 404 for unknown id", async () => {
  expect((await fetch(`${url}/orders/nope`)).status).toBe(404);
});

test("every request logs method, path, status and the reason for a rejection", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    await fetch(`${url}/menu`);
    await post({ customerName: "Ada", phone: "555-0100", pickupDate: "2026-09-12", item: { type: "cake", size: 7, design: "x" } });
    const lines = log.mock.calls.map((c) => c.join(" "));
    expect(lines.some((l) => /^GET \/menu 200 \d+ms$/.test(l))).toBe(true);
    expect(lines.some((l) => /^POST \/orders 400 \d+ms Cakes must be ordered at least a week ahead$/.test(l))).toBe(true);
  } finally {
    log.mockRestore();
  }
});
