import { createClient } from "@libsql/client";

const client = createClient({ url: "file:./db.sqlite" });

const orders = await client.execute(`
  SELECT id, created_at, amount_paid, total_amount, order_status, payment_status
  FROM orders ORDER BY id DESC LIMIT 15
`);
const investors = await client.execute(`SELECT * FROM investors`);
const agreements = await client.execute(`SELECT * FROM investor_agreements`);
const payouts = await client.execute(`SELECT * FROM investor_payouts`);

console.log("=== INVESTORS ===", investors.rows);
console.log("=== AGREEMENTS ===", agreements.rows);
console.log("=== PAYOUTS ===", payouts.rows);
console.log("=== ORDERS ===");
for (const o of orders.rows) {
  const d = new Date(Number(o.created_at));
  console.log({
    id: o.id,
    createdPH: d.toLocaleString("en-PH", { timeZone: "Asia/Manila" }),
    amountPaid: o.amount_paid,
    status: o.order_status,
    payment: o.payment_status,
  });
}

client.close();
