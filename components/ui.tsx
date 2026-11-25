import type { ReactNode } from "react";
import type { AttendanceStatus } from "@/lib/database.types";

/**
 * The pieces from the design system board, as components.
 *
 * Everything here is presentational and server-safe — no "use client", no
 * state. Interactive widgets live beside the page that needs them.
 */

// ---------------------------------------------------------------- card

export function Card({
  children,
  className = "",
  tone = "plain",
}: {
  children: ReactNode;
  className?: string;
  tone?: "plain" | "quiet" | "brand" | "warn" | "danger";
}) {
  const tones = {
    plain: "border-line bg-white",
    quiet: "border-line bg-[#fafbfc]",
    brand: "border-brand-200 bg-white shadow-md",
    warn: "border-[#e7c9a6] bg-[#fffcf6]",
    danger: "border-[#e9c6ca] bg-[#fff8f8]",
  };
  return (
    <section
      className={`rounded-card border shadow-sm ${tones[tone]} ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHead({
  title,
  children,
  tone = "plain",
}: {
  title?: ReactNode;
  children?: ReactNode;
  tone?: "plain" | "brand";
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-b px-5 py-4 ${
        tone === "brand"
          ? "rounded-t-card border-brand-200 bg-brand-50"
          : "border-line"
      }`}
    >
      {title && (
        <h2
          className={`text-card font-semibold ${
            tone === "brand" ? "text-brand-900" : ""
          }`}
        >
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function CardFoot({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-b-card border-t border-line bg-[#fafbfc] px-5 py-3">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- page

export function PageHead({
  crumbs,
  title,
  subtitle,
  children,
}: {
  crumbs?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      {crumbs && <p className="mb-2.5 text-[13px] text-muted">{crumbs}</p>}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-[999_1_360px]">
          <h1 className="mb-1.5 text-page-title font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return <h2 className="text-section font-semibold tracking-tight">{children}</h2>;
}

// ---------------------------------------------------------------- status

type Tone =
  | AttendanceStatus
  | "neutral"
  | "ghost"
  | "open"
  | "live"
  | "pending";

const TONES: Record<Tone, string> = {
  present: "bg-present-bg text-present-ink",
  late: "bg-late-bg text-late-ink",
  absent: "bg-absent-bg text-absent-ink",
  excused: "bg-excused-bg text-excused-ink",
  pending: "bg-late-bg text-late-ink",
  neutral: "bg-[#edeff3] text-ink-2",
  ghost: "text-muted shadow-[inset_0_0_0_1px_var(--color-line-2)]",
  open: "bg-present text-white",
  live: "bg-accent text-white",
};

/**
 * A status always carries its word. Colour is the second signal, never the
 * only one — which is what makes the four attendance colours safe for a
 * colour-blind reader, and what makes them survive a photocopier.
 */
export function Chip({
  tone = "neutral",
  dot = false,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-0.5 pl-2 pr-2.5 text-[13px] font-semibold leading-5 ${TONES[tone]}`}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function StatusChip({
  status,
}: {
  status: AttendanceStatus | "not marked";
}) {
  if (status === "not marked") return <Chip tone="ghost">Not marked</Chip>;
  const label = { present: "Present", late: "Late", absent: "Absent", excused: "Excused" };
  return (
    <Chip tone={status} dot>
      {label[status]}
    </Chip>
  );
}

// ---------------------------------------------------------------- tiles

export function Tile({
  label,
  value,
  note,
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-white px-5 py-4 shadow-sm">
      <p className="mb-2 text-[13px] font-medium text-muted">{label}</p>
      <div className="num text-[32px] font-bold leading-none tracking-tight">{value}</div>
      {note && <p className="mt-2 text-[13px] text-muted">{note}</p>}
      {children}
    </div>
  );
}

/** The attendance split as one bar. Segments keep a 2px gap so they read apart. */
export function Meter({
  present = 0,
  late = 0,
  absent = 0,
  excused = 0,
  className = "",
}: {
  present?: number;
  late?: number;
  absent?: number;
  excused?: number;
  className?: string;
}) {
  const total = present + late + absent + excused;
  if (!total) {
    return <div className={`h-2.5 rounded-full bg-[#e4e9f0] ${className}`} />;
  }
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className={`flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[#e4e9f0] ${className}`}>
      {present > 0 && <span className="bg-present" style={{ width: pct(present) }} />}
      {late > 0 && <span className="bg-late" style={{ width: pct(late) }} />}
      {absent > 0 && <span className="bg-absent" style={{ width: pct(absent) }} />}
      {excused > 0 && <span className="bg-excused" style={{ width: pct(excused) }} />}
    </div>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-[13px] text-ink-2">
      {[
        ["Present", "bg-present"],
        ["Late", "bg-late"],
        ["Absent", "bg-absent"],
        ["Excused", "bg-excused"],
      ].map(([label, bg]) => (
        <span key={label} className="inline-flex items-center gap-1.5 font-medium">
          <i className={`block h-2.5 w-2.5 rounded-sm ${bg}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- people

export function Avatar({
  name,
  size = 34,
}: {
  name: string | null | undefined;
  size?: number;
}) {
  const letters = (name ?? "?")
    .trim()
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-brand-50 font-bold text-brand-900"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.35) }}
    >
      {letters || "?"}
    </span>
  );
}

export function Person({
  name,
  detail,
}: {
  name: string;
  detail?: ReactNode;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <Avatar name={name} />
      <span className="min-w-0">
        <b className="block truncate text-sm font-semibold">{name}</b>
        {detail && <small className="num block text-[13px] text-muted">{detail}</small>}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- table

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

export function Th({
  children,
  right = false,
  className = "",
}: {
  children?: ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap border-b border-line px-3.5 py-3 text-xs font-semibold uppercase tracking-[0.07em] text-faint ${
        right ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right = false,
  num = false,
  className = "",
  colSpan,
}: {
  children?: ReactNode;
  right?: boolean;
  num?: boolean;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-line px-3.5 py-3 align-middle text-sm ${
        right ? "text-right" : ""
      } ${num ? "num" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

// ---------------------------------------------------------------- misc

export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-line-2 bg-[#fafbfc] px-6 py-10 text-center">
      <p className="mb-1 font-semibold">{title}</p>
      {children && <p className="text-sm text-muted">{children}</p>}
    </div>
  );
}

export function Alert({
  tone = "warn",
  title,
  children,
}: {
  tone?: "warn" | "danger" | "info";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    warn: "border-[#e7c9a6] bg-[#fffcf6] text-ink-2",
    danger: "border-[#e9c6ca] bg-absent-bg text-absent-ink",
    info: "border-brand-200 bg-brand-50 text-ink-2",
  };
  return (
    <div className={`rounded-card border px-4 py-3 text-sm ${tones[tone]}`} role="alert">
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- icons

export function Icon({
  path,
  size = 18,
  className = "",
}: {
  path: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {path}
    </svg>
  );
}

export const icons = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </>
  ),
  people: (
    <>
      <path d="M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 19v-2a4 4 0 0 0-3-3.9" />
    </>
  ),
  shield: <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6z" />,
  list: <path d="M4 7h16M4 12h16M4 17h10" />,
  section: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  book: (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="M8 5v14" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  chart: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  download: <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" />,
  warning: (
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 2.4 17a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  leave: (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="M4 9h16M9 13h7" />
    </>
  ),
};
