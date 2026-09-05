"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Shared with the pre-paint script in the root layout. */
const STORAGE_KEY = "sado2026.theme";

/** Persists the choice, ignoring storage that is full or blocked. */
const remember = (dark: boolean): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // Private mode or a blocked origin: the class still applies for this visit.
  }
};

/**
 * Light/dark switch.
 *
 * The real theme lives on `documentElement`, set before paint by the inline
 * script in the layout. This button only reads that class after mounting, so
 * the server and the first client render agree on a neutral icon.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = (): void => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    remember(next);
    setDark(next);
  };

  const icon = (): ReactElement => {
    if (dark === null) return <SunMoon aria-hidden="true" />;
    return dark ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />;
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label="テーマを切り替える"
      aria-pressed={dark ?? undefined}
      className={className}
    >
      {icon()}
    </Button>
  );
}
