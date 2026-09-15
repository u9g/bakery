import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Db } from "./db.ts";
import { openDb } from "./db.ts";
import { MENU } from "./menu.ts";
import { validateOrder, type OrderRequest } from "./rules.ts";

interface Options {
  db: Db;
  port: number;
  /** Calendar date (YYYY-MM-DD) used for pickup-date rules. */
  today: () => string;
}

// Excludes look-alike characters so the code is unambiguous when read aloud.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newConfirmationCode = () =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

export function createServer({ db, port, today }: Options) {
  const app = new Hono();

  // Every request logs one line: method, path, status, duration, and the reason for a rejection.
  app.use(async (c, next) => {
    const started = performance.now();
    await next();
    const ms = Math.round(performance.now() - started);
    const reason = c.res.status >= 400 ? ((await c.res.clone().json()) as { error?: string }).error : undefined;
    console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms${reason ? ` ${reason}` : ""}`);
  });

  app.get("/menu", (c) => c.json(MENU));
  app.get("/orders", (c) => c.json(db.list()));
  app.get("/orders/:id", (c) => {
    const order = db.get(c.req.param("id"));
    return order ? c.json(order) : c.json({ error: "Order not found" }, 404);
  });
  app.post("/orders", async (c) => {
    let input: OrderRequest;
    try {
      input = await c.req.json();
    } catch {
      return c.json({ error: "Body must be JSON" }, 400);
    }
    const result = validateOrder(input, today());
    if (!result.ok) return c.json({ error: result.error }, 400);
    const order = {
      id: crypto.randomUUID(),
      confirmationCode: newConfirmationCode(),
      customerName: input.customerName,
      phone: input.phone,
      pickupDate: input.pickupDate,
      item: input.item,
      price: result.price,
      createdAt: new Date().toISOString(),
    };
    db.insert(order);
    return c.json(order, 201);
  });
  app.notFound((c) => c.json({ error: "Not found" }, 404));

  return new Promise<{ port: number; url: string; stop: () => void }>((resolve) => {
    const server = serve({ fetch: app.fetch, port }, (addr) => {
      resolve({ port: addr.port, url: `http://localhost:${addr.port}`, stop: () => server.close() });
    });
  });
}

if (import.meta.main) {
  const server = await createServer({
    db: openDb(process.env.DB_PATH ?? "bakery.sqlite"),
    port: Number(process.env.PORT ?? 3099),
    // BAKERY_TODAY pins the clock so simulations are reproducible regardless of the run date.
    today: () => process.env.BAKERY_TODAY ?? new Date().toISOString().slice(0, 10),
  });
  console.log(`bakery-api listening on ${server.url}`);
}
