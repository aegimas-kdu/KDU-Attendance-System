import type { ReactNode } from "react";
import { Brand } from "@/components/Brand";
import { Avatar } from "@/components/ui";
import { signOut } from "@/lib/actions/auth";
import { roleLabel, type Viewer } from "@/lib/auth";

/**
 * The header. Deep Navy with a Primary rule under it — the design system
 * board explains why: the bar sits above blue hero panels and blue buttons,
 * and blue on blue loses its edge.
 */
export function TopBar({
  viewer,
  home,
  children,
}: {
  viewer: Viewer;
  home: string;
  children?: ReactNode;
}) {
  const label = roleLabel(viewer.profile.role, viewer.profile.admin_level);

  return (
    <header className="flex min-h-16 flex-wrap items-center gap-x-6 gap-y-3 bg-navy px-4 py-3 shadow-[inset_0_-3px_0_var(--color-brand)] sm:px-6 sm:py-0">
      <Brand href={home} />
      {children}
      <span className="flex-1" />
      <span className="flex items-center gap-2.5 rounded-full bg-white/10 py-1 pl-1 pr-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs font-bold text-white">
          {(viewer.profile.full_name ?? "?")
            .trim()
            .split(/\s+/)
            .map((p) => p[0] ?? "")
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
        <span className="text-[13px] font-semibold leading-tight text-white">
          {viewer.profile.full_name}
          <span className="block text-[11.5px] font-normal text-brand-200">{label}</span>
        </span>
      </span>
      <form action={signOut}>
        <button
          type="submit"
          className="inline-flex min-h-9 items-center rounded-lg border border-white/45 px-3 text-[13px] font-semibold text-white hover:bg-white/10"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}

/** Unused export kept out of the bundle; Avatar is re-exported for pages. */
export { Avatar };
