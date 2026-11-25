import type { ReactNode } from "react";
import { TopBar } from "@/components/TopBar";
import { SideNav, type NavGroup } from "@/components/SideNav";
import { Chip, icons } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Convenience, not the security boundary: every query underneath still goes
  // through Row Level Security, so forcing a way past this shows empty tables
  // rather than anyone's records.
  const viewer = await requireAdmin();

  const groups: NavGroup[] = [
    { items: [{ href: "/admin", label: "Overview", icon: icons.grid, exact: true }] },
    {
      heading: "People",
      items: [
        { href: "/admin/people", label: "Students & staff", icon: icons.people },
        ...(viewer.isSuperAdmin
          ? [
              {
                href: "/admin/administrators",
                label: "Administrators",
                icon: icons.shield,
              },
            ]
          : []),
      ],
    },
    {
      heading: "Academic setup",
      items: [
        { href: "/admin/academic", label: "Batches, levels, terms", icon: icons.list },
        { href: "/admin/sections", label: "Sections", icon: icons.section },
        { href: "/admin/courses", label: "Courses", icon: icons.book },
        { href: "/admin/schedule", label: "Class schedule", icon: icons.calendar },
      ],
    },
    {
      heading: "Oversight",
      items: [{ href: "/admin/activity", label: "Activity log", icon: icons.clock }],
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <TopBar viewer={viewer} home="/admin">
        <Chip tone={viewer.isSuperAdmin ? "live" : "neutral"}>
          {viewer.isSuperAdmin ? "Super admin" : "Admin"}
        </Chip>
      </TopBar>
      <div className="flex flex-1 flex-wrap items-stretch">
        <SideNav groups={groups} />
        <div className="min-w-0 flex-[999_1_560px] px-6 py-7 sm:px-7">{children}</div>
      </div>
    </div>
  );
}
