import Link from "next/link";
import { notFound } from "next/navigation";

import { DriverTracker } from "@/app/transport/driver/DriverTracker";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import { transportJobs } from "@/db/schema";
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

        <div className="mt-4">
          <DriverTracker jobId={job.id} trackingToken={job.trackingToken} />
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-zinc-400">
          Share this link with your customer:{" "}
          <Link
            href={`/track/${job.trackingToken}`}
            className="text-amber-200 underline"
            target="_blank"
          >
            Open tracking page
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
