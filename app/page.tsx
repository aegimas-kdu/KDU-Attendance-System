import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/Brand";

const announcements = [
  {
    date: "23 November",
    from: "Registry",
    title: "Final examination timetable published",
    body: "The examination schedule for Fall 2026 is now on your course pages. Check your rooms before 1 December.",
  },
  {
    date: "20 November",
    from: "Academic Affairs",
    title: "Room 5302 unavailable on Wednesday 25 November",
    body: "Classes scheduled in 5302 on Wednesday move to Room 1403. Affected schedules have been updated.",
  },
  {
    date: "17 November",
    from: "Student Affairs",
    title: "Attendance rules for this term",
    body: "Three late marks count as one absence. You can see your own record at any time once you sign in.",
  },
];

const calendar = [
  ["1 Sep", "Term began"],
  ["12 – 16 Oct", "Midterm examinations"],
  ["25 Nov", "Room change for classes in 5302"],
  ["14 – 18 Dec", "Final examinations"],
  ["31 Dec", "Term ends"],
];

export default function WelcomePage() {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <header className="flex min-h-16 flex-wrap items-center gap-x-6 gap-y-3 bg-navy px-4 py-3 shadow-[inset_0_-3px_0_var(--color-brand)] sm:px-6 sm:py-0">
        <Brand />
        <nav className="flex flex-wrap gap-1 text-sm">
          <a href="#news" className="rounded-lg px-3 py-2 text-brand-100 no-underline hover:bg-white/10 hover:text-white">
            Announcements
          </a>
          <a href="#calendar" className="rounded-lg px-3 py-2 text-brand-100 no-underline hover:bg-white/10 hover:text-white">
            Academic calendar
          </a>
          <a href="#help" className="rounded-lg px-3 py-2 text-brand-100 no-underline hover:bg-white/10 hover:text-white">
            Help
          </a>
        </nav>
        <span className="flex-1" />
        <Link
          href="/register"
          className="inline-flex min-h-9 items-center rounded-lg border border-white/45 px-3 text-[13px] font-semibold text-white no-underline hover:bg-white/10"
        >
          Create account
        </Link>
        <Link
          href="/sign-in"
          className="inline-flex min-h-9 items-center rounded-lg bg-white px-3 text-[13px] font-semibold text-brand-900 no-underline hover:bg-brand-50"
        >
          Sign in
        </Link>
      </header>

      <section className="bg-[linear-gradient(168deg,#0a66c2_0%,#0754a5_52%,#04356b_100%)] px-6 py-12 text-white sm:px-12 sm:py-16">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-10 lg:gap-12">
          <div className="min-w-0 flex-[999_1_420px]">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.09em] text-brand-200">
              Kyungdong University Global
            </p>
            <h1 className="mb-4 max-w-[17ch] text-[28px] font-bold leading-[1.18] tracking-tight sm:text-[34px] lg:text-[40px] lg:leading-[1.14]">
              Your classes, attendance and materials in one place
            </h1>
            <p className="mb-7 max-w-[54ch] text-base leading-relaxed text-brand-100">
              Mark your attendance from your phone, download the slides your professor
              uploaded, check the week&rsquo;s schedule and request leave — without leaving
              the portal.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sign-in"
                className="inline-flex min-h-12 items-center rounded-lg bg-white px-6 font-semibold text-brand-900 no-underline hover:bg-brand-50"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center rounded-lg border border-white/50 px-6 font-semibold text-white no-underline hover:bg-white/10"
              >
                Create a student account
              </Link>
            </div>
          </div>
          <div className="grid flex-[1_1_300px] place-items-center">
            <Image
              src="/logo.png"
              alt=""
              width={220}
              height={242}
              className="h-[150px] w-auto drop-shadow-2xl sm:h-[220px]"
            />
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-white px-6 py-5 sm:px-12">
        <dl className="mx-auto grid max-w-5xl grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5">
          {[
            ["Current term", "Fall 2026", "1 September – 31 December"],
            ["Week", "12 of 16", "Monday 23 November"],
            ["Classes today", "09:00 – 12:50", "Four periods of 50 minutes"],
            ["Final examinations", "14 – 18 Dec", "Timetable published"],
          ].map(([label, value, note]) => (
            <div key={label}>
              <dt className="mb-1 text-xs font-semibold uppercase tracking-[0.09em] text-faint">
                {label}
              </dt>
              <dd className="num text-[19px] font-semibold">{value}</dd>
              <dd className="text-[13px] text-muted">{note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:px-12">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          <div id="news" className="rounded-card border border-line bg-white shadow-sm">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-card font-semibold">Announcements</h2>
            </div>
            {announcements.map((a, i) => (
              <article
                key={a.title}
                className={i < announcements.length - 1 ? "border-b border-line p-5" : "p-5"}
              >
                <p className="mb-1.5 text-[13px] text-muted">
                  {a.date} · {a.from}
                </p>
                <h3 className="mb-1 font-semibold">{a.title}</h3>
                <p className="text-sm text-muted">{a.body}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-5">
            <div id="calendar" className="rounded-card border border-line bg-white shadow-sm">
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-card font-semibold">Academic calendar</h2>
              </div>
              <table className="w-full">
                <tbody>
                  {calendar.map(([when, what], i) => (
                    <tr key={when} className={i < calendar.length - 1 ? "border-b border-line" : ""}>
                      <td className="num w-32 px-5 py-3 text-sm text-muted">{when}</td>
                      <td className="px-5 py-3 text-sm">{what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div id="help" className="rounded-card border border-line bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-card font-semibold">Need help?</h2>
              <p className="mb-4 text-sm text-muted">
                Forgotten your password, or your courses are missing from the portal?
              </p>
              <a
                href="#"
                className="inline-flex min-h-9 items-center rounded-md border border-line-2 bg-white px-3 text-[13px] font-semibold no-underline hover:bg-page"
              >
                Contact the registry
              </a>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-navy px-6 py-6 text-brand-200 sm:px-12">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-5 text-[13px]">
          <Image src="/logo.png" alt="" width={34} height={37} className="h-8 w-auto" />
          <span>Kyungdong University Global</span>
          <span className="flex-1" />
          <a href="#" className="text-brand-100 no-underline hover:text-white">Privacy</a>
          <a href="#" className="text-brand-100 no-underline hover:text-white">Terms of use</a>
          <a href="#" className="text-brand-100 no-underline hover:text-white">Contact</a>
        </div>
      </footer>
    </div>
  );
}
