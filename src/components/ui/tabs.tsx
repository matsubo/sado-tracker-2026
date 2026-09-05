"use client";

import { type KeyboardEvent, useRef } from "react";
import { cn } from "@/lib/utils/cn";

type TabItem = { value: string; label: string };

type TabsVariant = "segmented" | "pill";

type TabsProps = {
  items: readonly TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  variant?: TabsVariant;
  className?: string;
  "aria-label"?: string;
};

const LIST_STYLES: Record<TabsVariant, string> = {
  segmented: "flex gap-[3px] rounded-lg bg-muted p-[3px]",
  pill: "flex gap-1.5",
};

const TAB_STYLES: Record<TabsVariant, string> = {
  segmented:
    "flex-1 rounded-md px-2 py-2 font-bold text-[13px] text-muted-foreground transition-colors",
  pill: "flex-1 rounded-lg border border-border px-2 py-1.5 font-bold text-[12px] text-muted-foreground transition-colors",
};

const ACTIVE_STYLES: Record<TabsVariant, string> = {
  segmented: "bg-card text-foreground shadow-sm",
  pill: "border-foreground bg-foreground text-background",
};

/** Moves an index by `delta`, wrapping around the ends of the list. */
const wrap = (index: number, delta: number, length: number): number =>
  (index + delta + length) % length;

/**
 * Controlled tab bar with no external dependencies.
 *
 * Selection follows focus, which is the expected behaviour for tabs that swap
 * an already-loaded view. A roving tabindex keeps the whole bar a single tab
 * stop and the arrow keys move between tabs.
 */
export function Tabs({
  items,
  value,
  onValueChange,
  variant = "segmented",
  className,
  "aria-label": ariaLabel,
}: TabsProps) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const selectedIndex = items.findIndex((item) => item.value === value);

  const select = (index: number): void => {
    const next = items[index];
    if (!next) return;
    onValueChange(next.value);
    buttons.current.get(next.value)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const last = items.length - 1;
    if (last < 0) return;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        select(wrap(index, 1, items.length));
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        select(wrap(index, -1, items.length));
        break;
      case "Home":
        event.preventDefault();
        select(0);
        break;
      case "End":
        event.preventDefault();
        select(last);
        break;
      default:
        break;
    }
  };

  return (
    <div role="tablist" aria-label={ariaLabel} className={cn(LIST_STYLES[variant], className)}>
      {items.map((item, index) => {
        const selected = item.value === value;
        // Keep the bar reachable by keyboard even when `value` matches no tab.
        const focusable = selected || (selectedIndex === -1 && index === 0);
        return (
          <button
            key={item.value}
            ref={(node) => {
              if (node) buttons.current.set(item.value, node);
              else buttons.current.delete(item.value);
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={focusable ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              TAB_STYLES[variant],
              "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              selected && ACTIVE_STYLES[variant],
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export type { TabItem, TabsProps, TabsVariant };
