"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface Props {
  /** The filter in force. The parent owns it so a page reset stays in step. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder: string;
  readonly label: string;
  readonly className?: string;
}

/** Long enough that a fast typist does not fire a request per keystroke. */
const DEBOUNCE_MS = 200;

/**
 * Narrow a long list to the people the reader is looking for. Typing is held
 * locally and handed up after a pause: the list behind it is a server page of
 * a thousand-strong field, and refetching per keystroke would make the box
 * feel slower than it is.
 */
export function FilterBox({ value, onChange, placeholder, label, className }: Props) {
  const [text, setText] = useState(value);

  // A reset from outside, such as changing division, has to reach the box.
  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2",
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
      />
      {text !== "" ? (
        <button
          type="button"
          onClick={() => {
            setText("");
            onChange("");
          }}
          aria-label="絞り込みを解除"
          className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
