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

// any: routes keep their own path-typed params; the wrapper only reads method and url
type Handler = (req: Bun.BunRequest<any>) => Response | Promise<Response>;

// Every route logs one line: method, path, status, duration, and the reason for a rejection.
function logged(handler: Handler): Handler {
  return async (req) => {
    const started = performance.now();
    const res = await handler(req);
    const ms = Math.round(performance.now() - started);
    const reason = res.status >= 400 ? ((await res.clone().json()) as { error?: string }).error : undefined;
    console.log(`${req.method} ${new URL(req.url).pathname} ${res.status} ${ms}ms${reason ? ` ${reason}` : ""}`);
    return res;
  };
}

function withLogging<T extends Record<string, Record<string, Handler>>>(routes: T): T {
  return Object.fromEntries(
    Object.entries(routes).map(([path, methods]) => [
      path,
      Object.fromEntries(Object.entries(methods).map(([method, h]) => [method, logged(h)])),
    ]),
  ) as T;
}

export function createServer({ db, port, today }: Options) {
  return Bun.serve({
    port,
    routes: withLogging({
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
        GET: (req: Bun.BunRequest<"/orders/:id">) => {
          const order = db.get(req.params.id);
          return order ? json(order) : json({ error: "Order not found" }, 404);
        },
      },
    }),
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
