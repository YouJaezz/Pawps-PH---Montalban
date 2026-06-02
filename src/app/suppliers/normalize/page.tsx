import Link from "next/link";

import { NormalizePricelistClient } from "@/app/suppliers/normalize/NormalizePricelistClient";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { isAnthropicApiConfigured } from "@/lib/pricelist-normalize-ai";

export default async function NormalizePricelistPage() {
  const supplierRows = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .orderBy(suppliers.name);

  return (
    <AppShell>
      <div className="min-h-full w-full px-0 py-4" style={{ background: "#0f0f14" }}>
        <div className="text-sm" style={{ color: "#8888aa" }}>
          <Link href="/suppliers" className="hover:underline">
            Suppliers
          </Link>
          <span className="mx-1.5">/</span>
          Pricelist normalizer
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
          Pricelist normalizer
        </h1>
        <p className="mt-1 max-w-2xl text-sm" style={{ color: "#8888aa" }}>
          Upload any supplier pricelist (PDF, image, or pasted text). AI extracts
          products into the Pawps CSV schema, ready for catalog upload.
        </p>

        <div className="mt-6">
          <NormalizePricelistClient
            suppliers={supplierRows}
            aiConfigured={isAnthropicApiConfigured()}
          />
        </div>
      </div>
    </AppShell>
  );
}
