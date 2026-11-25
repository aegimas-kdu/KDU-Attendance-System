"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /** Match only this exact path, not its children. */
  exact?: boolean;
};

export type NavGroup = { heading?: string; items: NavItem[] };

export function SideNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <nav className="w-full border-b border-line bg-white p-3 lg:w-62 lg:border-b-0 lg:border-r">
      {groups.map((group, i) => (
        <div key={group.heading ?? i}>
          {group.heading && (
            <p className="px-3 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
              {group.heading}
            </p>
          )}
          {group.items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm no-underline ${
                  active
                    ? "bg-brand-50 font-semibold text-brand-900 shadow-[inset_2px_0_0_var(--color-brand)]"
                    : "font-medium text-ink-2 hover:bg-page"
                }`}
              >
                <Icon path={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
