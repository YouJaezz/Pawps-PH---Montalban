"use client";

import { useActionState } from "react";
import Link from "next/link";

import {
  deleteInvestor,
  markPayoutPaid,
  recordMonthlyPayout,
  resetMonthlyPayout,
  upsertInvestorAgreement,
  upsertInvestorProfile,
  type InvestorActionResult,
} from "@/app/investors/actions";
import { ScrollableTable } from "@/components/ScrollableTable";
import type { InvestorMonthlyRow } from "@/db/queries/investors";
import { formatPhpFromCents } from "@/lib/money";

const fieldClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none focus:border-white/20";

function fmtDate(d: Date | null | undefined) {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function ResultBanner(props: { state: InvestorActionResult | null }) {
  if (!props.state) return null;
  if (props.state.error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">
        {props.state.error}
      </div>
    );
  }
  if (props.state.ok && props.state.message) {
    return (
      <div className="rounded-lg border border-brand-cyan/30 bg-brand-blue/10 px-2.5 py-2 text-[11px] text-brand-cyan/80">
        {props.state.message}
      </div>
    );
  }
  return null;
}

function SetupSteps(props: { step: number }) {
  const steps = [
    { n: 1, label: "Investor profile" },
    { n: 2, label: "Agreement (₱50k · 10%)" },
    { n: 3, label: "Live share tracking" },
  ];
  return (
    <ol className="flex flex-wrap gap-2 text-[11px]">
      {steps.map((s) => (
        <li
          key={s.n}
          className={`rounded-full border px-3 py-1 ${
            props.step >= s.n
              ? "border-brand-blue/40 bg-brand-blue/10 text-brand-blue"
              : "border-white/10 text-zinc-500"
          }`}
        >
          {s.n}. {s.label}
          {props.step > s.n ? " ✓" : ""}
        </li>
      ))}
    </ol>
  );
}

export function InvestorDashboard(props: {
  investor: {
    id: number;
    fullName: string;
    contact: string | null;
    email: string | null;
    address: string | null;
    idReference: string | null;
    notes: string | null;
  } | null;
  agreement: {
    id: number;
    investorId: number;
    agreementHolder: string;
    capitalCents: number;
    sharePercent: number;
    agreementDate: Date | null;
    effectiveFrom: Date | null;
    termsNotes: string | null;
  } | undefined;
  monthlyRows: InvestorMonthlyRow[];
  currentMetrics: {
    grossRevenueCents: number;
    cogsCents: number;
    netIncomeCents: number;
    orderCount: number;
  } | null;
  currentShareCents: number;
  paidYtdCents: number;
  accruedUnpaidCents: number;
  setupStep: number;
  highlightAgreement?: boolean;
  currentMonthLabel: string;
  salesPreview: {
    monthLabel: string;
    grossRevenueCents: number;
    orderCount: number;
  };
  sanityOrderCount: number;
  sanityGrossCents: number;
}) {
  const [profileState, profileAction, profilePending] = useActionState<
    InvestorActionResult | null,
    FormData
  >(upsertInvestorProfile, null);

  const [agreementState, agreementAction, agreementPending] = useActionState<
    InvestorActionResult | null,
    FormData
  >(upsertInvestorAgreement, null);

  const [payoutState, payoutAction, payoutPending] = useActionState<
    InvestorActionResult | null,
    FormData
  >(recordMonthlyPayout, null);

  const [paidState, paidAction, paidPending] = useActionState<
    InvestorActionResult | null,
    FormData
  >(markPayoutPaid, null);

  const [undoState, undoAction, undoPending] = useActionState<
    InvestorActionResult | null,
    FormData
  >(resetMonthlyPayout, null);

  const [deleteState, deleteAction, deletePending] = useActionState<
    InvestorActionResult | null,
    FormData
  >(deleteInvestor, null);

  const actionFeedback =
    payoutState ??
    paidState ??
    undoState ??
    deleteState ??
    profileState ??
    agreementState;

  const inv = props.investor;
  const agr = props.agreement;
  const setupComplete = props.setupStep >= 3;
  const salesConnected = props.sanityGrossCents > 0;
  const metricsMismatch =
    salesConnected &&
    props.currentMetrics &&
    props.currentMetrics.grossRevenueCents !== props.sanityGrossCents;

  const investorId = inv?.id ?? 0;

  return (
    <div className="space-y-6">
      {inv ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-red-300">
            Testing tools
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            Delete removes this investor, agreement, and all payout records so you can
            start fresh. Reset month unlocks a locked period (including Paid).
          </p>
          <form
            action={deleteAction}
            className="mt-3"
            onSubmit={(e) => {
              if (
                !window.confirm(
                  `Delete "${inv.fullName}" and all payout history? This cannot be undone.`,
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="investorId" value={inv.id} />
            <button
              type="submit"
              disabled={deletePending}
              className="rounded-lg border border-red-500/50 bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/25 disabled:opacity-50"
            >
              {deletePending ? "Deleting…" : "Delete investor"}
            </button>
          </form>
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs font-medium text-zinc-300">Setup checklist</div>
        <div className="mt-2">
          <SetupSteps step={props.setupStep} />
        </div>
        {props.setupStep === 1 ? (
          <p className="mt-2 text-[11px] text-zinc-500">
            Step 1: Enter the investor&apos;s name and contact, then click{" "}
            <strong className="text-zinc-300">Save profile</strong>.
          </p>
        ) : props.setupStep === 2 ? (
          <p className="mt-2 text-[11px] text-amber-200/80">
            Step 2: Save the agreement (₱50,000 capital · 10% of monthly net income).
            {props.highlightAgreement ? " You're on this step now." : ""}
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-brand-cyan/80/80">
            Setup complete — her share updates automatically from Sales &amp; Orders.
          </p>
        )}
      </div>

      {actionFeedback ? (
        <div className="sticky top-0 z-10">
          <ResultBanner state={actionFeedback} />
        </div>
      ) : null}

      {salesConnected ? (
        <div className="rounded-xl border border-brand-cyan/30 bg-brand-blue/10 p-4">
          <div className="text-xs font-medium text-brand-cyan/80">
            Sales connected · {props.currentMonthLabel}
          </div>
          <div className="mt-1 text-lg font-semibold text-zinc-50">
            {formatPhpFromCents(props.sanityGrossCents)} collected
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            From {props.sanityOrderCount} order(s) in Sales &amp; Orders this month
            (Philippines calendar). Investor share below uses the same data minus
            COGS.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-[11px] text-amber-200/90">
          No cash collected in {props.currentMonthLabel} yet. Orders on the Sales
          &amp; Orders page with payment recorded will appear here automatically.
        </div>
      )}

      {metricsMismatch ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">
          Sync note: refreshing should align totals. If a month was locked at ₱0
          before sales came in, use <strong>Reset month</strong> on that row.
        </div>
      ) : null}

      {setupComplete && inv && agr ? (
        <div className="rounded-xl border border-brand-blue/30 bg-gradient-to-br from-brand-blue/10 to-transparent p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-brand-blue">
                {inv.fullName} · {agr.sharePercent}% profit share
              </div>
              <div className="mt-1 text-2xl font-bold text-zinc-50">
                {formatPhpFromCents(props.currentShareCents)}
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                Her share this month (projected) · capital{" "}
                {formatPhpFromCents(agr.capitalCents)}
              </div>
            </div>
            <div className="text-right text-xs text-zinc-400">
              <div>
                Paid out YTD:{" "}
                <span className="font-medium text-brand-cyan/80">
                  {formatPhpFromCents(props.paidYtdCents)}
                </span>
              </div>
              <div className="mt-1">
                Accrued (not yet paid):{" "}
                <span className="font-medium text-amber-300">
                  {formatPhpFromCents(props.accruedUnpaidCents)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-4 lg:col-span-2">
          <div className="text-xs font-medium uppercase tracking-wide text-brand-blue">
            {props.currentMonthLabel} — live from sales
          </div>
          {props.currentMetrics && agr ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <div className="text-[10px] text-zinc-500">Cash collected</div>
                  <div className="text-sm font-semibold">
                    {formatPhpFromCents(props.currentMetrics.grossRevenueCents)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">COGS</div>
                  <div className="text-sm font-semibold text-red-300/90">
                    {formatPhpFromCents(props.currentMetrics.cogsCents)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">Net income</div>
                  <div className="text-sm font-semibold text-brand-cyan/80">
                    {formatPhpFromCents(props.currentMetrics.netIncomeCents)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">
                    Her {agr.sharePercent}% share
                  </div>
                  <div className="text-lg font-bold text-brand-blue">
                    {formatPhpFromCents(props.currentShareCents)}
                  </div>
                </div>
              </div>
              {(props.currentMetrics.orderCount === 0 &&
                props.sanityOrderCount === 0) ? (
                <p className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-zinc-400">
                  No cash collected in {props.currentMonthLabel} yet — numbers
                  appear when Quick Sell or Bulk orders record payment in{" "}
                  <Link href="/orders" className="text-zinc-200 underline">
                    Sales &amp; Orders
                  </Link>
                  .
                </p>
              ) : (
                <p className="mt-2 text-[10px] text-zinc-600">
                  Based on{" "}
                  {Math.max(
                    props.currentMetrics.orderCount,
                    props.sanityOrderCount,
                  )}{" "}
                  order(s) with payment collected in {props.currentMonthLabel}.
                </p>
              )}
            </>
          ) : salesConnected ? (
            <p className="mt-2 text-sm text-zinc-400">
              {formatPhpFromCents(props.sanityGrossCents)} detected from orders —
              saving the agreement below will show net income and exact share.
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              Save the investor profile and agreement below to calculate profit
              share.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-medium text-zinc-300">How it works</div>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[11px] text-zinc-400">
            <li>Sales in Orders add cash collected + COGS automatically.</li>
            <li>
              Net income = cash collected − COGS (each month).
            </li>
            <li>
              Her share = net income × {agr?.sharePercent ?? 10}%.
            </li>
            <li>
              After month ends: <strong className="text-zinc-300">Lock month</strong>{" "}
              → then <strong className="text-zinc-300">Mark paid</strong> when you send
              money.
            </li>
          </ol>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium text-zinc-100">
            1 · Investor profile
          </div>
          <form action={profileAction} className="mt-3 space-y-2">
            <input type="hidden" name="investorId" value={investorId || ""} />
            <label className="block space-y-0.5">
              <span className="text-[11px] text-zinc-400">Full name *</span>
              <input
                name="fullName"
                required
                defaultValue={inv?.fullName ?? ""}
                className={fieldClass}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-0.5">
                <span className="text-[11px] text-zinc-400">Contact</span>
                <input
                  name="contact"
                  defaultValue={inv?.contact ?? ""}
                  className={fieldClass}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[11px] text-zinc-400">Email</span>
                <input
                  name="email"
                  type="email"
                  defaultValue={inv?.email ?? ""}
                  className={fieldClass}
                />
              </label>
            </div>
            <label className="block space-y-0.5">
              <span className="text-[11px] text-zinc-400">Address</span>
              <input
                name="address"
                defaultValue={inv?.address ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="block space-y-0.5">
              <span className="text-[11px] text-zinc-400">ID / reference no.</span>
              <input
                name="idReference"
                defaultValue={inv?.idReference ?? ""}
                className={fieldClass}
              />
            </label>
            <button
              type="submit"
              disabled={profilePending}
              className="rounded-lg bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {profilePending ? "Saving…" : "Save profile"}
            </button>
          </form>
        </div>

        <div
          className={`rounded-xl border bg-white/5 p-4 ${
            props.highlightAgreement
              ? "border-brand-blue/40 ring-1 ring-brand-blue/20"
              : "border-white/10"
          }`}
        >
          <div className="text-sm font-medium text-zinc-100">
            2 · Investment agreement
          </div>
          <form action={agreementAction} className="mt-3 space-y-2">
            <input type="hidden" name="investorId" value={investorId || ""} />
            <input type="hidden" name="agreementId" value={agr?.id ?? ""} />
            {!investorId ? (
              <p className="text-[11px] text-amber-300">
                Save the profile first — then this form will unlock.
              </p>
            ) : null}
            <label className="block space-y-0.5">
              <span className="text-[11px] text-zinc-400">
                Agreement holder (your business signatory) *
              </span>
              <input
                name="agreementHolder"
                required
                disabled={!investorId}
                defaultValue={agr?.agreementHolder ?? "The PAWps PH — Montalban"}
                className={fieldClass}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-0.5">
                <span className="text-[11px] text-zinc-400">Capital (₱) *</span>
                <input
                  name="capitalAmount"
                  inputMode="decimal"
                  required
                  disabled={!investorId}
                  defaultValue={
                    agr ? (agr.capitalCents / 100).toFixed(0) : "50000"
                  }
                  className={fieldClass}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[11px] text-zinc-400">Share of net income (%) *</span>
                <input
                  name="sharePercent"
                  inputMode="decimal"
                  required
                  disabled={!investorId}
                  defaultValue={agr?.sharePercent ?? 10}
                  className={fieldClass}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-0.5">
                <span className="text-[11px] text-zinc-400">Agreement date</span>
                <input
                  name="agreementDate"
                  type="date"
                  disabled={!investorId}
                  defaultValue={fmtDate(agr?.agreementDate)}
                  className={fieldClass}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[11px] text-zinc-400">Effective from</span>
                <input
                  name="effectiveFrom"
                  type="date"
                  disabled={!investorId}
                  defaultValue={fmtDate(agr?.effectiveFrom)}
                  className={fieldClass}
                />
              </label>
            </div>
            <label className="block space-y-0.5">
              <span className="text-[11px] text-zinc-400">Terms / notes</span>
              <textarea
                name="termsNotes"
                rows={2}
                disabled={!investorId}
                defaultValue={
                  agr?.termsNotes ??
                  "10% of monthly net income from paid sales, after COGS."
                }
                className={fieldClass}
              />
            </label>
            <button
              type="submit"
              disabled={agreementPending || !investorId}
              className="rounded-lg bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {agreementPending ? "Saving…" : "Save agreement & see share"}
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-medium text-zinc-100">
          3 · Monthly profit share
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">
          <strong className="text-zinc-400">Open</strong> = calculated, not locked ·{" "}
          <strong className="text-zinc-400">Projected</strong> = this month (still
          selling) · <strong className="text-zinc-400">Accrued</strong> = locked ·{" "}
          <strong className="text-zinc-400">Paid</strong> = money sent
        </p>
        <ScrollableTable maxHeight="max-h-[min(50vh,420px)]" className="mt-3">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
              <tr>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Collected</th>
                <th className="px-3 py-2">COGS</th>
                <th className="px-3 py-2">Net income</th>
                <th className="px-3 py-2">Her share</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {!agr || props.monthlyRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-zinc-500">
                    Save the agreement above to see monthly shares.
                  </td>
                </tr>
              ) : (
                props.monthlyRows.map((row) => (
                  <tr key={`${row.year}-${row.month}`} className="hover:bg-white/5">
                    <td className="px-3 py-2 font-medium text-zinc-200">
                      {row.label}
                      {row.liveDiffers ? (
                        <span className="ml-1 text-[9px] font-normal text-amber-400">
                          · live sales differ
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {formatPhpFromCents(row.grossRevenueCents)}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {formatPhpFromCents(row.cogsCents)}
                    </td>
                    <td className="px-3 py-2 text-brand-cyan/80/90">
                      {formatPhpFromCents(row.netIncomeCents)}
                    </td>
                    <td className="px-3 py-2 font-medium text-brand-blue">
                      {formatPhpFromCents(row.payoutCents)}{" "}
                      <span className="text-[10px] font-normal text-zinc-500">
                        ({row.sharePercent}%)
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.payoutStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <PayoutActions
                        row={row}
                        investorId={investorId}
                        agreementId={agr.id}
                        payoutAction={payoutAction}
                        paidAction={paidAction}
                        resetAction={undoAction}
                        pending={payoutPending || paidPending || undoPending}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </div>
    </div>
  );
}

function StatusBadge(props: { status: InvestorMonthlyRow["payoutStatus"] }) {
  const styles = {
    Open: "text-zinc-400",
    Projected: "text-sky-300",
    Accrued: "text-amber-300",
    Paid: "text-brand-cyan",
  };
  const labels = {
    Open: "Open",
    Projected: "In progress",
    Accrued: "Locked",
    Paid: "Paid",
  };
  return (
    <span className={styles[props.status]}>{labels[props.status]}</span>
  );
}

function PayoutActions(props: {
  row: InvestorMonthlyRow;
  investorId: number;
  agreementId: number;
  payoutAction: (payload: FormData) => void;
  paidAction: (payload: FormData) => void;
  resetAction: (payload: FormData) => void;
  pending: boolean;
}) {
  const { row } = props;

  const resetForm = row.payoutId ? (
    <form
      action={props.resetAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Reset ${row.label}? This removes the lock and shows live sales again.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="payoutId" value={row.payoutId} />
      <button
        type="submit"
        disabled={props.pending}
        className="text-[10px] text-red-300 underline hover:text-red-200 disabled:opacity-50"
      >
        Reset month
      </button>
    </form>
  ) : null;

  if (row.payoutStatus === "Projected") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-600">Month in progress</span>
        {resetForm}
      </div>
    );
  }

  if (row.payoutStatus === "Paid") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-brand-cyan">Complete</span>
        {resetForm}
      </div>
    );
  }

  if (row.payoutStatus === "Accrued" && row.payoutId) {
    return (
      <div className="flex flex-col gap-1">
        <form action={props.paidAction}>
          <input type="hidden" name="payoutId" value={row.payoutId} />
          <button
            type="submit"
            disabled={props.pending}
            className="text-[10px] text-brand-cyan/80 underline hover:text-brand-cyan/70 disabled:opacity-50"
          >
            Mark paid
          </button>
        </form>
        <form action={props.resetAction}>
          <input type="hidden" name="payoutId" value={row.payoutId} />
          <button
            type="submit"
            disabled={props.pending}
            className="text-[10px] text-red-300/80 underline hover:text-red-200 disabled:opacity-50"
          >
            Reset month
          </button>
        </form>
      </div>
    );
  }

  if (row.canAccrue && props.investorId) {
    return (
      <div className="flex flex-col gap-1">
        <form action={props.payoutAction}>
          <input type="hidden" name="investorId" value={props.investorId} />
          <input type="hidden" name="agreementId" value={props.agreementId} />
          <input type="hidden" name="year" value={row.year} />
          <input type="hidden" name="month" value={row.month} />
          <button
            type="submit"
            disabled={props.pending}
            className="text-[10px] text-zinc-300 underline hover:text-zinc-100 disabled:opacity-50"
          >
            Lock month
          </button>
        </form>
        <form action={props.payoutAction}>
          <input type="hidden" name="investorId" value={props.investorId} />
          <input type="hidden" name="agreementId" value={props.agreementId} />
          <input type="hidden" name="year" value={row.year} />
          <input type="hidden" name="month" value={row.month} />
          <input type="hidden" name="markPaid" value="on" />
          <button
            type="submit"
            disabled={props.pending}
            className="text-[10px] text-brand-cyan/80 underline hover:text-brand-cyan/70 disabled:opacity-50"
          >
            Lock &amp; mark paid
          </button>
        </form>
      </div>
    );
  }

  return <span className="text-[10px] text-zinc-600">—</span>;
}
