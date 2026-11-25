import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardFoot,
  CardHead,
  Chip,
  Empty,
  PageHead,
  Td,
  Th,
} from "@/components/ui";
import { requireProfessor } from "@/lib/auth";
import { PERIODS, hhmm, listClassesBetween, today, weekBounds } from "@/lib/data/schedule";
import { listMyOfferings } from "@/lib/data/teaching";

export const metadata: Metadata = { title: "My week" };

const DAYS = [
  { value: 1, name: "Monday" },
  { value: 2, name: "Tuesday" },
  { value: 3, name: "Wednesday" },
  { value: 4, name: "Thursday" },
  { value: 5, name: "Friday" },
];

function shiftWeek(offset: number) {
  const base = new Date();
  base.setDate(base.getDate() + offset * 7);
  return weekBounds(base);
}

export default async function MyWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const viewer = await requireProfessor();
  const { w } = await searchParams;
  const offset = Number(w ?? 0) || 0;

  const week = shiftWeek(offset);
  const [classes, offerings] = await Promise.all([
    listClassesBetween(week.from, week.to),
    listMyOfferings(viewer.professorId),
  ]);

  const dates = new Map<number, string>();
  for (const c of classes) {
    if (c.session_date) dates.set(c.weekday, c.session_date);
  }

  // Dated meetings, keyed by day and period, so a cell is one lookup.
  const cells = new Map<string, typeof classes>();
  for (const c of classes) {
    const key = `${c.weekday}-${hhmm(c.start_time)}`;
    cells.set(key, [...(cells.get(key) ?? []), c]);
  }

  const now = today();
  const rangeLabel = `${new Date(week.from).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })} – ${new Date(week.to).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

  return (
    <>
      <PageHead
        crumbs={<Link href="/teach">Today</Link>}
        title="My week"
        subtitle={`Your classes, ${rangeLabel}. ${classes.length} ${
          classes.length === 1 ? "class" : "classes"
        } this week.`}
      >
        <span className="inline-flex gap-2">
          <Link
            href={`/teach/schedule?w=${offset - 1}`}
            className="inline-flex min-h-9 items-center rounded-lg border border-line-2 bg-white px-3 text-sm font-semibold no-underline hover:bg-page"
          >
            Last week
          </Link>
          {offset !== 0 && (
            <Link
              href="/teach/schedule"
              className="inline-flex min-h-9 items-center rounded-lg border border-line-2 bg-white px-3 text-sm font-semibold no-underline hover:bg-page"
            >
              This week
            </Link>
          )}
          <Link
            href={`/teach/schedule?w=${offset + 1}`}
            className="inline-flex min-h-9 items-center rounded-lg border border-line-2 bg-white px-3 text-sm font-semibold no-underline hover:bg-page"
          >
            Next week
          </Link>
        </span>
      </PageHead>

      <Card>
        <CardHead title={rangeLabel}>
          <span className="flex-1" />
          <Chip tone="neutral">{offerings.length} courses</Chip>
        </CardHead>

        {classes.length === 0 ? (
          <CardBody>
            <Empty title="No classes this week">
              Either the term has not reached this week or your class times have not been
              set. The registry sets them under Class schedule.
            </Empty>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr>
                  <Th className="w-28">Period</Th>
                  {DAYS.map((d) => {
                    const date = dates.get(d.value);
                    return (
                      <Th key={d.value}>
                        {d.name}
                        {date && (
                          <span
                            className={`num ml-1.5 font-normal ${
                              date === now ? "text-brand-900" : "text-faint"
                            }`}
                          >
                            {new Date(date).getDate()}
                          </span>
                        )}
                      </Th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period, index) => (
                  <tr key={period.start}>
                    <Td num className="align-top whitespace-nowrap text-muted">
                      <b className="block text-ink">Period {index + 1}</b>
                      {period.label}
                    </Td>
                    {DAYS.map((day) => {
                      const group = cells.get(`${day.value}-${period.start}`) ?? [];
                      return (
                        <Td key={day.value} className="align-top">
                          {group.length === 0 ? (
                            <span className="text-faint">—</span>
                          ) : (
                            <div className="grid gap-2">
                              {group.map((c) => (
                                <Link
                                  key={c.session_id}
                                  href={`/teach/class/${c.session_id}`}
                                  className={`block rounded-lg border px-3 py-2 no-underline ${
                                    c.status === "cancelled"
                                      ? "border-line-2 bg-page opacity-70"
                                      : c.status === "open"
                                        ? "border-present bg-present-bg"
                                        : c.session_date === now
                                          ? "border-brand-600 bg-brand-50"
                                          : "border-line-2 bg-white"
                                  }`}
                                >
                                  <b className="block leading-snug text-ink">
                                    {c.course_name}
                                  </b>
                                  <small className="num block text-[13px] text-muted">
                                    {c.course_code}
                                    {c.room ? ` · ${c.room}` : ""}
                                  </small>
                                  {c.status === "open" && (
                                    <span className="mt-1 inline-block">
                                      <Chip tone="open" dot>
                                        Open now
                                      </Chip>
                                    </span>
                                  )}
                                  {c.status === "cancelled" && (
                                    <span className="mt-1 inline-block">
                                      <Chip tone="absent">Cancelled</Chip>
                                    </span>
                                  )}
                                  {c.status === "closed" && (
                                    <small className="block text-[13px] text-muted">
                                      Attendance taken
                                    </small>
                                  )}
                                </Link>
                              ))}
                            </div>
                          )}
                        </Td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <CardFoot>
          <span className="text-sm text-muted">
            Four periods a day, 09:00 to 12:50, each 50 minutes with a 10 minute break
            after it. Tap a class to take attendance.
          </span>
        </CardFoot>
      </Card>
    </>
  );
}
