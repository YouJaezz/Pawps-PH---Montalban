import { AppShell } from "@/components/AppShell";
import { TransportJobForm } from "@/app/transport/TransportJobForm";
import { TransportJobsTable } from "@/app/transport/TransportJobsTable";
import { TransportPricingPanel } from "@/app/transport/TransportPricingPanel";
import { db } from "@/db";
import { getTransportPricing } from "@/db/queries/transport";
import { transportJobs } from "@/db/schema";
import { desc } from "drizzle-orm";

export default async function TransportPage() {
  const pricing = await getTransportPricing();

  const rows = await db
    .select({
      id: transportJobs.id,
      customerName: transportJobs.customerName,
      contact: transportJobs.contact,
      pickupLocation: transportJobs.pickupLocation,
      dropoffLocation: transportJobs.dropoffLocation,
      serviceType: transportJobs.serviceType,
      status: transportJobs.status,
      fee: transportJobs.fee,
      distanceKmTenths: transportJobs.distanceKmTenths,
      trackingToken: transportJobs.trackingToken,
      receiptNumber: transportJobs.receiptNumber,
    })
    .from(transportJobs)
    .orderBy(desc(transportJobs.createdAt))
    .limit(50);

  const activeCount = rows.filter(
    (r) => r.status === "In Transit" || r.status === "Scheduled",
  ).length;

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-400">Pet Transportation</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Transport jobs
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          You are the driver — km-based pricing, extras, receipts, and live
          tracking links for customers. {activeCount} active.
        </p>

        <div className="mt-4">
          <TransportPricingPanel
            baseFeeCents={pricing.baseFeeCents}
            perKmCents={pricing.perKmCents}
            minimumFeeCents={pricing.minimumFeeCents}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-medium text-zinc-100">
                New transport job
              </div>
              <div className="mt-5">
                <TransportJobForm
                  baseFeeCents={pricing.baseFeeCents}
                  perKmCents={pricing.perKmCents}
                  minimumFeeCents={pricing.minimumFeeCents}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-medium text-zinc-100">
                Recent jobs ({rows.length})
              </div>
              <div className="mt-4">
                <TransportJobsTable rows={rows} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
