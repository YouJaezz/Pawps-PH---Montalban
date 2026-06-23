import { AttendancePanel } from "@/app/attendance/AttendancePanel";
import { AppShell } from "@/components/AppShell";
import { getAttendancePageData } from "@/db/queries/time-attendance";
import { requireAuth } from "@/lib/auth-guard";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const session = await requireAuth();
  const adminView = isAdmin(session.role);
  const data = await getAttendancePageData(session.userId, adminView);

  return (
    <AppShell session={session}>
      <div className="w-full px-0 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">Time In / Time Out</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {adminView
            ? "Track employee shifts and monthly hours for payroll."
            : "Clock in when you start and clock out when you finish. Your monthly total is below."}
        </p>
        <div className="mt-6">
          <AttendancePanel
            adminView={adminView}
            monthLabel={data.monthLabel}
            monthMinutes={data.monthMinutes}
            openEntry={data.openEntry}
            monthEntries={data.monthEntries}
            teamTotals={data.teamTotals}
            activeShifts={data.activeShifts}
            openClockInAt={data.openEntry?.clockInAt.toISOString() ?? null}
            settings={data.settings}
            staffLocked={data.staffLocked}
          />
        </div>
      </div>
    </AppShell>
  );
}
