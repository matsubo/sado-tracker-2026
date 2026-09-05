import type * as React from "react";
import { cn } from "@/lib/utils/cn";

type CellAlign = "left" | "right";

type TableProps = React.ComponentProps<"table"> & {
  /** Class names for the scroll container that wraps the table. */
  wrapperClassName?: string;
};

/**
 * Data table.
 *
 * Race tables are wider than a phone, so the table always lives inside a
 * horizontally scrollable wrapper: the overflow scrolls the table instead of
 * stretching the page.
 */
function Table({ className, wrapperClassName, ...props }: TableProps) {
  return (
    <div className={cn("w-full overflow-x-auto", wrapperClassName)}>
      <table className={cn("w-full border-collapse text-xs tabular-nums", className)} {...props} />
    </div>
  );
}

/** Table head. */
function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("text-muted-foreground", className)} {...props} />;
}

/** Table body. */
function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={className} {...props} />;
}

/** Table row. */
function TR({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("border-border border-b last:border-b-0", className)} {...props} />;
}

type THProps = Omit<React.ComponentProps<"th">, "align"> & { align?: CellAlign };

/** Header cell. Numeric by default; pass `align="left"` for label columns. */
function TH({ className, align = "right", scope = "col", ...props }: THProps) {
  return (
    <th
      scope={scope}
      className={cn(
        "whitespace-nowrap border-border border-b px-1.5 py-1 font-medium text-[10.5px] tabular-nums",
        align === "left" ? "text-left" : "text-right",
        className,
      )}
      {...props}
    />
  );
}

type TDProps = Omit<React.ComponentProps<"td">, "align"> & { align?: CellAlign };

/** Body cell. Numeric by default; pass `align="left"` for the name column. */
function TD({ className, align = "right", ...props }: TDProps) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-1.5 py-1.5 text-[11.5px] tabular-nums",
        align === "left" ? "text-left" : "text-right",
        className,
      )}
      {...props}
    />
  );
}

export type { CellAlign, TableProps, TDProps, THProps };
export { Table, TBody, TD, TH, THead, TR };
