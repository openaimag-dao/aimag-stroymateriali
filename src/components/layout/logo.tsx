import Link from "next/link";

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="AIMAG Stroymateriali — на главную">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E1622" strokeWidth="2" strokeLinejoin="round">
          <rect x="3" y="13" width="8" height="8" />
          <rect x="13" y="13" width="8" height="8" />
          <rect x="8" y="3" width="8" height="8" />
        </svg>
      </span>
      <span className={`font-display text-[17px] font-bold tracking-tight ${dark ? "text-white" : "text-primary"}`}>
        AIMAG{" "}
        <span className={`font-medium ${dark ? "text-steel-300" : "text-muted-foreground"}`}>Stroymateriali</span>
      </span>
    </Link>
  );
}
