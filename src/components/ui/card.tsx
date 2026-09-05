import type * as React from "react";
import { cn } from "@/lib/utils/cn";

/** Bordered surface used for every panel on the tracker. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Top row of a card: title on the left, optional actions on the right. */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1 px-4 pt-3 pb-2 [&:has(+*)]:pb-1", className)}
      {...props}
    />
  );
}

/** Card heading. Renders a `div` so the caller picks the document outline. */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("font-bold text-sm leading-none", className)} {...props} />;
}

/** Muted one-liner under the card title. */
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-muted-foreground text-xs", className)} {...props} />;
}

/** Main body of a card. */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-4 pb-3", className)} {...props} />;
}

/** Bottom row of a card, separated from the body by a hairline. */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 border-border border-t px-4 py-2", className)}
      {...props}
    />
  );
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
