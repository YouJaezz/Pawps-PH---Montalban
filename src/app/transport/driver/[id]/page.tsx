import Link from "next/link";
import { notFound } from "next/navigation";

import { CopyTrackingLink } from "@/app/transport/CopyTrackingLink";
import { DriverTracker } from "@/app/transport/driver/DriverTracker";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import { transportJobs } from "@/db/schema";
import { getTrackingUrl } from "@/lib/site-url";
import { eq } from "drizzle-orm";

export default async function DriverPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id: idRaw } = await props.params;
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id)) notFound();

  const [job] = await db
    .select({
      id: transportJobs.id,
      customerName: transportJobs.customerName,
      pickupLocation: transportJobs.pickupLocation,
      dropoffLocation: transportJobs.dropoffLocation,
      status: transportJobs.status,
      trackingToken: transportJobs.trackingToken,
    })
    .from(transportJobs)
    .where(eq(transportJobs.id, id))
    .limit(1);

  if (!job || !job.trackingToken) notFound();

  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-0 py-4">
        <Link href="/transport" className="text-xs text-zinc-400 hover:text-zinc-200">
          ← Back to transport
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Driver mode · #{job.id}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {job.customerName}: {job.pickupLocation} → {job.dropoffLocation}
        </p>
        <p className="text-xs text-zinc-500">Status: {job.status}</p>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-zinc-400">
          <div className="font-medium text-zinc-200">Before you drive</div>
          <p className="mt-1">
            Customer tracking only works while this page is open and location sharing
            is started below.
          </p>
        </div>

        <div className="mt-4">
          <DriverTracker jobId={job.id} trackingToken={job.trackingToken} />
        </div>

        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-zinc-400">
          <div className="font-medium text-amber-100">Customer tracking link</div>
          <p className="mt-1">
            Send this URL to your customer — it works without login on any phone.
          </p>
          <p className="mt-2 break-all font-mono text-[11px] text-zinc-200">
            {getTrackingUrl(job.trackingToken)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyTrackingLink token={job.trackingToken} />
            <Link
              href={getTrackingUrl(job.trackingToken)}
              className="rounded border border-white/10 px-2 py-0.5 text-zinc-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              Preview
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
