import { DatabaseSync } from "node:sqlite";
import type { OrderRequest } from "./rules.ts";

export type Order = OrderRequest & {
  id: string;
  confirmationCode: string;
  price: number;
  createdAt: string;
};

export function openDb(path: string) {
  const db = new DatabaseSync(path);
  // orders(id, confirmationCode, customerName, phone, pickupDate, item, price, createdAt)
  db.exec(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    confirmationCode TEXT NOT NULL,
    customerName TEXT NOT NULL,
    phone TEXT NOT NULL,
    pickupDate TEXT NOT NULL,
    item TEXT NOT NULL,
    price INTEGER NOT NULL,
    createdAt TEXT NOT NULL
  )`);

  const insert = db.prepare(
    `INSERT INTO orders VALUES ($id, $confirmationCode, $customerName, $phone, $pickupDate, $item, $price, $createdAt)`,
  );
  const selectById = db.prepare(`SELECT * FROM orders WHERE id = $id`);
  const selectAll = db.prepare(`SELECT * FROM orders ORDER BY createdAt`);

  return {
    insert(order: Order) {
      insert.run({ ...order, item: JSON.stringify(order.item) });
    },
    get(id: string): Order | undefined {
      const row = selectById.get({ id });
      return row ? deserializeOrderDetails(row) : undefined;
    },
    list(): Order[] {
      return selectAll.all().map(deserializeOrderDetails);
    },
  };
}
export type Db = ReturnType<typeof openDb>;

type Row = Omit<Order, "item"> & { item: string };
const deserializeOrderDetails = (r: object): Order => {
  const row = r as Row;
  return { ...row, item: JSON.parse(row.item) };
};
