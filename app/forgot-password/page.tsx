import type { Metadata } from "next";
import { Brand } from "@/components/Brand";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgotten your password?" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex min-h-16 flex-wrap items-center gap-6 bg-navy px-6 shadow-[inset_0_-3px_0_var(--color-brand)]">
        <Brand />
        <span className="flex-1" />
        <span className="text-sm text-brand-200">Kyungdong University Global</span>
      </header>

      <main className="grid flex-1 place-items-center px-7 py-14">
        <ForgotPasswordForm />
      </main>
    </div>
  );
}
