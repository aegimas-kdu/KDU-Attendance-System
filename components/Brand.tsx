import Image from "next/image";
import Link from "next/link";

/**
 * The header lockup: the crest plus the system name.
 *
 * The crest carries the identity, so the name beside it stays small —
 * see the design system board.
 */
export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 text-white no-underline">
      <Image
        src="/logo.jpg"
        alt="Kyungdong University Global"
        width={40}
        height={44}
        className="h-10 w-auto"
        priority
      />
      <span className="leading-tight">
        <span className="block text-base font-bold tracking-tight">KDU Global</span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-brand-200">
          Attendance System
        </span>
      </span>
    </Link>
  );
}
