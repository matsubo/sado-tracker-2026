"use client";

import { useContext } from "react";
import { type Bookmarks, BookmarksContext } from "@/state/BookmarksProvider";

/** The app's one bookmark list; see BookmarksProvider. */
export function useBookmarks(): Bookmarks {
  const value = useContext(BookmarksContext);
  if (value === null) throw new Error("useBookmarks must be used within BookmarksProvider");
  return value;
}
