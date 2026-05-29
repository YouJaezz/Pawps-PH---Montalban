import { AppShell } from "@/components/AppShell";

export default function PosPage() {
  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="text-sm text-zinc-400">Future POS</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">POS Mode</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Placeholder for future walk-in store features: barcode scanning,
          receipt printing, cash drawer, and shift management.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-medium text-zinc-100">
            POS Mode is not enabled yet.
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            When you’re ready, we’ll add a dedicated full-screen POS UI and a
            faster local-first flow for scanning + cash.
          </div>
        </div>
      </div>
    </AppShell>
  );
}

