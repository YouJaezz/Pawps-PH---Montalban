"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { updateOwnerProfitSplitSettings } from "@/app/payroll/actions";
import type { OwnerProfitSplitDashboard } from "@/db/queries/owner-profit-split";
import {
  allocateAmountBySplit,
  validateOwnerProfitSplit,
  type OwnerProfitSplitSettings,
} from "@/lib/owner-profit-split";
import {
  buildUnpaidPayrollSplitBreakdown,
  VOLUNTEER_WEEKDAYS,
  volunteerWeekdayLabel,
  type UnpaidPayrollItem,
  type UnpaidPayrollSplitBreakdown,
} from "@/lib/owner-volunteer-payroll";
import { formatPhpFromCents } from "@/lib/money";
import { formatDuration } from "@/lib/time-duration";

const SPLIT_PRESETS: Array<{
  label: string;
  hint: string;
  owner1Percent: number;
  owner2Percent: number;
  payrollPoolPercent: number;
}> = [
  {
    label: "40 / 40 / 20",
    hint: "Default — equal owners, 20% staff",
    owner1Percent: 40,
    owner2Percent: 40,
    payrollPoolPercent: 20,
  },
  {
    label: "50 / 50 / 0",
    hint: "Owners only — no staff pool",
    owner1Percent: 50,
    owner2Percent: 50,
    payrollPoolPercent: 0,
  },
  {
    label: "30 / 30 / 40",
    hint: "More to staff / shop payroll",
    owner1Percent: 30,
    owner2Percent: 30,
    payrollPoolPercent: 40,
  },
  {
    label: "0 / 50 / 50",
    hint: "One owner steps back",
    owner1Percent: 0,
    owner2Percent: 50,
    payrollPoolPercent: 50,
  },
  {
    label: "0 / 0 / 100",
    hint: "Shop pays all shared days (shop cash)",
    owner1Percent: 0,
    owner2Percent: 0,
    payrollPoolPercent: 100,
  },
];

function SplitBar(props: {
  owner1Percent: number;
  owner2Percent: number;
  payrollPoolPercent: number;
  owner1Name: string;
  owner2Name: string;
}) {
  const { owner1Percent, owner2Percent, payrollPoolPercent } = props;
  if (owner1Percent + owner2Percent + payrollPoolPercent !== 100) {
    return (
      <div className="mt-2 h-2 rounded-full bg-amber-500/20 ring-1 ring-amber-500/40" />
    );
  }

  return (
    <div className="mt-2 flex h-2 overflow-hidden rounded-full">
      {owner1Percent > 0 ? (
        <div
          className="bg-violet-500/80"
          style={{ width: `${owner1Percent}%` }}
          title={`${props.owner1Name} ${owner1Percent}%`}
        />
      ) : null}
      {owner2Percent > 0 ? (
        <div
          className="bg-violet-400/70"
          style={{ width: `${owner2Percent}%` }}
          title={`${props.owner2Name} ${owner2Percent}%`}
        />
      ) : null}
      {payrollPoolPercent > 0 ? (
        <div
          className="bg-emerald-500/80"
          style={{ width: `${payrollPoolPercent}%` }}
          title={`Shop cash ${payrollPoolPercent}%`}
        />
      ) : null}
    </div>
  );
}

function WalletObligationsCard(props: {
  owner1Name: string;
  owner2Name: string;
  obligations: {
    owner1TotalCents: number;
    owner2TotalCents: number;
    shopPoolTotalCents: number;
    grossUnpaidCents: number;
    unpaidCount: number;
  };
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs font-semibold text-zinc-200">
        Pending payroll — who pays what
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">
        Owner shares come from your personal wallets. Shop pool comes from shop
        cash when you pay.
      </p>
      {props.obligations.unpaidCount === 0 ? (
        <p className="mt-3 text-[11px] text-zinc-600">No unpaid staff payroll.</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
            <div className="text-[10px] text-violet-200/70">
              {props.owner1Name} wallet
            </div>
            <div className="text-sm font-semibold text-violet-100">
              {formatPhpFromCents(props.obligations.owner1TotalCents)}
            </div>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
            <div className="text-[10px] text-violet-200/70">
              {props.owner2Name} wallet
            </div>
            <div className="text-sm font-semibold text-violet-100">
              {formatPhpFromCents(props.obligations.owner2TotalCents)}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
            <div className="text-[10px] text-emerald-200/70">Shop cash (pool)</div>
            <div className="text-sm font-semibold text-emerald-100">
              {formatPhpFromCents(props.obligations.shopPoolTotalCents)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShopCashStatusCard(props: {
  cashInHandCents: number;
  availableShopCashCents: number;
  pendingShopPoolCents: number;
}) {
  const shortfall = props.pendingShopPoolCents > props.availableShopCashCents;

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
      <div className="text-xs font-semibold text-emerald-100">Shop cash</div>
      <p className="mt-1 text-[10px] text-zinc-500">
        Shop pool % is deducted from sales cash on-hand and logged as payroll
        expense when you pay staff — not from owner wallets or investor capital.
      </p>
      <div className="mt-3 space-y-2 text-[11px]">
        <div className="flex justify-between gap-2">
          <span className="text-zinc-400">Sales collected (on hand)</span>
          <span className="text-zinc-200">
            {formatPhpFromCents(props.cashInHandCents)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-zinc-400">Available after expenses &amp; restock</span>
          <span className="font-medium text-emerald-200">
            {formatPhpFromCents(props.availableShopCashCents)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-zinc-400">Shop pool owed (unpaid payroll)</span>
          <span className="font-medium text-zinc-200">
            {formatPhpFromCents(props.pendingShopPoolCents)}
          </span>
        </div>
      </div>
      {shortfall && props.pendingShopPoolCents > 0 ? (
        <p className="mt-2 text-[10px] text-amber-200/90">
          Shop cash may not cover the full pool — top up from sales or owners pay
          extra from wallet until cash catches up.
        </p>
      ) : null}
    </div>
  );
}

function parseVolunteerWeekday(value: string): number | null {
  if (value === "") return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 && n <= 6 ? n : null;
}

function UnpaidPayrollBreakdownCard(props: {
  breakdown: UnpaidPayrollSplitBreakdown;
  owner1Name: string;
  owner2Name: string;
  owner1Percent: number;
  owner2Percent: number;
  payrollPoolPercent: number;
}) {
  const { breakdown: b } = props;

  return (
    <div className="mt-3 rounded-xl border border-brand-cyan/25 bg-brand-cyan/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-zinc-100">{b.employeeName}</div>
          <div className="mt-0.5 text-[10px] text-zinc-500">
            {b.label} · {formatDuration(b.minutesWorked)} ·{" "}
            {b.status === "ready" ? "Ready to pay" : "Locked — awaiting payment"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-zinc-500">Total owed</div>
          <div className="text-lg font-semibold text-brand-cyan/90">
            {formatPhpFromCents(b.grossPayCents)}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
          <div className="text-[10px] text-violet-200/70">
            {props.owner1Name} pays
          </div>
          <div className="text-sm font-semibold text-violet-100">
            {formatPhpFromCents(b.owner1TotalCents)}
          </div>
          {b.owner1VolunteerCents > 0 ? (
            <div className="mt-0.5 text-[10px] text-violet-200/50">
              incl. {formatPhpFromCents(b.owner1VolunteerCents)} volunteer day(s)
            </div>
          ) : null}
        </div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
          <div className="text-[10px] text-violet-200/70">
            {props.owner2Name} pays
          </div>
          <div className="text-sm font-semibold text-violet-100">
            {formatPhpFromCents(b.owner2TotalCents)}
          </div>
          {b.owner2VolunteerCents > 0 ? (
            <div className="mt-0.5 text-[10px] text-violet-200/50">
              incl. {formatPhpFromCents(b.owner2VolunteerCents)} volunteer day(s)
            </div>
          ) : null}
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <div className="text-[10px] text-emerald-200/70">
            Shop cash ({props.payrollPoolPercent}% of shared days)
          </div>
          <div className="text-sm font-semibold text-emerald-100">
            {formatPhpFromCents(b.staffPoolCents)}
          </div>
          {b.sharedCents > 0 ? (
            <div className="mt-0.5 text-[10px] text-emerald-200/50">
              from {formatPhpFromCents(b.sharedCents)} on other days
            </div>
          ) : null}
        </div>
      </div>

      {b.dayLines.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="text-left text-[10px] text-zinc-500">
              <tr>
                <th className="px-2 py-1">Day worked</th>
                <th className="px-2 py-1">Who pays</th>
                <th className="px-2 py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {b.dayLines.map((line) => (
                <tr key={line.dateKey}>
                  <td className="px-2 py-1.5 text-zinc-200">
                    {line.dateKey} ({line.weekdayLabel})
                  </td>
                  <td
                    className={`px-2 py-1.5 ${
                      line.responsibility === "shared"
                        ? "text-zinc-400"
                        : "text-violet-200/90"
                    }`}
                  >
                    {line.responsibilityLabel}
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-zinc-200">
                    {formatPhpFromCents(line.dayPayCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-[10px] text-zinc-600">
          No day-by-day punches found — split uses the period total above.
        </p>
      )}
    </div>
  );
}

function parsePercentInput(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

export function OwnerProfitSplitPanel(props: { dashboard: OwnerProfitSplitDashboard }) {
  const [state, formAction, pending] = useActionState(
    updateOwnerProfitSplitSettings,
    null,
  );

  const saved = props.dashboard.settings;
  const [draft, setDraft] = useState<OwnerProfitSplitSettings>(() => ({ ...saved }));
  const [selectedUnpaidKey, setSelectedUnpaidKey] = useState<string | null>(null);

  useEffect(() => {
    setDraft({ ...saved });
  }, [
    saved.owner1Name,
    saved.owner2Name,
    saved.owner1Percent,
    saved.owner2Percent,
    saved.payrollPoolPercent,
    saved.owner1VolunteerWeekday,
    saved.owner2VolunteerWeekday,
  ]);

  const unpaidPayroll = props.dashboard.unpaidPayroll;

  useEffect(() => {
    if (unpaidPayroll.length === 0) {
      setSelectedUnpaidKey(null);
      return;
    }
    setSelectedUnpaidKey((current) => {
      if (current && unpaidPayroll.some((item) => item.rowKey === current)) {
        return current;
      }
      return unpaidPayroll[0]?.rowKey ?? null;
    });
  }, [unpaidPayroll]);

  const selectedUnpaid = useMemo(
    () => unpaidPayroll.find((item) => item.rowKey === selectedUnpaidKey) ?? null,
    [unpaidPayroll, selectedUnpaidKey],
  );

  const selectedBreakdown = useMemo(
    () =>
      selectedUnpaid
        ? buildUnpaidPayrollSplitBreakdown(selectedUnpaid, draft)
        : null,
    [selectedUnpaid, draft],
  );

  const percentTotal =
    draft.owner1Percent + draft.owner2Percent + draft.payrollPoolPercent;
  const isValidTotal = percentTotal === 100;
  const validationError = useMemo(
    () => (isValidTotal ? null : validateOwnerProfitSplit(draft)),
    [draft, isValidTotal],
  );

  const sharedDayPreviewCents = selectedUnpaid
    ? selectedBreakdown?.sharedCents ?? 0
    : 0;
  const previewAllocation = useMemo(
    () => allocateAmountBySplit(sharedDayPreviewCents, draft),
    [sharedDayPreviewCents, draft],
  );

  function applyPreset(preset: (typeof SPLIT_PRESETS)[number]) {
    setDraft((prev) => ({
      ...prev,
      owner1Percent: preset.owner1Percent,
      owner2Percent: preset.owner2Percent,
      payrollPoolPercent: preset.payrollPoolPercent,
    }));
  }

  function updateDraft<K extends keyof OwnerProfitSplitSettings>(
    key: K,
    value: OwnerProfitSplitSettings[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <section className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5">
      <div>
        <h2 className="text-sm font-semibold text-violet-100">
          Owner payroll split
        </h2>
        <p className="mt-1 max-w-2xl text-[11px] text-zinc-400">
          Split staff wages between your wallets and shop cash — not from sales
          profit. Volunteer day = you pay 100% from your wallet. Other days split
          by % below.
        </p>
      </div>

      <form
        action={formAction}
        className="mt-4 space-y-4 rounded-xl border border-violet-500/25 bg-black/25 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-300">
            Split shared-day wages (not sales profit)
          </p>
          <span
            className={`text-[11px] font-medium ${
              isValidTotal ? "text-emerald-300" : "text-amber-300"
            }`}
          >
            Total: {percentTotal}% {isValidTotal ? "✓" : "(must be 100%)"}
          </span>
        </div>

        <SplitBar
          owner1Percent={draft.owner1Percent}
          owner2Percent={draft.owner2Percent}
          payrollPoolPercent={draft.payrollPoolPercent}
          owner1Name={draft.owner1Name}
          owner2Name={draft.owner2Name}
        />

        <div className="flex flex-wrap gap-2">
          {SPLIT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              title={preset.hint}
              onClick={() => applyPreset(preset)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-zinc-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-100"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-zinc-400">
            Owner 1 name
            <input
              name="owner1Name"
              value={draft.owner1Name}
              onChange={(e) => updateDraft("owner1Name", e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs text-zinc-400">
            Owner 2 name
            <input
              name="owner2Name"
              value={draft.owner2Name}
              onChange={(e) => updateDraft("owner2Name", e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs text-zinc-400">
            {draft.owner1Name} wallet %
            <input
              name="owner1Percent"
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.owner1Percent}
              onChange={(e) =>
                updateDraft("owner1Percent", parsePercentInput(e.target.value))
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs text-zinc-400">
            {draft.owner2Name} wallet %
            <input
              name="owner2Percent"
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.owner2Percent}
              onChange={(e) =>
                updateDraft("owner2Percent", parsePercentInput(e.target.value))
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs text-zinc-400">
            Shop pays % (shop cash expense)
            <input
              name="payrollPoolPercent"
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.payrollPoolPercent}
              onChange={(e) =>
                updateDraft("payrollPoolPercent", parsePercentInput(e.target.value))
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            />
            <span className="mt-1 block text-[10px] text-zinc-600">
              Logged to shop cash when you pay — deducted from sales on-hand
            </span>
          </label>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-medium text-zinc-300">
            Weekly volunteer days (pay full from your wallet)
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            One day per week each owner covers all staff hours personally — no
            split with your partner or the staff pool on that weekday.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-400">
              {draft.owner1Name} volunteer day
              <select
                name="owner1VolunteerWeekday"
                value={
                  draft.owner1VolunteerWeekday == null
                    ? ""
                    : String(draft.owner1VolunteerWeekday)
                }
                onChange={(e) =>
                  updateDraft(
                    "owner1VolunteerWeekday",
                    parseVolunteerWeekday(e.target.value),
                  )
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Not set</option>
                {VOLUNTEER_WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-400">
              {draft.owner2Name} volunteer day
              <select
                name="owner2VolunteerWeekday"
                value={
                  draft.owner2VolunteerWeekday == null
                    ? ""
                    : String(draft.owner2VolunteerWeekday)
                }
                onChange={(e) =>
                  updateDraft(
                    "owner2VolunteerWeekday",
                    parseVolunteerWeekday(e.target.value),
                  )
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Not set</option>
                {VOLUNTEER_WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {draft.owner1VolunteerWeekday != null ||
          draft.owner2VolunteerWeekday != null ? (
            <p className="mt-2 text-[10px] text-zinc-500">
              {draft.owner1Name}:{" "}
              {volunteerWeekdayLabel(draft.owner1VolunteerWeekday)} ·{" "}
              {draft.owner2Name}:{" "}
              {volunteerWeekdayLabel(draft.owner2VolunteerWeekday)}
            </p>
          ) : null}
        </div>

        {selectedUnpaid && sharedDayPreviewCents > 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px]">
            <p className="text-zinc-500">
              Example on selected unpaid — shared days only (
              {formatPhpFromCents(sharedDayPreviewCents)}):
            </p>
            <p className="mt-1 text-zinc-300">
              {draft.owner1Name} wallet{" "}
              <span className="text-violet-200">
                {formatPhpFromCents(previewAllocation.owner1Cents)}
              </span>
              {" · "}
              {draft.owner2Name} wallet{" "}
              <span className="text-violet-200">
                {formatPhpFromCents(previewAllocation.owner2Cents)}
              </span>
              {" · "}
              Shop cash{" "}
              <span className="text-emerald-200">
                {formatPhpFromCents(previewAllocation.payrollPoolCents)}
              </span>
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || !isValidTotal}
            className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save split"}
          </button>
          {!isValidTotal ? (
            <p className="text-[11px] text-amber-200/90">
              Adjust percentages until they total exactly 100%.
            </p>
          ) : null}
        </div>

        {state?.error ? (
          <p className="text-xs text-red-300" role="alert">
            {state.error}
          </p>
        ) : null}
        {validationError && !state?.error && !isValidTotal ? (
          <p className="text-xs text-amber-300" role="status">
            {validationError}
          </p>
        ) : null}
        {state?.ok ? (
          <p className="text-xs text-emerald-300" role="status">
            {state.message}
          </p>
        ) : null}
      </form>

      <div className="mt-4 rounded-xl border border-brand-cyan/20 bg-brand-cyan/[0.03] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-brand-cyan/90">
              Unpaid salaries
            </h3>
            <p className="mt-1 max-w-2xl text-[10px] text-zinc-500">
              Select a pending payroll (like Ready to pay below) to see how much
              each owner and the staff pool should cover — volunteer days are paid
              in full by that owner only.
            </p>
          </div>
          {unpaidPayroll.length > 0 ? (
            <span className="rounded-full border border-brand-cyan/30 px-2 py-0.5 text-[10px] text-brand-cyan/80">
              {unpaidPayroll.length} pending
            </span>
          ) : null}
        </div>

        {unpaidPayroll.length === 0 ? (
          <p className="mt-3 text-[11px] text-zinc-600">
            No unpaid staff payroll right now — locked or ready rows will appear
            here.
          </p>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {unpaidPayroll.map((item: UnpaidPayrollItem) => {
                const selected = item.rowKey === selectedUnpaidKey;
                const preview = buildUnpaidPayrollSplitBreakdown(item, draft);
                return (
                  <button
                    key={item.rowKey}
                    type="button"
                    onClick={() => setSelectedUnpaidKey(item.rowKey)}
                    className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                      selected
                        ? "border-brand-cyan/40 bg-brand-cyan/10"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-zinc-100">
                        {item.employeeName}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {item.label} · {formatDuration(item.minutesWorked)} ·{" "}
                        {item.status === "ready" ? "Ready to pay" : "Awaiting payment"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-brand-cyan/90">
                        {formatPhpFromCents(item.grossPayCents)}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        You: {formatPhpFromCents(preview.owner1TotalCents)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedBreakdown ? (
              <UnpaidPayrollBreakdownCard
                breakdown={selectedBreakdown}
                owner1Name={draft.owner1Name}
                owner2Name={draft.owner2Name}
                owner1Percent={draft.owner1Percent}
                owner2Percent={draft.owner2Percent}
                payrollPoolPercent={draft.payrollPoolPercent}
              />
            ) : null}
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <WalletObligationsCard
          owner1Name={draft.owner1Name}
          owner2Name={draft.owner2Name}
          obligations={props.dashboard.walletObligations}
        />
        <ShopCashStatusCard
          cashInHandCents={props.dashboard.shopCash.cashInHandCents}
          availableShopCashCents={props.dashboard.shopCash.availableShopCashCents}
          pendingShopPoolCents={props.dashboard.shopCash.pendingShopPoolCents}
        />
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-[10px] text-zinc-500">
        <p className="font-medium text-zinc-400">How to use this</p>
        <ul className="mt-1.5 list-inside list-disc space-y-1">
          <li>
            Volunteer day = that owner pays 100% from personal wallet — partner
            and shop pay nothing that day.
          </li>
          <li>
            Other days: split wages by wallet % (owners) + shop cash % (logged as
            payroll expense when you hit Pay now).
          </li>
          <li>Shop pool uses sales on-hand cash — not investor capital.</li>
          <li>Pick an unpaid salary above to see the exact split before paying.</li>
        </ul>
      </div>
    </section>
  );
}
