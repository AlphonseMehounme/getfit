import Link from 'next/link';

// A secondary call to action for the Progress empty states (≥ 48 px, AGENTS §9).
export function ActionLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="border-control hover:bg-surface focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center justify-center border px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
    </Link>
  );
}
