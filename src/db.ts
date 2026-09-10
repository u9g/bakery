import { Database } from "bun:sqlite";
import type { OrderInput } from "./rules";

export interface Order extends OrderInput {
  id: string;
  code: string;
  price: number;
  createdAt: string;
}

export function openDb(path: string) {
  const db = new Database(path, { create: true, strict: true });
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    customerName TEXT NOT NULL,
    phone TEXT NOT NULL,
    pickupDate TEXT NOT NULL,
    item TEXT NOT NULL,
    price INTEGER NOT NULL,
    createdAt TEXT NOT NULL
  )`);

  const insert = db.query(
    `INSERT INTO orders VALUES ($id, $code, $customerName, $phone, $pickupDate, $item, $price, $createdAt)`,
  );
  const byId = db.query<Row, { id: string }>(`SELECT * FROM orders WHERE id = $id`);
  const all = db.query<Row, []>(`SELECT * FROM orders ORDER BY createdAt`);

  return {
    insert(order: Order) {
      insert.run({ ...order, item: JSON.stringify(order.item) });
    },
    get(id: string): Order | undefined {
      const row = byId.get({ id });
      return row ? fromRow(row) : undefined;
    },
    list(): Order[] {
      return all.all().map(fromRow);
    },
  };
}
export type Db = ReturnType<typeof openDb>;

type Row = Omit<Order, "item"> & { item: string };
const fromRow = (r: Row): Order => ({ ...r, item: JSON.parse(r.item) });
