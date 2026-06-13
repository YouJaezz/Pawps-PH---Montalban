import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintReceiptButton } from "@/components/PrintReceiptButton";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import { transportExtras, transportJobs } from "@/db/schema";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { formatPhpFromCents } from "@/lib/money";
import { tenthsToKm } from "@/lib/transport-pricing";
import { eq } from "drizzle-orm";

export default async function TransportReceiptPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id: idRaw } = await props.params;
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id)) notFound();

  const [job] = await db.select().from(transportJobs).where(eq(transportJobs.id, id)).limit(1);
  if (!job) notFound();

  const extras = await db
    .select()
    .from(transportExtras)
    .where(eq(transportExtras.transportJobId, id));

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-0 py-4 print:py-0">
        <div className="mb-4 flex gap-2 print:hidden">
          <Link href="/transport" className="text-xs text-zinc-600">
            ← Back
          </Link>
          <PrintReceiptButton />
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 print:border-0 print:shadow-none">
          <div className="text-center">
            <div className="text-lg font-bold">{BRAND_NAME}</div>
            <div className="text-xs text-zinc-600">{BRAND_TAGLINE}</div>
            <div className="mt-2 text-sm font-medium">Transport Receipt</div>
            <div className="text-xs text-zinc-600">{job.receiptNumber ?? `#${job.id}`}</div>
          </div>

          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-600">Customer</dt>
              <dd className="font-medium">{job.customerName}</dd>
            </div>
            {job.contact ? (
              <div className="flex justify-between">
                <dt className="text-zinc-600">Contact</dt>
                <dd>{job.contact}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Route</dt>
              <dd className="text-right text-xs">
                {job.pickupLocation} → {job.dropoffLocation}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-600">Service</dt>
              <dd>{job.serviceType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-600">Distance</dt>
              <dd>{tenthsToKm(job.distanceKmTenths)} km</dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-zinc-200 pt-4 text-sm">
            <div className="flex justify-between">
              <span>Base fee</span>
              <span>{formatPhpFromCents(job.baseFeeCents)}</span>
            </div>
            <div className="flex justify-between">
              <span>Distance fee</span>
              <span>{formatPhpFromCents(job.distanceFeeCents)}</span>
            </div>
            {job.trafficFeeCents > 0 ? (
              <div className="flex justify-between">
                <span>Traffic fee</span>
                <span>{formatPhpFromCents(job.trafficFeeCents)}</span>
              </div>
            ) : null}
            {job.stopLightFeeCents > 0 ? (
              <div className="flex justify-between">
                <span>Stop lights fee</span>
                <span>{formatPhpFromCents(job.stopLightFeeCents)}</span>
              </div>
            ) : null}
            {extras.map((e) => (
              <div key={e.id} className="flex justify-between text-zinc-700">
                <span>{e.label}</span>
                <span>{formatPhpFromCents(e.amountCents)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-zinc-300 pt-2 text-base font-bold">
              <span>Total</span>
              <span>{formatPhpFromCents(job.fee)}</span>
            </div>
          </div>

          <div className="mt-6 text-center text-[10px] text-zinc-600">
            {new Date(job.createdAt).toLocaleString("en-PH")} · Status: {job.status}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
