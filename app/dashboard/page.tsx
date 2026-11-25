import { redirect } from "next/navigation";
import { homeFor, requireViewer } from "@/lib/auth";

/**
 * Not a page — a junction.
 *
 * Sign-in and the proxy both send people here, and this sends them on to
 * whichever portal their role belongs to.
 */
export default async function DashboardPage() {
  const viewer = await requireViewer();
  redirect(homeFor(viewer));
}
