import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function resolveCustomerForOrder(params: {
  customerId?: number;
  customerName: string;
  contact?: string;
  location?: string;
}) {
  const name = params.customerName.trim();
  if (!name) return null;

  const contact = params.contact?.trim() || null;
  const location = params.location?.trim() || null;

  if (params.customerId && params.customerId > 0) {
    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, params.customerId))
      .limit(1);

    if (existing) {
      const updates: Partial<{
        contact: string;
        location: string;
      }> = {};
      if (contact && !existing.contact) updates.contact = contact;
      if (location && !existing.location) updates.location = location;
      if (Object.keys(updates).length > 0) {
        await db
          .update(customers)
          .set(updates)
          .where(eq(customers.id, existing.id));
      }
      return existing.id;
    }
  }

  const [byName] = await db
    .select()
    .from(customers)
    .where(sql`lower(${customers.name}) = ${name.toLowerCase()}`)
    .limit(1);

  if (byName) {
    const updates: Partial<{ contact: string; location: string }> = {};
    if (contact && !byName.contact) updates.contact = contact;
    if (location && !byName.location) updates.location = location;
    if (Object.keys(updates).length > 0) {
      await db.update(customers).set(updates).where(eq(customers.id, byName.id));
    }
    return byName.id;
  }

  const inserted = await db
    .insert(customers)
    .values({
      name,
      contact,
      location,
    })
    .returning({ id: customers.id });

  return inserted[0]?.id ?? null;
}

export async function bumpCustomerSpend(customerId: number, deltaCents: number) {
  if (deltaCents <= 0) return;
  await db
    .update(customers)
    .set({ totalSpend: sql`${customers.totalSpend} + ${deltaCents}` })
    .where(eq(customers.id, customerId));
}
