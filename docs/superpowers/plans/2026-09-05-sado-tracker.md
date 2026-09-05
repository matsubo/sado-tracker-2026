# Sado Tracker 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A mobile-first live tracker that turns the official Sado Triathlon CSV feed into per-athlete ranks, position estimates and finish predictions for about 3,000 supporters.

**Architecture:** One Next.js container. A 60-second in-process poller downloads one CSV holding every athlete, normalizes it, and computes a full snapshot with pure functions. Pages poll a tiny endpoint and refetch on change; estimated positions animate client-side.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, React 19, Tailwind v4, shadcn/ui (new-york), lucide-react, Apache ECharts, Vitest, Playwright, Bun (package manager), Node 24 (runtime), Biome.

**Spec:** `docs/superpowers/specs/2026-09-05-sado-tracker-design.md` — read it first; this plan implements it and does not repeat its rules.

## Global Constraints

- Public repository: all code comments, commit messages, identifiers and docs in English. UI copy is Japanese.
- Never commit real athlete CSVs. Fixtures use synthesized names. Real data lives in `.data/` (git-ignored) and `/app/data` in production.
- No mutation: every compute function returns new objects. No `console.log` in `src/`; use `src/lib/runtime/logger.ts`.
- Files under 400 lines. Functions under 50 lines.
- All compute functions are pure: `(input, config, nowMs) => output`. No `Date.now()`, no I/O inside `src/lib/compute`.
- All times are integer epoch milliseconds internally. Formatting happens only in `src/lib/format`.
- Timezone is fixed to `Asia/Tokyo` in every `Intl` call.
- Colors come from ai-tri semantic tokens. Never write `bg-gray-*`, `text-slate-*` etc.
- Every API response carries HAL `_links` with at least `self`.
- Every task ends green: `bun run typecheck && bun run lint && bun test`.

---

## File Structure

```
src/config/races/{2022,2023,2024,2025,2026}.ts   per-year config: csv url, wave starts, courses, normalization aliases
src/config/races/index.ts                        registry + getRaceConfig(year)
src/config/types.ts                              RaceConfig, DivisionCourse, CheckpointDef

src/lib/domain/types.ts                          Athlete, Division, Discipline, Rank, Status, RaceSnapshot
src/lib/csv/fetch.ts                             fetchCsv(url) -> Buffer, with timeout + retry
src/lib/csv/decode.ts                            decodeCp932(buffer) -> string
src/lib/csv/parse.ts                             parseCsv(text) -> string[][]
src/lib/csv/headers.ts                           mapHeaders(header[], config) -> ColumnMap (merges ms columns)
src/lib/csv/normalize.ts                         toSnapshot(rows, map, config) -> RaceSnapshot

src/lib/compute/elapsed.ts                       elapsedAt, splitBetween, disciplineTime
src/lib/compute/status.ts                        athleteStatus (finished/dnf/not_started/dns_suspected/racing)
src/lib/compute/population.ts                    populations by division/sex/agegroup/checkpoint
src/lib/compute/ranking.ts                       rankBy (competition ranking), disciplineRanks, cumulativeRanks, splitRanks
src/lib/compute/deviation.ts                     deviationScore
src/lib/compute/position.ts                      estimatePosition, fieldOrder
src/lib/compute/prediction.ts                    predictFinish + explanation payload
src/lib/compute/events.ts                        derivePassEvents
src/lib/compute/snapshot.ts                      computeSnapshot: RaceSnapshot -> ComputedSnapshot

src/lib/history/load.ts                          loadHistory(years) -> HistorySnapshot[]
src/lib/history/nameIndex.ts                     buildNameIndex, findPastResults
src/lib/history/model.ts                         buildNeighbourModel, findNeighbours
src/lib/history/backtest.ts                      runBacktest -> accuracy per division/checkpoint

src/lib/weather/openMeteo.ts                     forecast client
src/lib/weather/amedas.ts                        JMA observation client
src/lib/weather/types.ts

src/lib/runtime/clock.ts                         Clock interface, systemClock, replayClock
src/lib/runtime/logger.ts
src/lib/runtime/store.ts                         in-memory snapshot store + disk persistence
src/lib/runtime/poller.ts                        startPollers()
src/lib/format/{duration,pace,clock,rank,diff}.ts

src/app/api/race/route.ts
src/app/api/athletes/route.ts
src/app/api/athletes/[bib]/route.ts
src/app/api/divisions/[div]/rankings/route.ts
src/app/api/map/route.ts
src/app/api/weather/route.ts
src/app/{layout,page}.tsx
src/app/athletes/[bib]/page.tsx
src/app/divisions/[div]/page.tsx
src/app/map/page.tsx
src/components/ui/*                              shadcn primitives copied from ai-tri
src/components/tracker/*                         AthleteCard, PositionBar, RankChips, PredictionBox,
                                                 NotificationBell, NotificationPanel, RankChart,
                                                 CoursePositionChart, FieldMap, SplitTable, WeatherPanel,
                                                 SearchBox, Footer, RefreshIndicator
src/hooks/{useSnapshot,useBookmarks,useNotifications,useLivePosition}.ts

tests/unit/**  tests/integration/**  tests/e2e/**  tests/fixtures/**
scripts/{fetch-history,make-fixtures,verify-ranking}.ts
```

---

## Task 1: Project scaffold

**Files:** Create `package.json`, `tsconfig.json`, `next.config.ts`, `biome.json`, `postcss.config.mjs`, `tailwind.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `justfile`, `.gitignore`, `Dockerfile`, `.dockerignore`, `src/app/layout.tsx`, `src/app/globals.css`, `src/lib/runtime/logger.ts`.

**Produces:** working `bun run dev`, `bun test`, `bun run typecheck`, `bun run lint`.

- [ ] Copy `tailwind.config.ts` and `app/globals.css` token blocks verbatim from `/Volumes/nvme/matsu/ghq/github.com/matsubo/ai-tri` (`:root` and `.dark` oklch blocks, `fontFamily`, `colors.brand`, `.swim/.bike/.run/.transit`). Keep only what this app uses; do not invent new colors.
- [ ] `next.config.ts` sets `output: "standalone"`.
- [ ] `.gitignore` includes `.data/`, `node_modules`, `.next`, `test-results`, `playwright-report`.
- [ ] `src/lib/runtime/logger.ts` exports `logger.info/warn/error(msg, fields?)` writing single-line JSON to stderr, plus `logOnce(key, msg)` backed by a `Set`.
- [ ] `justfile` targets: `dev` (tmux), `test`, `test-watch`, `e2e`, `lint`, `typecheck`, `fetch-history`, `make-fixtures`, `verify-ranking`, `build`.
- [ ] Verify `bun run typecheck && bun run lint && bun test` all succeed (zero tests is fine).
- [ ] Commit: `chore: scaffold Next.js app with ai-tri design tokens`

---

## Task 2: Race config and normalization tables

**Files:** Create `src/config/types.ts`, `src/config/races/{2022,2023,2024,2025,2026}.ts`, `src/config/races/index.ts`. Test: `tests/unit/config.test.ts`.

**Produces:**
```ts
export type Division = "A" | "B" | "RA" | "RB";
export type Discipline = "swim" | "bike" | "run";
export interface CheckpointDef {
  id: string; label: string; csvHeaders: string[];
  discipline: Discipline | "transition"; km: number; inferred?: boolean;
}
export interface DivisionCourse {
  swimKm: number; bikeKm: number; runKm: number;
  waveStart: string;           // "06:00" JST
  swimCutoffMin: number;       // A 150, B 100
  swimTimesComparable: boolean;// false for 2025 B
  checkpoints: CheckpointDef[];// ordered, starts with the start checkpoint
}
export interface RaceConfig {
  year: number; csvUrl: string; raceDate: string;   // "2026-09-06"
  divisions: Record<Division, DivisionCourse>;
  divisionAliases: Record<string, Division | null>; // "Aタイプ"->"A", "予備"->null
  ageGroupPattern: RegExp[];                        // year-specific label parsers
  nameHeaders: string[];                            // ["名前","氏名"]
  usableForPrediction: boolean;                     // false for 2022
}
export function getRaceConfig(year: number): RaceConfig;
export function normalizeDivision(raw: string, c: RaceConfig): Division | null;
export function normalizeAgeGroup(raw: string): string | null;  // -> "M40-44" | "F24-" | null
```

- [ ] Write `tests/unit/config.test.ts` covering: `normalizeDivision` maps `Aタイプ`/`Ａタイプ`/`ATYPE`→`A`, `RBタイプ`→`RB`, `予備`→`null`, `チャンピオンシップ`→`A`, `""`→`null`; `normalizeAgeGroup` maps `40-44男子`→`M40-44`, `40-44歳男子`→`M40-44`, `M40-44`→`M40-44`, `24歳以下女子`→`F24-`, `80-84男子`→`M80-84`, `""`→`null`.
- [ ] Run it, watch it fail.
- [ ] Implement config types and the five year files. Swim distance is per year and per division: A 4.0 km always; B 2.0 km except 2025, which is **1.35 km** (shortened that year). Bike/run: A 190/42.2, B 108/21.1 in every year.
- [ ] Add a config test asserting `getRaceConfig(2025).divisions.B.swimKm === 1.35` and `getRaceConfig(2026).divisions.B.swimKm === 2.0`. 2026 checkpoints, in order with km: `start`(0), `swimL`(2.0, A only), `swimF`(4.0 A / 2.0 B), `bikeS`(0), `sumiyoshi`(100 A inferred / 18 B inferred), `runS`(190 A / 108 B), `run4`(4) … `run39`(39, A only), `finish`(42.2 A / 21.1 B). Every checkpoint lists both `（本部）` and `(本部)` header spellings.
- [ ] Run tests until green.
- [ ] Commit: `feat: add per-year race configuration and label normalization`

---

## Task 3: CSV pipeline

**Files:** Create `src/lib/domain/types.ts`, `src/lib/csv/{fetch,decode,parse,headers,normalize}.ts`. Test: `tests/unit/csv.test.ts`. Fixture: `tests/fixtures/sample-2026.csv` (Shift_JIS, 12 synthesized rows covering every case below).

**Consumes:** Task 2 config. **Produces:**
```ts
export interface Athlete {
  bib: string; name: string; nameKey: string;
  sex: "M" | "F" | null; division: Division; ageGroup: string | null;
  startAt: number; passes: Record<string, number>;
  officialTotal: string | null; remark: string;
}
export interface RaceSnapshot { year: number; fetchedAt: number; athletes: Athlete[] }
export function toSnapshot(rows: string[][], config: RaceConfig, fetchedAt: number): RaceSnapshot;
export function decodeCp932(buf: ArrayBuffer): string;
export async function fetchCsv(url: string, timeoutMs?: number): Promise<ArrayBuffer>;
```

- [ ] Write `tests/unit/csv.test.ts` asserting, against the fixture: 12 athletes parsed; `予備` and empty-division rows dropped; a row with empty `START` gets the wave start from config; `passes.swimF` equals the timestamp plus its `ms` column as milliseconds; `nameKey` turns `岩渕　努` into `岩渕 努`; relay rows have `sex: null, ageGroup: null`; duplicate bib throws; unknown header is ignored without throwing; `受付`/`競技説明会`/`入水` are stored separately in `preRacePasses`, not in `passes`.
- [ ] Run it, watch it fail.
- [ ] Implement decode (`TextDecoder("shift_jis")`), a quote-aware CSV parser, `mapHeaders` (walks the header row, pairs each timing column with the following `ms` column, resolves aliases from config), and `toSnapshot`.
- [ ] `fetchCsv`: `AbortSignal.timeout(20000)`, one retry after 2 s, throws a typed `CsvFetchError`.
- [ ] Run tests until green.
- [ ] Commit: `feat: parse the Shift_JIS result CSV into a normalized snapshot`

---

## Task 4: Elapsed, status, populations

**Files:** Create `src/lib/compute/{elapsed,status,population}.ts`. Test: `tests/unit/compute-basics.test.ts`.

**Produces:**
```ts
export function elapsedAt(a: Athlete, cp: string): number | null;
export function splitBetween(a: Athlete, from: string, to: string): number | null;
export function disciplineTime(a: Athlete, d: Discipline, course: DivisionCourse): number | null;
export function latestCheckpoint(a: Athlete, course: DivisionCourse): string | null;
export type Status = "finished" | "dnf" | "not_started" | "dns_suspected" | "racing";
export function athleteStatus(a: Athlete, course: DivisionCourse, nowMs: number): Status;
export interface Populations { byCheckpoint: Map<string, Athlete[]>; }
export function buildPopulations(athletes: Athlete[], course: DivisionCourse, nowMs: number): Populations;
```

- [ ] Write tests: `disciplineTime` swim = `swimF - start`, bike = `runS - bikeS`, run = `finish - runS`, `null` when either end missing; `athleteStatus` returns `finished` with a finish time even when the remark says DNF; `dnf` for `DNF/本部(20:24)`; `not_started` before the wave start; `dns_suspected` for no water-entry, no swim split, no bike start, 151 min after an A start; `racing` for the same athlete at 149 min; `racing` for an athlete with water entry but no swim split at 200 min; populations exclude `not_started` and `dns_suspected` but include `dnf` athletes at checkpoints they reached.
- [ ] Run, watch fail, implement, run until green.
- [ ] Commit: `feat: compute elapsed times, athlete status and checkpoint populations`

---

## Task 5: Ranking and deviation

**Files:** Create `src/lib/compute/{ranking,deviation}.ts`. Test: `tests/unit/ranking.test.ts`.

**Produces:**
```ts
export interface Rank { rank: number; of: number }
export function rankBy<T>(items: T[], value: (t: T) => number, target: T): Rank | null;
export interface RankSet { division: Rank | null; sex: Rank | null; ageGroup: Rank | null }
export function ranksAtCheckpoint(a: Athlete, cp: string, pop: Populations): RankSet;
export function disciplineRanks(a, d, pop, course): { rank: RankSet; provisional: boolean; atCheckpoint: string | null };
export function deviationScore(values: number[], own: number): number | null; // null when n<5 or sd===0
```

- [ ] Write tests: competition ranking gives `[1,2,2,4]` for values `[10,20,20,30]`; `of` equals the population size; an athlete missing the checkpoint returns `null`; relay athlete gets `division` rank but `null` sex and age ranks; `disciplineRanks` for an athlete mid-bike returns `provisional: true` and `atCheckpoint: "sumiyoshi"` ranked among athletes with `sumiyoshi`; `deviationScore` returns 60 for a value one sd faster than the mean, `null` for 4 values, `null` when all values are equal.
- [ ] Run, watch fail, implement, run until green.
- [ ] Commit: `feat: add competition ranking and deviation scores`

---

## Task 6: Position estimate and field order

**Files:** Create `src/lib/compute/position.ts`. Test: `tests/unit/position.test.ts`.

**Produces:**
```ts
export interface PositionEstimate {
  discipline: Discipline; lastCheckpoint: string | null;
  lastKm: number; lastAt: number; speedKmh: number; capKm: number;
  estKm: number; waiting: boolean; source: "own" | "live-median" | "history-median";
}
export function estimatePosition(a, course, pop, nowMs, history?): PositionEstimate;
export function fieldOrder(athletes: Athlete[], course: DivisionCourse, nowMs: number): string[]; // bibs, leader first
```

- [ ] Write tests: an athlete 30 min past `sumiyoshi` at 32 km/h sits at `100 + 16 = 116` km with `waiting: false`; the same athlete 6 hours later is capped at `runS.km - 0.1` with `waiting: true`; an athlete with no own bike speed falls back to the live median and reports `source: "live-median"`; between `swimF` and `bikeS` the estimate is bike km 0 in transition; a finished athlete sits at the finish km; `fieldOrder` puts a `runS` athlete ahead of a `sumiyoshi` athlete regardless of elapsed, and orders two `sumiyoshi` athletes by elapsed ascending; excludes `dns_suspected` and `not_started`.
- [ ] Run, watch fail, implement, run until green.
- [ ] Commit: `feat: estimate course position and compute field order`

---

## Task 7: History loading, name index, past results

**Files:** Create `src/lib/history/{load,nameIndex}.ts`, `scripts/fetch-history.ts`, `scripts/make-fixtures.ts`. Test: `tests/unit/history.test.ts`.

**Produces:**
```ts
export interface PastResult { year: number; division: Division; totalMs: number; totalText: string; divisionRank: Rank; ageRank: Rank | null }
export function buildNameIndex(snapshots: {year:number; snapshot: RaceSnapshot; config: RaceConfig}[]): Map<string, PastResult[]>;
export function findPastResults(index: Map<string, PastResult[]>, nameKey: string): PastResult[];
export async function loadHistory(years: number[], dir: string): Promise<...>;  // reads dir, fetches only when missing
```

- [ ] `scripts/fetch-history.ts` downloads 2022–2025 CSVs into `.data/history/<year>.csv`; `scripts/make-fixtures.ts` reads them and writes `tests/fixtures/history-<year>.csv` with names replaced by generated Japanese names and bibs shuffled, preserving all timestamps.
- [ ] Write tests over the fixtures: a name present in three years returns three `PastResult`s ordered newest first; full-width and half-width spellings of the same name collide into one key; two different athletes sharing a name return two entries for the same year; `totalText` matches the CSV column.
- [ ] Run, watch fail, implement, run until green.
- [ ] Commit: `feat: load past races and match athletes by name`

---

## Task 8: Finish prediction and backtest

**Files:** Create `src/lib/history/{model,backtest}.ts`, `src/lib/compute/prediction.ts`. Test: `tests/unit/prediction.test.ts`.

**Produces:**
```ts
export interface Prediction {
  method: "neighbours" | "extrapolation";
  atCheckpoint: string; finishAt: number; totalMs: number;
  rangeLow: number; rangeHigh: number;
  explanation: {
    neighbourCount: number; yearBreakdown: Record<number, number>;
    remainingP25: number; remainingMedian: number; remainingP75: number;
    ownSpeedKmh: number | null; neighbourSpeedKmh: number | null;
    extrapolationMs: number; backtestMedianErrorMs: number | null;
    backtestWithin25minPct: number | null; note: string;
  };
}
export function predictFinish(a, course, pop, model, nowMs): Prediction | null;
export function runBacktest(model, holdoutYear): Map<string, {medianErrorMs:number; within25Pct:number}>;
```

- [ ] Write tests using fixture history: a mid-bike A athlete gets `method: "neighbours"` with `neighbourCount === 20` and `rangeLow < totalMs < rangeHigh`; a B athlete's feature vector omits swim (assert the model is built without a swim dimension for B, even though 2025 B now has a known 1.35 km distance); an athlete before `swimF` gets `method: "extrapolation"`; a not-started athlete returns `null`; the backtest over the fixtures returns finite `medianErrorMs` for A at `sumiyoshi`; predictions are monotonic in the sense that a faster athlete at the same checkpoint never gets a later prediction.
- [ ] Run, watch fail, implement, run until green.
- [ ] Commit: `feat: predict finish times from past races with an explanation payload`

---

## Task 9: Snapshot assembly, events, runtime, verification

**Files:** Create `src/lib/compute/{snapshot,events}.ts`, `src/lib/runtime/{clock,store,poller}.ts`, `src/instrumentation.ts`, `src/lib/format/*.ts`. Test: `tests/unit/{snapshot,events,format}.test.ts`, `tests/integration/reference.test.ts`.

**Produces:**
```ts
export interface ComputedAthlete { athlete: Athlete; status: Status; disciplines: ...; ranks: ...; position: PositionEstimate; prediction: Prediction | null; splits: Split[]; rankHistory: {cp:string; ranks:RankSet}[] }
export interface ComputedSnapshot { year:number; fetchedAt:number; stale:boolean; athletes: Map<string, ComputedAthlete>; fieldOrder: Record<Division,string[]>; counts: Record<Division,Record<string,number>> }
export function computeSnapshot(s: RaceSnapshot, config: RaceConfig, model, nameIndex, nowMs): ComputedSnapshot;
export interface Clock { now(): number }
export function getSnapshot(): ComputedSnapshot | null;
export function startPollers(): void;
export function formatDuration(ms: number): string;  // "4:12:34"
```

- [ ] Write `tests/integration/reference.test.ts`: **for every fixture row from 2023–2025 that has `総合記録`, `formatDuration(finish - start)` must equal that column.** This test decides truncate vs round; make it pass by matching the source, then freeze the behaviour with a comment.
- [ ] Add a second reference test: parse `tests/fixtures/summary-2025.html` (saved copy of `systemway.jp/25sado/summary`) and assert our per-division per-checkpoint population sizes equal the 通過 counts.
- [ ] Write `tests/unit/events.test.ts`: `derivePassEvents(prev, next, bibs)` returns one event per newly appeared checkpoint; returns nothing when nothing changed; returns an event for a checkpoint that appears late with an older timestamp than an already-seen one.
- [ ] Write format tests for every row of the spec's formatting table.
- [ ] Implement, including `replayClock(startIso, speed)` and the poller writing `/app/data/snapshot.json`. `computeSnapshot` must complete for 1,900 athletes in under 2 s; add a timing assertion at 5 s.
- [ ] Run all tests until green.
- [ ] Commit: `feat: assemble computed snapshots and verify totals against the source`

---

## Task 10: API routes

**Files:** Create `src/app/api/{race,athletes,athletes/[bib],divisions/[div]/rankings,map,weather}/route.ts`, `src/lib/api/hal.ts`, `src/lib/weather/*`. Test: `tests/integration/api.test.ts`.

- [ ] Write tests: `/api/race` returns `year`, `fetchedAt`, `counts` and `_links.self`; `/api/athletes?q=` matches by bib prefix and by name substring, capped at 50; `/api/athletes/{bib}` returns prediction explanation fields and `_links.aiTri` pointing at `https://ai-triathlon-result.teraren.com/athletes/<name with ASCII space, URL-encoded>`; unknown bib gives 404; `/api/divisions/A/rankings?discipline=swim&page=2` returns 50 rows and a `Link` header with `next`, `prev`, `first`, `last`; `/api/divisions/X/rankings` gives 404; invalid `page=abc` gives 400; race responses carry `Cache-Control: no-cache`.
- [ ] Validate every query parameter with zod.
- [ ] Implement weather clients with a 5-minute in-memory cache and graceful failure (`{ available: false }`).
- [ ] Run until green. Commit: `feat: add HAL API for race, athletes, rankings, map and weather`

---

## Task 11: Home page, cards, notifications, weather

**Files:** Create `src/app/page.tsx`, `src/components/tracker/{AthleteCard,PositionBar,RankChips,PredictionBox,SearchBox,NotificationBell,NotificationPanel,WeatherPanel,RefreshIndicator,Footer}.tsx`, `src/hooks/{useSnapshot,useBookmarks,useNotifications,useLivePosition}.ts`. Test: `tests/unit/hooks.test.ts`, `tests/e2e/home.spec.ts`.

Match the approved mock: https://claude.ai/code/artifact/5446f3e7-882a-4a2d-adb8-6da167f2f8c4

- [ ] `useSnapshot` polls `/api/race` every 15 s, refetches data with `?v=<fetchedAt>` when it changes, and refetches immediately on `visibilitychange`. No page reload ever.
- [ ] `useBookmarks` stores bibs in `localStorage` under `sado2026.bookmarks`, syncs to `?bibs=` in the URL via `history.replaceState`, and reads `?bibs=` on first load.
- [ ] `useNotifications` keeps a `seen` set of `bib:checkpoint` in `localStorage`, derives unread events, updates `document.title` with `(n)`, and marks all seen when the panel opens.
- [ ] `useLivePosition` recomputes `estKm` every 10 s from `(lastKm, lastAt, speedKmh, capKm)` without hitting the server.
- [ ] Unit-test the three hooks with fake timers: unread count drops to zero after opening; a late-arriving pass still counts as unread; bookmarks survive a reload; live position never exceeds `capKm`.
- [ ] E2E in replay mode: add a friend by bib, see the card, advance the replay clock, assert the card's checkpoint text changes without a navigation, open the bell, assert the badge clears.
- [ ] `PredictionBox` keeps the explanation collapsed behind a `?` button with `aria-expanded`.
- [ ] Footer on every page: `Powered by AI TRI+` linking to `https://ai-triathlon-result.teraren.com/`.
- [ ] Commit: `feat: add the friend dashboard with in-page notifications`

---

## Task 12: Athlete detail page

**Files:** Create `src/app/athletes/[bib]/page.tsx`, `src/components/tracker/{RankChart,CoursePositionChart,SplitTable,PastResults,DisciplineTable}.tsx`. Test: `tests/e2e/athlete.spec.ts`.

- [ ] Sections in this order: header, position bar, current ranks, discipline table, prediction with `?`, course-position chart (five age-group neighbours ahead and behind by estimated position, live), rank-progression chart (division / sex / age, ECharts, Y inverted so rank 1 is on top), split table, past results, AI TRI+ link, footer.
- [ ] ECharts renders client-side only; chart text uses theme tokens.
- [ ] E2E: open a known bib in replay mode, assert the three chart series exist, toggle the `?` explanation, assert the neighbour dots move after advancing the clock.
- [ ] Commit: `feat: add the athlete detail page with rank and position charts`

---

## Task 13: Division rankings and field map

**Files:** Create `src/app/divisions/[div]/page.tsx`, `src/app/map/page.tsx`, `src/components/tracker/{RankingTable,FieldMap}.tsx`. Test: `tests/e2e/{division,map}.spec.ts`.

- [ ] Division page: division tabs, discipline tabs, age-group select, 50 rows per page, diff column relative to `?bib=` when present, banner when that athlete is not yet in the table.
- [ ] Map page: X is the course axis, Y is field order, views for division / age group / friends, dots colored by discipline, friends labelled, tap shows name plus both numbers.
- [ ] E2E: paginate, assert the highlighted row, switch views on the map, assert dot count changes.
- [ ] Commit: `feat: add division rankings and the whole-field map`

---

## Task 14: Deploy with 2025 data, then switch to 2026

**Files:** Modify `Dockerfile`, create `README.md`.

- [ ] Build the image locally and run it with `RACE_YEAR=2025` to confirm the finished 2025 race renders correct totals and ranks end to end.
- [ ] Run `just verify-ranking` against the live source for 2025 and record the result in the commit message.
- [ ] **Ask the user for permission before pushing.** Then push `create-enhanced-tracker`, open a PR, merge to `main`.
- [ ] Create the Coolify application on server `gmk` with domain `sado-tracker-2026.teraren.com`, volume `/app/data`, env `RACE_YEAR=2025`, `TZ=Asia/Tokyo`. Deploy and verify.
- [ ] Switch `RACE_YEAR=2026` and redeploy. Confirm the pre-race state renders (entrants listed, everyone `not_started`).
- [ ] Commit: `chore: add deployment configuration and README`
