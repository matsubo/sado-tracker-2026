import type { ReactNode } from "react";

/**
 * The shape of a page that is read rather than watched: help, and the two
 * legal pages. They are the same document, so they are set the same way,
 * and the three pieces below live here rather than in any one of them.
 */

/** A titled block. The gap above it is what separates one from the next. */
export function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="px-4 pt-5">
      <h2 className="font-bold text-[15px]">{title}</h2>
      <div className="mt-1.5 flex flex-col gap-2 text-[12.5px] text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

/**
 * A question in the reader's words, with its answer under it. Help is written
 * as questions; the legal pages use it for the clauses a reader actually
 * arrives wanting an answer to.
 */
export function Question({ q, children }: { readonly q: string; readonly children: ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-[12.5px] text-foreground">{q}</p>
      <div className="mt-0.5 flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

/** A link that leaves the site, marked as one so the arrow is never a surprise. */
export function External({ href, children }: { readonly href: string; readonly children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded font-semibold text-primary underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children} ↗
    </a>
  );
}
