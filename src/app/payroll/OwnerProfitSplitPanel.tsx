"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { updateOwnerProfitSplitSettings } from "@/app/payroll/actions";
import type { OwnerProfitSplitDashboard } from "@/db/queries/owner-profit-split";
import {
  allocateGrossProfit,
  buildOwnerPayrollPlan,
  validateOwnerProfitSplit,
  type OwnerPayrollPlanScope,
  type OwnerProfitSplitSettings,
} from "@/lib/owner-profit-split";
import { formatPhpFromCents } from "@/lib/money";

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
    hint: "All profit to staff pool",
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
          title={`Staff pool ${payrollPoolPercent}%`}
        />
      ) : null}
    </div>
  );
}

function PlanScopeCard(props: {
  plan: OwnerPayrollPlanScope;
  owner1Name: string;
  owner2Name: string;
  owner1Percent: number;
  owner2Percent: number;
  payrollPoolPercent: number;
}) {
  const { plan } = props;
  const shortfall = plan.staffOwedCents > plan.allocation.payrollPoolCents;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-zinc-200">{plan.label}</div>
          <div className="mt-0.5 text-[10px] text-zinc-500">
            {plan.profit.orderCount} paid order
            {plan.profit.orderCount === 1 ? "" : "s"} · gross profit basis
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-zinc-500">Gross profit</div>
          <div className="text-lg font-semibold text-brand-cyan/90">
            {formatPhpFromCents(plan.profit.netIncomeCents)}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
          <div className="text-[10px] text-violet-200/70">
            {props.owner1Name} ({props.owner1Percent}%)
          </div>
          <div className="text-sm font-semibold text-violet-100">
            {formatPhpFromCents(plan.allocation.owner1Cents)}
          </div>
        </div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
          <div className="text-[10px] text-violet-200/70">
            {props.owner2Name} ({props.owner2Percent}%)
          </div>
          <div className="text-sm font-semibold text-violet-100">
            {formatPhpFromCents(plan.allocation.owner2Cents)}
          </div>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <div className="text-[10px] text-emerald-200/70">
            Staff pool ({props.payrollPoolPercent}%)
          </div>
          <div className="text-sm font-semibold text-emerald-100">
            {formatPhpFromCents(plan.allocation.payrollPoolCents)}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-[11px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-zinc-400">Staff owed (hours × rate)</span>
          <span className="font-medium text-zinc-200">
            {formatPhpFromCents(plan.staffOwedCents)}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-zinc-400">Suggested pay from pool</span>
          <span className="font-medium text-emerald-200">
            {formatPhpFromCents(plan.staffSuggestedTotalCents)}
          </span>
        </div>
        {shortfall && plan.staffOwedCents > 0 ? (
          <p className="mt-2 text-amber-200/90">
            Pool covers{" "}
            {plan.staffLines[0]?.coveredPercent ?? 0}% of hours-based pay — scale
            down or owners take less this period.
          </p>
        ) : plan.poolSurplusCents > 0 && plan.staffOwedCents > 0 ? (
          <p className="mt-2 text-emerald-200/80">
            {formatPhpFromCents(plan.poolSurplusCents)} left in staff pool after
            full hours-based pay.
          </p>
        ) : null}
      </div>

      {plan.staffLines.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="text-left text-[10px] text-zinc-500">
              <tr>
                <th className="px-2 py-1">Employee</th>
                <th className="px-2 py-1 text-right">Hours owed</th>
                <th className="px-2 py-1 text-right">Suggested pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {plan.staffLines.map((line) => (
                <tr key={line.userId}>
                  <td className="px-2 py-1.5 text-zinc-200">{line.employeeName}</td>
                  <td className="px-2 py-1.5 text-right text-zinc-400">
                    {formatPhpFromCents(line.hoursOwedCents)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-emerald-200/90">
                    {formatPhpFromCents(line.suggestedPayCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-[10px] text-zinc-600">
          No cashier hours in this window yet — staff pool still accrues from profit.
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

  useEffect(() => {
    setDraft({ ...saved });
  }, [
    saved.owner1Name,
    saved.owner2Name,
    saved.owner1Percent,
    saved.owner2Percent,
    saved.payrollPoolPercent,
  ]);

  const staffLinesFrom = (plan: OwnerPayrollPlanScope) =>
    plan.staffLines.map((line) => ({
      userId: line.userId,
      employeeName: line.employeeName,
      hoursOwedCents: line.hoursOwedCents,
    }));

  const currentPeriodPlan = useMemo(
    () =>
      buildOwnerPayrollPlan(
        props.dashboard.currentPeriod.label,
        props.dashboard.currentPeriod.profit,
        draft,
        staffLinesFrom(props.dashboard.currentPeriod),
      ),
    [draft, props.dashboard.currentPeriod],
  );

  const currentMonthPlan = useMemo(
    () =>
      buildOwnerPayrollPlan(
        props.dashboard.currentMonth.label,
        props.dashboard.currentMonth.profit,
        draft,
        staffLinesFrom(props.dashboard.currentMonth),
      ),
    [draft, props.dashboard.currentMonth],
  );

  const percentTotal =
    draft.owner1Percent + draft.owner2Percent + draft.payrollPoolPercent;
  const isValidTotal = percentTotal === 100;
  const validationError = useMemo(
    () => (isValidTotal ? null : validateOwnerProfitSplit(draft)),
    [draft, isValidTotal],
  );

  const previewProfitCents = props.dashboard.currentPeriod.profit.netIncomeCents;
  const previewAllocation = useMemo(
    () => allocateGrossProfit(previewProfitCents, draft),
    [previewProfitCents, draft],
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
          Owner &amp; staff profit split
        </h2>
        <p className="mt-1 max-w-2xl text-[11px] text-zinc-400">
          Set how gross profit is divided anytime — lower an owner to 0% if they
          step back, or raise the staff pool when you want more pay going to the
          shop team. Changes apply to the breakdown below after you save.
        </p>
      </div>

      <form
        action={formAction}
        className="mt-4 space-y-4 rounded-xl border border-violet-500/25 bg-black/25 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-300">Split percentages</p>
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
            {draft.owner1Name} share %
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
            {draft.owner2Name} share %
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
            Staff / shop payroll %
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
              Raise this to give more of profit to employees
            </span>
          </label>
        </div>

        {previewProfitCents > 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px]">
            <p className="text-zinc-500">
              Live preview at current pay period profit (
              {formatPhpFromCents(previewProfitCents)}):
            </p>
            <p className="mt-1 text-zinc-300">
              {draft.owner1Name}{" "}
              <span className="text-violet-200">
                {formatPhpFromCents(previewAllocation.owner1Cents)}
              </span>
              {" · "}
              {draft.owner2Name}{" "}
              <span className="text-violet-200">
                {formatPhpFromCents(previewAllocation.owner2Cents)}
              </span>
              {" · "}
              Staff pool{" "}
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PlanScopeCard
          plan={currentPeriodPlan}
          owner1Name={draft.owner1Name}
          owner2Name={draft.owner2Name}
          owner1Percent={draft.owner1Percent}
          owner2Percent={draft.owner2Percent}
          payrollPoolPercent={draft.payrollPoolPercent}
        />
        <PlanScopeCard
          plan={currentMonthPlan}
          owner1Name={draft.owner1Name}
          owner2Name={draft.owner2Name}
          owner1Percent={draft.owner1Percent}
          owner2Percent={draft.owner2Percent}
          payrollPoolPercent={draft.payrollPoolPercent}
        />
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-[10px] text-zinc-500">
        <p className="font-medium text-zinc-400">How to use this</p>
        <ul className="mt-1.5 list-inside list-disc space-y-1">
          <li>
            Any owner can be set to 0% — their share can go to the other owner or
            staff pool.
          </li>
          <li>Pay staff from the green pool first (use suggested amounts if profit is tight).</li>
          <li>Owner draws come from the violet shares — only take them after staff is covered.</li>
          <li>Gross profit does not subtract rent, utilities, or investor share — check Reports for full picture.</li>
          <li>Left column = current pay period. Right = whole month overview.</li>
        </ul>
      </div>
    </section>
  );
}
