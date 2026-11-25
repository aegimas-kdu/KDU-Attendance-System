import type { ReactNode } from "react";
import { TopBar } from "@/components/TopBar";
import { SideNav, type NavGroup } from "@/components/SideNav";
import { Chip, icons } from "@/components/ui";
import { requireProfessor } from "@/lib/auth";

export default async function TeachLayout({ children }: { children: ReactNode }) {
  // Convenience, not the security boundary: every query underneath still goes
  // through Row Level Security, so a professor who forced their way past this
  // would see empty tables rather than another professor's classes.
  const viewer = await requireProfessor();

  const groups: NavGroup[] = [
    { items: [{ href: "/teach", label: "Today", icon: icons.grid, exact: true }] },
    {
      heading: "Teaching",
      items: [
        { href: "/teach/schedule", label: "My week", icon: icons.calendar },
        { href: "/teach/courses", label: "My courses", icon: icons.book },
        { href: "/teach/materials", label: "Course files", icon: icons.file },
      ],
    },
    {
      heading: "Students",
      items: [{ href: "/teach/leave", label: "Leave requests", icon: icons.leave }],
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <TopBar viewer={viewer} home="/teach">
        <Chip tone="neutral">Professor</Chip>
      </TopBar>
      <div className="flex flex-1 flex-wrap items-stretch">
        <SideNav groups={groups} />
        <div className="min-w-0 flex-[999_1_560px] px-6 py-7 sm:px-7">{children}</div>
      </div>
    </div>
  );
}
