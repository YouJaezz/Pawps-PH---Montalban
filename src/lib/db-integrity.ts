import type { Client } from "@libsql/client";

/** Keep branch stock rows, product totals, and order branch links consistent. */
export async function repairDatabaseIntegrity(client: Client) {
  const branchCount = await client.execute(
    "SELECT COUNT(*) AS c FROM branches",
  );
  if (Number(branchCount.rows[0]?.c ?? 0) === 0) {
    await client.execute(`
      INSERT INTO branches (name, location, notes, is_default, active)
      VALUES ('PAWPS Shop', 'Montalban store', 'Main shop — auto-created during repair', 1, 1)
    `);
    console.log("Repair: created default PAWPS Shop branch");
  }

  const defaultBranch = await client.execute(
    "SELECT id FROM branches WHERE is_default = 1 AND active = 1 LIMIT 1",
  );
  let defaultBranchId = Number(defaultBranch.rows[0]?.id ?? 0);
  if (!defaultBranchId) {
    const fallback = await client.execute(
      "SELECT id FROM branches WHERE active = 1 ORDER BY id LIMIT 1",
    );
    defaultBranchId = Number(fallback.rows[0]?.id ?? 0);
    if (defaultBranchId) {
      await client.execute(
        "UPDATE branches SET is_default = 1 WHERE id = ?",
        [defaultBranchId],
      );
    }
  }

  if (defaultBranchId) {
    await client.execute(
      `
      INSERT INTO branch_stock (branch_id, product_id, stock_quantity)
      SELECT ?, p.id, p.stock_quantity
      FROM products p
      WHERE NOT EXISTS (
        SELECT 1 FROM branch_stock bs
        WHERE bs.product_id = p.id AND bs.branch_id = ?
      )
    `,
      [defaultBranchId, defaultBranchId],
    );

    await client.execute(
      `
      UPDATE products
      SET stock_quantity = COALESCE(
        (SELECT SUM(stock_quantity) FROM branch_stock WHERE product_id = products.id),
        0
      )
    `,
    );

    await client.execute(
      "UPDATE orders SET branch_id = ? WHERE branch_id IS NULL",
      [defaultBranchId],
    );

    await client.execute(
      "UPDATE stock_movements SET branch_id = ? WHERE branch_id IS NULL",
      [defaultBranchId],
    );
  }
}
