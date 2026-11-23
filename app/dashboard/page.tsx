import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home" };

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  professor: "Professor",
  admin: "Administrator",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  // This read goes through Row Level Security. "Users can view own profile"
  // is what lets it succeed — there is no service role key anywhere here.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, email, role, admin_level, account_status")
    .eq("id", user.id)
    .single();

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/sign-in");
  }

  const role = profile?.role ?? "unknown";
  const roleLabel =
    profile?.admin_level === "super_admin"
      ? "Super administrator"
      : (ROLE_LABEL[role] ?? role);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex min-h-16 flex-wrap items-center gap-6 bg-navy px-6 shadow-[inset_0_-3px_0_var(--color-brand)]">
        <Brand href="/dashboard" />
        <span className="flex-1" />
        <span className="flex items-center gap-2.5 rounded-full bg-white/10 py-1 pl-1 pr-3 text-white">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs font-bold">
            {(profile?.full_name ?? "?")
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <span className="text-[13px] font-semibold leading-tight">
            {profile?.full_name ?? user.email}
            <span className="block text-[11.5px] font-normal text-brand-200">
              {roleLabel}
            </span>
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

      <main className="mx-auto w-full max-w-5xl flex-1 px-7 py-8">
        <h1 className="mb-1.5 text-page-title font-bold tracking-tight">
          Signed in
        </h1>
        <p className="mb-6 text-sm text-muted">
          Authentication and Row Level Security are both working. The rest of the
          portal gets built from here.
        </p>

        {error && (
          <p
            role="alert"
            className="mb-6 rounded-card border border-[#ebc2c6] bg-absent-bg px-4 py-3 text-sm text-absent-ink"
          >
            Your profile could not be read: {error.message}. If this says no rows
            were returned, the sign-up trigger did not create a profile for this
            account.
          </p>
        )}

        <div className="rounded-card border border-line bg-white shadow-sm">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-card font-semibold">Your account</h2>
          </div>
          <table className="w-full">
            <tbody>
              {[
                ["Name", profile?.full_name],
                ["Email", profile?.email],
                ["Role", roleLabel],
                ["Status", profile?.account_status],
              ].map(([label, value], i, all) => (
                <tr
                  key={label as string}
                  className={i < all.length - 1 ? "border-b border-line" : ""}
                >
                  <td className="w-40 px-5 py-3 text-sm text-muted">{label}</td>
                  <td className="px-5 py-3 text-sm font-medium">
                    {value ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 rounded-card border border-line bg-[#fafbfc] p-5">
          <h2 className="mb-2 text-card font-semibold">Next</h2>
          <p className="text-sm text-muted">
            Build the administrator screens first — students and staff, then the
            action that turns an account into a professor. Nothing else can be set
            up until professors exist.
          </p>
        </div>
      </main>
    </div>
  );
}
