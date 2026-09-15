import http from "node:http";
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

const json = (body: unknown, status = 200) => Response.json(body, { status });

// Excludes look-alike characters so the code is unambiguous when read aloud.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newConfirmationCode = () =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

type Handler = (req: Request, params: Record<string, string>) => Response | Promise<Response>;

// Every route logs one line: method, path, status, duration, and the reason for a rejection.
function logged(handler: Handler): Handler {
  return async (req, params) => {
    const started = performance.now();
    const res = await handler(req, params);
    const ms = Math.round(performance.now() - started);
    const reason = res.status >= 400 ? ((await res.clone().json()) as { error?: string }).error : undefined;
    console.log(`${req.method} ${new URL(req.url).pathname} ${res.status} ${ms}ms${reason ? ` ${reason}` : ""}`);
    return res;
  };
}

type Routes = Record<string, Record<string, Handler>>;

// "/orders/:id" matches one path segment per ":name" and exposes it in params.
function matchRoute(routes: Routes, pathname: string): [Record<string, Handler>, Record<string, string>] | undefined {
  for (const [pattern, methods] of Object.entries(routes)) {
    const names: string[] = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, n) => (names.push(n), "([^/]+)"))}$`);
    const m = pathname.match(re);
    if (m) return [methods, Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1]!)]))];
  }
  return undefined;
}

async function toRequest(req: http.IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(`http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body,
  });
}

async function send(res: http.ServerResponse, out: Response) {
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}

export function createServer({ db, port, today }: Options) {
  const routes: Routes = {
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
        GET: (_req, params) => {
          const order = db.get(params.id!);
          return order ? json(order) : json({ error: "Order not found" }, 404);
        },
      },
  };

  const server = http.createServer(async (req, res) => {
    const request = await toRequest(req);
    const matched = matchRoute(routes, new URL(request.url).pathname);
    const handler = matched?.[0][request.method];
    const out = handler ? await logged(handler)(request, matched![1]) : json({ error: "Not found" }, 404);
    await send(res, out);
  });

  return new Promise<{ port: number; url: string; stop: () => void }>((resolve) => {
    server.listen(port, () => {
      const addr = server.address() as { port: number };
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
