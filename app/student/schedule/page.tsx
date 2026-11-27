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
import { myMarksBetween } from "@/lib/data/attendance";
import { PERIODS, hhmm, listClassesBetween, today, weekBounds } from "@/lib/data/schedule";

export const metadata: Metadata = { title: "My week" };

const DAYS = [
  { value: 1, name: "Monday" },
  { value: 2, name: "Tuesday" },
  { value: 3, name: "Wednesday" },
  { value: 4, name: "Thursday" },
  { value: 5, name: "Friday" },
];

const MARK_TONE = {
  present: "present",
  late: "late",
  absent: "absent",
  excused: "excused",
} as const;

const MARK_LABEL = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
} as const;

export default async function StudentWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const offset = Number(w ?? 0) || 0;

  const base = new Date();
  base.setDate(base.getDate() + offset * 7);
  const week = weekBounds(base);

  const [classes, marks] = await Promise.all([
    listClassesBetween(week.from, week.to),
    myMarksBetween(week.from, week.to),
  ]);

  const dates = new Map<number, string>();
  for (const c of classes) {
    if (c.session_date) dates.set(c.weekday, c.session_date);
  }

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

  const nav =
    "inline-flex min-h-9 items-center rounded-lg border border-line-2 bg-white px-3 text-sm font-semibold no-underline hover:bg-page";

  return (
    <>
      <PageHead
        crumbs={<Link href="/student">Today</Link>}
        title="My week"
        subtitle={`${rangeLabel} · ${classes.length} ${
          classes.length === 1 ? "class" : "classes"
        }. Four periods a day, 09:00 to 12:50.`}
      >
        <span className="inline-flex gap-2">
          <Link href={`/student/schedule?w=${offset - 1}`} className={nav}>
            Last week
          </Link>
          {offset !== 0 && (
            <Link href="/student/schedule" className={nav}>
              This week
            </Link>
          )}
          <Link href={`/student/schedule?w=${offset + 1}`} className={nav}>
            Next week
          </Link>
        </span>
      </PageHead>

      <Card>
        <CardHead title={rangeLabel} />

        {classes.length === 0 ? (
          <CardBody>
            <Empty title="No classes this week">
              Either the term has not reached this week, or you have not been enrolled
              yet. My courses shows what you are taking.
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
                              {group.map((c) => {
                                const mark = c.session_id
                                  ? marks.get(c.session_id)
                                  : undefined;
                                return (
                                  <Link
                                    key={c.session_id}
                                    href={`/student/courses/${c.offering_id}`}
                                    className={`block rounded-lg border px-3 py-2 no-underline ${
                                      c.status === "cancelled"
                                        ? "border-line-2 bg-page opacity-70"
                                        : c.status === "open"
                                          ? "border-brand-600 bg-brand-50"
                                          : c.session_date === now
                                            ? "border-brand-600 bg-white"
                                            : "border-line-2 bg-white"
                                    }`}
                                  >
                                    <b className="block leading-snug text-ink">
                                      {c.course_name}
                                    </b>
                                    <small className="num block text-[13px] text-muted">
                                      {c.room ?? "—"}
                                      {c.professor_name ? ` · ${c.professor_name}` : ""}
                                    </small>
                                    <span className="mt-1 inline-block">
                                      {c.status === "cancelled" ? (
                                        <Chip tone="ghost">Cancelled</Chip>
                                      ) : mark ? (
                                        <Chip tone={MARK_TONE[mark.status]} dot>
                                          {MARK_LABEL[mark.status]}
                                        </Chip>
                                      ) : c.status === "open" ? (
                                        <Chip tone="live" dot>
                                          Enter the code
                                        </Chip>
                                      ) : null}
                                    </span>
                                  </Link>
                                );
                              })}
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
            Each class is 50 minutes, with a 10 minute break after it. Tap a class to see
            the course, its files and your record in it.
          </span>
        </CardFoot>
      </Card>
    </>
  );
}
