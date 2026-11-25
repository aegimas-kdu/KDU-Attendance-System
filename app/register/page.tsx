import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import {
  listAcademicLevels,
  listDepartments,
  listIntakeBatches,
} from "@/lib/data/academic";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create your student account" };

export default async function RegisterPage() {
  // A signed-out visitor reads these three lists. The policies in 0003 and
  // 0013 allow exactly that and nothing else — only rows still marked active.
  const [batches, levels, departments] = await Promise.all([
    listIntakeBatches(true),
    listAcademicLevels(true),
    listDepartments(true),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex min-h-16 flex-wrap items-center gap-6 bg-navy px-6 py-3 shadow-[inset_0_-3px_0_var(--color-brand)]">
        <Brand />
        <span className="flex-1" />
        <span className="text-sm text-brand-200">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-white">
            Sign in
          </Link>
        </span>
      </header>

      <main className="mx-auto w-full max-w-[720px] px-6 py-10 sm:px-7">
        <h1 className="mb-1.5 text-page-title font-bold tracking-tight">
          Create your student account
        </h1>
        <p className="mb-7 text-sm text-muted">
          Everything below appears on your academic record, so please check it
          carefully.
        </p>

        <RegisterForm
          batches={batches.map((b) => ({
            id: b.id,
            label: b.name,
            hint: `${b.semester} ${b.start_year}`,
          }))}
          levels={levels.map((l) => ({ id: l.id, label: l.name }))}
          departments={departments.map((d) => ({
            id: d.id,
            label: d.name,
          }))}
        />

        <div className="mt-6 rounded-card border border-line bg-[#fafbfc] p-5">
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.09em] text-faint">
            What happens next
          </p>
          <p className="text-sm text-muted">
            You can sign in straight away. Your courses, class schedule and section
            appear once the registry has enrolled you — usually within a working day. If
            they have not appeared after that, contact the registry office.
          </p>
        </div>
      </main>
    </div>
  );
}
