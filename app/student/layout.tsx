import type { ReactNode } from "react";
import { TopBar } from "@/components/TopBar";
import { SideNav, type NavGroup } from "@/components/SideNav";
import { Chip, icons } from "@/components/ui";
import { requireStudent } from "@/lib/auth";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  // Convenience, not the security boundary: the policies on every table below
  // narrow each query to this student's own rows, so forcing a way past this
  // shows empty pages rather than anyone else's record.
  const viewer = await requireStudent();

  const groups: NavGroup[] = [
    { items: [{ href: "/student", label: "Today", icon: icons.grid, exact: true }] },
    {
      heading: "My studies",
      items: [
        { href: "/student/schedule", label: "My week", icon: icons.calendar },
        { href: "/student/courses", label: "My courses", icon: icons.book },
        { href: "/student/attendance", label: "My attendance", icon: icons.chart },
      ],
    },
    {
      heading: "Requests",
      items: [{ href: "/student/leave", label: "Leave requests", icon: icons.leave }],
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <TopBar viewer={viewer} home="/student">
        <Chip tone="neutral">Student</Chip>
      </TopBar>
      <div className="flex flex-1 flex-wrap items-stretch">
        <SideNav groups={groups} />
        <div className="min-w-0 flex-[999_1_560px] px-6 py-7 sm:px-7">{children}</div>
      </div>
    </div>
  );
}
