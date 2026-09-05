"use client";

import { Check, Search, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useAthleteSearch } from "@/hooks/useAthleteSearch";
import type { AthleteSummaryDto } from "@/lib/api/contract";
import { cn } from "@/lib/utils/cn";

interface Props {
  readonly onAdd: (bib: string) => void;
  readonly isAdded: (bib: string) => boolean;
}

const STATUS_LABEL: Record<string, string> = {
  not_started: "スタート前",
  racing: "レース中",
  finished: "フィニッシュ",
  dnf: "リタイア",
  dns_suspected: "未計測",
};

/** Highlight the part of the name the reader has typed. */
function Highlighted({ text, query }: { readonly text: string; readonly query: string }) {
  const needle = query.trim().replace(/　/g, " ");
  const at = needle === "" ? -1 : text.replace(/　/g, " ").indexOf(needle);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-bold text-primary">
        {text.slice(at, at + needle.length)}
      </mark>
      {text.slice(at + needle.length)}
    </>
  );
}

/**
 * Find an athlete by bib or name. Suggestions appear as the reader types,
 * because a supporter usually knows a family name and nothing else, and
 * scanning a list of matches is the only way to tell two people apart.
 */
export function SearchBox({ onAdd, isAdded }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const { results, searching, error, settled } = useAthleteSearch(query);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => setActive(0), [results]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const choose = (athlete: AthleteSummaryDto): void => {
    if (isAdded(athlete.bib)) return;
    onAdd(athlete.bib);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (results.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => {
        const delta = event.key === "ArrowDown" ? 1 : -1;
        return (current + delta + results.length) % results.length;
      });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const athlete = results[active];
      if (athlete) choose(athlete);
    }
  };

  const showList = open && query.trim() !== "";

  return (
    <div ref={container} className="relative">
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-muted px-3 py-2",
          showList && results.length > 0 ? "border-primary" : "border-border",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && results[active] ? `${listId}-${results[active]?.bib}` : undefined
          }
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="ゼッケン番号か名前で友達を追加"
          aria-label="ゼッケン番号か名前で友達を検索"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
        {query !== "" ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="検索をやめる"
            className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {showList ? (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          {error ? <p className="px-3 py-3 text-[12.5px] text-muted-foreground">{error}</p> : null}

          {!error && results.length === 0 && settled && !searching ? (
            <p className="px-3 py-3 text-[12.5px] text-muted-foreground">
              「{query.trim()}」に一致する選手はいません。ゼッケン番号か名字で探せます。
            </p>
          ) : null}

          {!error && results.length === 0 && searching ? (
            <p className="px-3 py-3 text-[12.5px] text-muted-foreground">検索中…</p>
          ) : null}

          {results.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="検索結果"
              className="max-h-72 overflow-y-auto"
            >
              {results.map((athlete, index) => {
                const added = isAdded(athlete.bib);
                return (
                  <li key={athlete.bib}>
                    <button
                      type="button"
                      id={`${listId}-${athlete.bib}`}
                      role="option"
                      aria-selected={index === active}
                      disabled={added}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(athlete)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left",
                        index === active && !added && "bg-muted",
                        added && "opacity-60",
                      )}
                    >
                      <span className="w-11 shrink-0 font-semibold text-[12px] text-muted-foreground tabular-nums">
                        {athlete.bib}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-[13.5px]">
                          <Highlighted text={athlete.name} query={query} />
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {athlete.division} · {athlete.ageGroupLabel ?? "リレー"} ·{" "}
                          {STATUS_LABEL[athlete.status] ?? "レース中"}
                          {athlete.lastCheckpointLabel ? ` · ${athlete.lastCheckpointLabel}` : null}
                        </span>
                      </span>
                      {added ? (
                        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                          <Check className="h-3 w-3" aria-hidden />
                          登録済み
                        </span>
                      ) : (
                        <span className="shrink-0 font-bold text-[11.5px] text-primary">追加</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {results.length >= 50 ? (
            <p className="border-border border-t bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
              上位 50 件を表示しています。もう少し文字を足すと絞り込めます。
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
