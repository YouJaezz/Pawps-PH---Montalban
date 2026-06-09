"use client";

import { useActionState } from "react";

import {
  markPayoutPaid,
  recordMonthlyPayout,
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
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-300">
        {props.state.message}
      </div>
    );
  }
  return null;
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
}) {
  const [profileState, profileAction, profilePending] = useActionState<
    InvestorActionResult | null,
    FormData
  >(upsertInvestorProfile, null);

  const [agreementState, agreementAction, agreementPending] = useActionState<
    InvestorActionResult | null,
    FormData
  >(upsertInvestorAgreement, null);

  const inv = props.investor;
  const agr = props.agreement;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#e8a44a]/20 bg-[#e8a44a]/5 p-4 lg:col-span-2">
          <div className="text-xs font-medium uppercase tracking-wide text-[#e8a44a]">
            Current month (projected)
          </div>
          {props.currentMetrics ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <div className="text-[10px] text-zinc-500">Gross revenue</div>
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
                <div className="text-sm font-semibold text-emerald-300">
                  {formatPhpFromCents(props.currentMetrics.netIncomeCents)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500">
                  Investor share ({agr?.sharePercent ?? "—"}%)
                </div>
                <div className="text-lg font-bold text-[#e8a44a]">
                  {formatPhpFromCents(props.currentShareCents)}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              Add an agreement to calculate monthly shares.
            </p>
          )}
          <p className="mt-2 text-[10px] text-zinc-600">
            Net income = paid sales revenue minus cost of goods sold (same month).
            {props.currentMetrics
              ? ` Based on ${props.currentMetrics.orderCount} paid order(s).`
              : ""}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-medium text-zinc-300">Summary</div>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Capital invested</dt>
              <dd className="font-medium">
                {agr ? formatPhpFromCents(agr.capitalCents) : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Profit share</dt>
              <dd className="font-medium">
                {agr ? `${agr.sharePercent}% of net income` : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500">Paid out (YTD)</dt>
              <dd className="font-medium text-emerald-300">
                {formatPhpFromCents(props.paidYtdCents)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium text-zinc-100">Investor profile</div>
          <form action={profileAction} className="mt-3 space-y-2">
            <ResultBanner state={profileState} />
            <input type="hidden" name="investorId" value={inv?.id ?? ""} />
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
            <label className="block space-y-0.5">
              <span className="text-[11px] text-zinc-400">Notes</span>
              <textarea
                name="notes"
                rows={2}
                defaultValue={inv?.notes ?? ""}
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

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium text-zinc-100">
            Investment agreement
          </div>
          <form action={agreementAction} className="mt-3 space-y-2">
            <ResultBanner state={agreementState} />
            <input type="hidden" name="investorId" value={inv?.id ?? ""} />
            <input type="hidden" name="agreementId" value={agr?.id ?? ""} />
            <label className="block space-y-0.5">
              <span className="text-[11px] text-zinc-400">
                Agreement holder (authorized signatory) *
              </span>
              <input
                name="agreementHolder"
                required
                defaultValue={agr?.agreementHolder ?? ""}
                placeholder="Business owner / partner name on contract"
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
                  defaultValue={fmtDate(agr?.agreementDate)}
                  className={fieldClass}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[11px] text-zinc-400">Effective from</span>
                <input
                  name="effectiveFrom"
                  type="date"
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
                defaultValue={
                  agr?.termsNotes ??
                  "10% of monthly net income from paid sales, after COGS."
                }
                className={fieldClass}
              />
            </label>
            <button
              type="submit"
              disabled={agreementPending || !inv}
              className="rounded-lg bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {agreementPending ? "Saving…" : "Save agreement"}
            </button>
            {!inv ? (
              <p className="text-[10px] text-zinc-500">
                Save the investor profile first, then record the agreement.
              </p>
            ) : null}
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-medium text-zinc-100">
          Monthly profit share schedule
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">
          Accrue each closed month to lock figures, then mark as paid when disbursed.
        </p>
        <ScrollableTable maxHeight="max-h-[min(50vh,420px)]" className="mt-3">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
              <tr>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Revenue</th>
                <th className="px-3 py-2">COGS</th>
                <th className="px-3 py-2">Net income</th>
                <th className="px-3 py-2">Share</th>
                <th className="px-3 py-2">Payout</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {props.monthlyRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-zinc-500">
                    No agreement yet — add investor details above.
                  </td>
                </tr>
              ) : (
                props.monthlyRows.map((row) => (
                  <tr key={`${row.year}-${row.month}`} className="hover:bg-white/5">
                    <td className="px-3 py-2 font-medium text-zinc-200">{row.label}</td>
                    <td className="px-3 py-2 text-zinc-400">
                      {formatPhpFromCents(row.grossRevenueCents)}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {formatPhpFromCents(row.cogsCents)}
                    </td>
                    <td className="px-3 py-2 text-emerald-300/90">
                      {formatPhpFromCents(row.netIncomeCents)}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{row.sharePercent}%</td>
                    <td className="px-3 py-2 font-medium text-[#e8a44a]">
                      {formatPhpFromCents(row.payoutCents)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          row.payoutStatus === "Paid"
                            ? "text-emerald-400"
                            : row.payoutStatus === "Projected"
                              ? "text-zinc-400"
                              : "text-amber-300"
                        }
                      >
                        {row.payoutStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {row.payoutStatus === "Projected" ? (
                        <span className="text-[10px] text-zinc-600">In progress</span>
                      ) : row.payoutStatus === "Paid" ? (
                        <span className="text-[10px] text-zinc-600">Done</span>
                      ) : inv && agr ? (
                        <div className="flex flex-col gap-1">
                          <form action={recordMonthlyPayout}>
                            <input type="hidden" name="investorId" value={inv.id} />
                            <input type="hidden" name="agreementId" value={agr.id} />
                            <input type="hidden" name="year" value={row.year} />
                            <input type="hidden" name="month" value={row.month} />
                            <button
                              type="submit"
                              className="text-[10px] text-zinc-300 underline hover:text-zinc-100"
                            >
                              Accrue
                            </button>
                          </form>
                          {row.payoutId ? (
                            <form action={markPayoutPaid}>
                              <input type="hidden" name="payoutId" value={row.payoutId} />
                              <button
                                type="submit"
                                className="text-[10px] text-emerald-300 underline hover:text-emerald-200"
                              >
                                Mark paid
                              </button>
                            </form>
                          ) : (
                            <form action={recordMonthlyPayout}>
                              <input type="hidden" name="investorId" value={inv.id} />
                              <input type="hidden" name="agreementId" value={agr.id} />
                              <input type="hidden" name="year" value={row.year} />
                              <input type="hidden" name="month" value={row.month} />
                              <input type="hidden" name="markPaid" value="on" />
                              <button
                                type="submit"
                                className="text-[10px] text-emerald-300 underline hover:text-emerald-200"
                              >
                                Accrue &amp; pay
                              </button>
                            </form>
                          )}
                        </div>
                      ) : null}
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
