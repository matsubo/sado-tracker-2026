"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AthleteSummaryDto } from "@/lib/api/contract";

interface Props {
  readonly onAdd: (bib: string) => void;
  readonly isAdded: (bib: string) => boolean;
}

/** Find an athlete by bib or name and add them to this browser's friend list. */
export function SearchBox({ onAdd, isAdded }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AthleteSummaryDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const search = async (): Promise<void> => {
    const term = query.trim();
    if (term === "") return;
    setSearching(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/athletes?q=${encodeURIComponent(term)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { athletes: AthleteSummaryDto[] };
      setResults(body.athletes);
      if (body.athletes.length === 0) setMessage("見つかりませんでした。ゼッケン番号か名前で探せます。");
    } catch {
      setMessage("検索できませんでした。少し待って試してください。");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
        className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ゼッケン番号か名前で友達を追加"
          aria-label="ゼッケン番号か名前で友達を検索"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="sm" disabled={searching}>
          {searching ? "検索中" : "追加"}
        </Button>
      </form>

      {message ? <p className="mt-2 text-[12px] text-muted-foreground">{message}</p> : null}

      {results.length > 0 ? (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {results.map((athlete) => (
            <li key={athlete.bib} className="flex items-center gap-2 bg-card px-3 py-2">
              <span className="font-semibold text-[13px] text-muted-foreground tabular-nums">
                #{athlete.bib}
              </span>
              <span className="truncate font-bold text-[13.5px]">{athlete.name}</span>
              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                {athlete.division} · {athlete.ageGroupLabel ?? "リレー"}
              </span>
              <Button
                size="sm"
                variant={isAdded(athlete.bib) ? "secondary" : "default"}
                disabled={isAdded(athlete.bib)}
                onClick={() => {
                  onAdd(athlete.bib);
                  setResults([]);
                  setQuery("");
                }}
              >
                {isAdded(athlete.bib) ? "登録済み" : "追加"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
