import type * as React from "react";
import { cn } from "@/lib/utils/cn";

/** Pulsing placeholder shown while race data is loading. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-4 w-full animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
