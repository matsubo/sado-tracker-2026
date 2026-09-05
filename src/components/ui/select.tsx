"use client";

import { ChevronDown } from "lucide-react";
import type { ChangeEvent } from "react";
import { cn } from "@/lib/utils/cn";

type SelectOption = { value: string; label: string };

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  /** Required: the control carries no visible label in the dense mobile layout. */
  "aria-label": string;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Thin wrapper over a native `<select>`.
 *
 * Native is deliberate: on a phone it opens the platform picker, which is
 * faster and more accessible than any listbox we could build, and it keeps the
 * component free of popover dependencies.
 */
export function Select({
  value,
  onValueChange,
  options,
  "aria-label": ariaLabel,
  id,
  name,
  disabled,
  className,
}: SelectProps) {
  const onChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    onValueChange(event.target.value);
  };

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "w-full appearance-none rounded-lg border border-border bg-card py-1.5 pr-7 pl-2",
          "text-foreground text-xs outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground"
      />
    </div>
  );
}

export type { SelectOption, SelectProps };
