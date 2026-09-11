import type { Db } from "./db";
import { openDb } from "./db";
import { MENU } from "./menu";
import { validateOrder, type OrderRequest } from "./rules";

interface Options {
  db: Db;
  port: number;
  /** Calendar date (YYYY-MM-DD) used for pickup-date rules. */
  today: () => string;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

// Excludes look-alike characters so the code is unambiguous when read aloud.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newConfirmationCode = () =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

export function createServer({ db, port, today }: Options) {
  return Bun.serve({
    port,
    routes: {
      "/menu": { GET: () => json(MENU) },
      "/orders": {
        GET: () => json(db.list()),
        POST: async (req) => {
          let input: OrderRequest;
          try {
            input = (await req.json()) as OrderRequest;
          } catch {
            return json({ error: "Body must be JSON" }, 400);
          }
          const result = validateOrder(input, today());
          if (!result.ok) return json({ error: result.error }, 400);
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
          return json(order, 201);
        },
      },
      "/orders/:id": {
        GET: (req) => {
          const order = db.get(req.params.id);
          return order ? json(order) : json({ error: "Order not found" }, 404);
        },
      },
    },
    fetch: () => json({ error: "Not found" }, 404),
  });
}

if (import.meta.main) {
  const server = createServer({
    db: openDb(process.env.DB_PATH ?? "bakery.sqlite"),
    port: Number(process.env.PORT ?? 3099),
    // BAKERY_TODAY pins the clock so simulations are reproducible regardless of the run date.
    today: () => process.env.BAKERY_TODAY ?? new Date().toISOString().slice(0, 10),
  });
  console.log(`bakery-api listening on ${server.url}`);
}
