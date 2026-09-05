import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Button styles in the "new-york" shadcn shape.
 *
 * The default variant paints the AI TRI+ brand gradient. Its label uses
 * `text-foreground` on purpose: in light mode the gradient is pale cyan/lime
 * and `--foreground` is near-black, in dark mode the gradient is deep
 * teal/olive and `--foreground` is near-white, so the pair stays readable in
 * both themes without a hardcoded palette colour.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md",
    "font-semibold transition-colors outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-brand-gradient text-foreground dark:bg-brand-gradient-dark hover:opacity-90 font-bold",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-border bg-card text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        link: "text-primary underline-offset-4 hover:underline",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        sm: "h-8 rounded-md px-3 text-xs",
        default: "h-9 px-4 text-sm",
        lg: "h-10 rounded-md px-6 text-sm",
        icon: "size-9 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

/** Themed button. Defaults to `type="button"` so it never submits by accident. */
function Button({ className, variant, size, type, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      type={type ?? "button"}
      {...props}
    />
  );
}

export type { ButtonProps };
export { Button, buttonVariants };
