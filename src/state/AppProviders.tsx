"use client";

import type { ReactNode } from "react";
import { BookmarksProvider } from "./BookmarksProvider";
import { LiveClockProvider } from "./LiveClockProvider";
import { RaceProvider } from "./RaceProvider";

/** The shared state every page reads, mounted once in the root layout. */
export function AppProviders({ children }: { readonly children: ReactNode }) {
  return (
    <RaceProvider>
      <LiveClockProvider>
        <BookmarksProvider>{children}</BookmarksProvider>
      </LiveClockProvider>
    </RaceProvider>
  );
}
