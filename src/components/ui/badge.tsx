import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Small status pill. The sport variants read the `--swim` / `--bike` / `--run`
 * custom properties directly so light and dark themes swap together with the
 * rest of the design tokens.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-bold text-[11px] leading-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-muted text-muted-foreground",
        outline: "border border-border text-muted-foreground",
        swim: "bg-[color:var(--swim-bg)] text-[color:var(--swim)]",
        bike: "bg-[color:var(--bike-bg)] text-[color:var(--bike)]",
        run: "bg-[color:var(--run-bg)] text-[color:var(--run)]",
        destructive: "bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

/** Status pill: discipline, race state or a counter. */
function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export type { BadgeProps };
export { Badge, badgeVariants };
