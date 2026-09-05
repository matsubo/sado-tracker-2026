# Sado Tracker 2026 — Design Spec

Date: 2026-09-05 · Status: approved by owner (chat), pending implementation
Issue: https://github.com/matsubo/sado-tracker-2026/issues/1
UI mock: https://claude.ai/code/artifact/5446f3e7-882a-4a2d-adb8-6da167f2f8c4

## 1. Goal

A public, mobile-first live tracker for supporters of athletes in the Sado
International Triathlon (race day 2026-09-06, A wave 06:00 JST, B wave 07:30 JST).
Expected audience is about 3,000 supporters. The official tracker
(`systemway.jp/26sado`) shows raw checkpoint times; this app answers
"where is my friend, how are they doing, and when will they finish".

Numbers are the product. Every displayed figure must be derived by a pure,
unit-tested function and cross-checked against the source where the source
offers a reference value (see §9).

## 2. Source data

### 2.1 Live CSV export (replaces page scraping)

`GET https://systemway.jp/26sado?dlcsv=t` returns one CSV with every athlete
in every division (about 1,900 rows, 270 KB before the race, 680 KB after).
The `di` filter and the per-year token in the page's form JS are ignored by
the server; `dlcsv=t` alone is sufficient. Past years use the same shape:
`22sado`, `23sado`, `24sado`, `25sado`. 2016–2019 return empty bodies;
2020–2021 do not exist.

Format facts (verified against downloaded files):

- Encoding: Shift_JIS (CP932). Decode before parsing.
- Header row present. Column count differs by year (2022: 41, 2023: 42,
  2024/2025: 46, 2026: 48). Parse by header name, never by index.
- Every checkpoint timestamp column is followed by an `ms` column holding the
  millisecond part (`038`). Merge them into one epoch-millisecond value.
- Timestamps are `YYYY/MM/DD HH:MM:SS` in JST with no zone marker.
- `START` is the wave start (06:00 or 07:30). It is the base for elapsed time.
- `総合記録` (`h:mm:ss`) is present from 2023 on. It is the reference value
  for our own FINISH − START computation (§9.1).
- `備考` carries `DNF/本部(20:24)`, `SWIM SKIP`, `手動受付（未受付）`, etc.
- Names use a full-width space between family and given name (`岩渕　努`).

Checkpoint layout 2023–2026 (identical): `受付`, (`競技説明会` 2026 only),
`入水`, `START`, `ｽｲﾑL`, `ｽｲﾑF`, `ﾊﾞｲｸS`, `住吉`, `ﾗﾝS（本部）`, `ﾗﾝ4km`,
`ﾗﾝ9km`, `ﾗﾝ10km`, `ﾗﾝ14km`, `ﾗﾝ19km`, `ﾗﾝ20km`, `ﾗﾝ24km`, `ﾗﾝ29km`,
`ﾗﾝ30km`, `ﾗﾝ34km`, `ﾗﾝ39km`, `FINISH`. 2022 differs (`水津AID`,
`ﾗﾝ3km(沢根)` …) and is used only for past-result lookup.

`受付`, `競技説明会`, `入水` are registration/briefing/water-entry, not race
checkpoints. They never enter ranking or position logic.

### 2.2 Per-year differences that must live in config

| Item | Values seen |
|------|-------------|
| Division label | `Aタイプ` / `Ａタイプ` / `ATYPE`; `RAタイプ` / `Ｒタイプ` / `RTYPE`; `チャンピオンシップ`; `予備` |
| Age-group label | `40-44男子` (2025), `40-44歳男子` (2026), `M40-44` / `F40-44` (2022–2023), `24歳以下男子`, `80-84女子` |
| Name column | `名前` (2024+), `氏名` (2022–2023) |
| Run-start column | `ﾗﾝS（本部）` vs `ﾗﾝS(本部)` |
| Swim distance | 2025 B swim shortened by an unknown amount (median 24.8 min vs 43–45 min); `swimKm: null` in config |
| 住吉 bike km | inferred from split ratios: A ≈ 100 km all years; B ≈ 21 km (2023–24), ≈ 18 km (2025) |

### 2.3 Course model (2026, per division)

- A / RA: swim 4.0 km (`ｽｲﾑL` = 2.0 km lap), bike 190 km (`住吉` ≈ 100 km,
  inferred), run 42.2 km with checkpoints at 4, 9, 10, 14, 19, 20, 24, 29,
  30, 34, 39 km.
- B / RB: swim 2.0 km (no `ｽｲﾑL`), bike 108 km (`住吉` ≈ 18 km, inferred),
  run 21.1 km with checkpoints at 4, 9, 10, 14, 19 km.
- Relay divisions (RA/RB) use the A/B course. They have no sex or age group.
- `予備` (reserve) rows are excluded everywhere.

Inferred distances are flagged `inferred: true` in config and rendered with
"推定" in the UI. Distances can be changed on race morning by editing
`src/config/races/2026.ts` and pushing; Coolify redeploys in minutes.

### 2.4 Odd rows and how they are handled

| Case | Seen in | Handling |
|------|---------|----------|
| Empty `部門` | 2026: 3 rows | Dropped, logged once per bib |
| Empty `START` | 2024: 20 rows | Fall back to the division wave start from config |
| `予備` (reserve) | every year, 20–30 rows | Dropped everywhere |
| `チャンピオンシップ`, `ATYPE ELITE` | 2022: 31, 2023: 22 | Mapped to A for past-result lookup; excluded from prediction training |
| Empty `年齢区分` | 83–92 rows/year | Relay members and some entries: division and sex ranks only, no age rank |
| Empty `性別` | 83–90 rows/year | No sex rank |

Bib numbers are unique across all divisions in 2023–2026 (verified, zero
duplicates). A load-time assertion fails the parse if a duplicate appears, so
`/api/athletes/{bib}` stays unambiguous.

### 2.5 Historical data usage

| Year | Past-result lookup | Prediction training | Checkpoint-level comparison |
|------|--------------------|---------------------|-----------------------------|
| 2022 | yes | no (different checkpoints) | no |
| 2023 | yes | yes | yes |
| 2024 | yes | yes | yes |
| 2025 | yes | yes, swim distance-normalized | yes |

### 2.6 Weather

- Forecast: Open-Meteo (no key), 3-hourly for Sawata (38.02 N, 138.37 E):
  weather code, temperature, humidity, precipitation, wind direction/speed.
  Refreshed every 30 min.
- Observation: JMA AMeDAS, Aikawa station on Sado, latest 10-minute value
  (temperature, humidity, wind). Refreshed every 10 min.

Weather failures never affect race data.

## 3. Architecture

Single Next.js 16 (App Router, TypeScript strict) container. Bun is the
package manager; Node 24 is the runtime. Deployed with Coolify on the `gmk`
server at `sado-tracker-2026.teraren.com` (Cloudflare in front). Persistent
volume at `/app/data`.

Long-running work is started once from `instrumentation.ts` (guarded by a
global so dev HMR does not double-start):

1. **Poller** (60 s): fetch live CSV → decode → parse → normalize →
   `RaceSnapshot` → compute `ComputedSnapshot` (all athletes, all rankings,
   positions, predictions) → swap the in-memory snapshot → write
   `/app/data/snapshot.json`. On fetch/parse failure keep the previous
   snapshot and set `stale: true` with the last good `fetchedAt`.
2. **History loader** (startup): load 2022–2025 CSVs from
   `/app/data/history/<year>.csv`, fetching from systemway only when the file
   is missing. Builds the name index and the prediction model, and runs the
   backtest (§6.4).
3. **Weather poller** as in §2.6.

Client pages never reload. They poll `GET /api/race` (tiny) every 15 s and
refetch their data when `fetchedAt` changes, and immediately when the tab
regains visibility. Estimated positions are recomputed client-side every
10 s from server-provided `(lastKm, lastAt, speedKmh, capKm)` so dots move
between server updates.

### 3.1 Replay mode (development and E2E)

`REPLAY_YEAR=2025 REPLAY_START=2025-09-07T10:30:00+09:00 REPLAY_SPEED=60`
makes the poller read the 2025 CSV and a virtual clock that starts at
`REPLAY_START` and runs at `REPLAY_SPEED`×. Only passes with
`timestamp <= now` are visible. All time-dependent code takes a `Clock`
dependency; production uses the wall clock.

### 3.2 Module layout

```
src/
  config/races/{2022,2023,2024,2025,2026}.ts, index.ts   year configs + normalization tables
  lib/domain/          types only (Athlete, Checkpoint, Division, Rank, …)
  lib/csv/             fetch, cp932 decode, parse, header mapping, normalize → RaceSnapshot
  lib/compute/         pure functions: elapsed, segments, ranking, deviation, position, prediction, events
  lib/history/         history loader, name index, prediction model, backtest
  lib/weather/         open-meteo, amedas clients
  lib/runtime/         clock, poller, snapshot store (memory + disk), instrumentation entry
  lib/format/          duration, pace, speed, clock-time formatters (JST)
  app/                 pages, route handlers, manifest
  components/          ui (shadcn), tracker components
tests/unit, tests/integration, tests/e2e, tests/fixtures
```

Compute functions are pure: `(snapshot, config, now) → result`. No I/O, no
Date.now(). This is what makes the numbers testable.

## 4. Domain model

```ts
type Division = "A" | "B" | "RA" | "RB";
type Discipline = "swim" | "bike" | "run";
type Sex = "M" | "F";
type AgeGroup = string;            // "M40-44", "F24-", "M80-84"
type CheckpointId = string;        // "start" | "swimL" | "swimF" | "bikeS" | "sumiyoshi" | "runS" | "run4" … "finish"

interface CheckpointDef {
  id: CheckpointId; label: string; csvHeaders: string[];   // aliases across years
  discipline: Discipline | "transition";
  km: number;                       // km within its discipline
  inferred?: boolean;
}
interface DivisionCourse { swimKm; bikeKm; runKm; waveStart: string; checkpoints: CheckpointDef[] }
interface RaceConfig { year; csvUrl; raceDate; divisions: Record<Division, DivisionCourse>; normalize: {...} }

interface Athlete {
  bib: string; name: string; nameKey: string;      // nameKey = NFKC, single ASCII space
  sex: Sex | null; division: Division; ageGroup: AgeGroup | null;
  startAt: number;                                  // epoch ms
  passes: Partial<Record<CheckpointId, number>>;    // epoch ms incl. ms column
  officialTotal: string | null; remark: string;
  status: "not_started" | "racing" | "finished" | "dnf";
}
interface Rank { rank: number; of: number }         // of = population size (母数)
```

## 5. Computation rules

All times are integer milliseconds. Elapsed at checkpoint = `passes[cp] − startAt`.

### 5.1 Populations

- Division population `P(div, cp)` = athletes in `div` with `passes[cp]`
  defined, excluding `予備`. RA/RB are their own divisions and are never
  mixed with A/B.
- Age-group population = `P` ∩ same `ageGroup`; sex population = `P` ∩ same
  `sex`. Relay athletes have neither, so they get division ranks only.
- `of` (母数) is always the population size used for that rank.

### 5.2 Ranking

Standard competition ranking: tied athletes share a rank and the next rank
skips (1, 2, 2, 4). Sort key
is the millisecond value; ties are only true ties.

- **Discipline time**: swim = `swimF − start`; bike = `runS − bikeS`;
  run = `finish − runS`. Rank among the population that completed the
  discipline (`P(div, swimF)`, `P(div, runS)`, `P(div, finish)`).
- **Provisional discipline rank** (discipline in progress): let `cp` be the
  athlete's latest checkpoint inside that discipline; time so far =
  `passes[cp] − passes[disciplineStart]`; rank within `P(div, cp)` by that
  time. Displayed with a "暫定" flag and the checkpoint name.
- **Cumulative rank** at any checkpoint = rank by elapsed within `P(div, cp)`.
  The athlete detail page shows it for every passed checkpoint (rank
  progression chart) and the latest one in the header.
- **Split rank**: for consecutive checkpoints `(a, b)` of the division's
  course, split = `passes[b] − passes[a]`, rank within athletes having both.
- **Transitions**: T1 = `bikeS − swimF`, T2 = `runS − last bike checkpoint`
  is not measurable (住吉 is mid-course), so only T1 is shown. Transitions
  are listed, not ranked.
- **Status**, evaluated in this order:

  | status | rule |
  |--------|------|
  | `finished` | `finish` is set |
  | `dnf` | `備考` starts with `DNF` |
  | `not_started` | `now < startAt` |
  | `dns_suspected` | no `入水`, no `ｽｲﾑL`/`ｽｲﾑF`, no `ﾊﾞｲｸS`, and `now > startAt + swimCutoff` |
  | `racing` | otherwise |

  `swimCutoff` is per division in config: A 150 min, B 100 min (slowest
  observed `ｽｲﾑF` 2023–2025 is A 137 min, B 86 min; `ﾊﾞｲｸS` A 146 min,
  B 95 min). `入水` (water entry) is the discriminator: in 2025, 197 rows
  had no `入水` and never appeared again, while 41 rows had `入水` but no
  swim split — the latter are genuine swim DNFs and must stay `racing`/`dnf`.
  Roughly 13 % of rows are `dns_suspected` (2025: 238 / 1,818).

  `dns_suspected` and `not_started` athletes are excluded from populations,
  from `/map`, and from prediction. They remain searchable and their page
  shows 未計測 with an explanation. DNF athletes stay in every population
  where they have the checkpoint.

### 5.3 Deviation score (偏差値)

`50 + 10 × (mean − x) / sd` over the same population as the rank, using the
same time value. Hidden when population < 5 or `sd = 0`.

### 5.4 Speeds and paces

- Swim: `min:ss /100m` = time / (km × 10).
- Bike: `km/h` one decimal = km / hours.
- Run: `m:ss /km`.
Segment km come from config; inferred km render with "推定".

### 5.5 Position estimate

Course axis is per division: three segments (swim, bike, run) each measured
in km within the discipline. For an athlete whose latest checkpoint is `cp`:

```
speed  = own speed on the last completed segment of the same discipline
       ?? live median speed of P(div) for the upcoming segment (n ≥ 20)
       ?? historical median for that segment (2023–2025)
estKm  = cp.km + speed × (now − passes[cp])
estKm  = min(estKm, nextCp.km − 0.1)            // cannot be past an unrecorded checkpoint
```

If `estKm` hits the cap the UI shows "次の計測待ち" (waiting for the next
timing point) and draws a filled dot on the checkpoint; otherwise a dashed
dot. After `swimF` and before `bikeS` the athlete is "T1" at bike km 0.
Finished athletes sit at the finish. Not-started athletes sit at swim km 0.

### 5.6 Notifications (in-page, no push)

A pass event is `(bib, checkpointId, passedAt)`. The client derives events
for bookmarked bibs from athlete data and keeps a `seen` set of
`bib:checkpointId` in localStorage. Unread = derived events not in `seen`.
Opening the bell marks everything seen. New events while the page is open
trigger a toast, a highlighted card, and a `(n)` prefix in `document.title`.
Detection is set-based so late-arriving passes are never missed.

## 6. Finish prediction

### 6.1 Primary: nearest neighbours on history

Training set: finishers of the same division in 2023–2025 (DNF excluded).

Feature vector at the athlete's latest checkpoint `cp`:
- pace of each completed discipline (time / configured distance for that
  year and division),
- pace so far in the current discipline (`passes[cp] − passes[disciplineStart]`)
  / km of `cp`.

**B-division swim is excluded from the feature vector.** The 2025 B swim was
shortened by an unknown amount (median 24.8 min vs 43–45 min in 2023, 2024),
so its pace cannot be normalized against a distance we do not know. Swim is
about 5 % of a B race, so dropping the feature costs little and removes a
wrong-by-construction number. A-division swim is unchanged across years and
stays in. The 2025 config records `swimKm: null, swimShortened: true` for B;
any code path that would divide by it must handle `null` explicitly (unit
tested).

Distance: Euclidean on z-scored features. Take k = 20 nearest. Each
neighbour contributes `remaining = finish − passes[cp]` in its own year,
rescaled per discipline by `thisYearKm / thatYearKm` for disciplines not yet
completed. Prediction = current elapsed + median(remaining); range =
25th–75th percentile. Predicted clock time = `startAt + prediction`.

### 6.2 Fallback: pace extrapolation

Used when fewer than 5 neighbours are within a sane window or the athlete is
before `swimF`. Remaining distance in the current discipline at the athlete's
current speed, later disciplines at the division's live median pace (or
historical median), plus median T1.

### 6.3 Explanation payload (shown behind the "?" button)

The API returns, and the UI renders, all of:
- method name and the checkpoint the prediction was made at,
- neighbour count and year breakdown, neighbour remaining-time p25/median/p75,
- athlete's last-segment speed vs neighbours' median for the same segment,
- the simple-extrapolation figure for comparison,
- backtest accuracy for this method at this checkpoint (§6.4),
- a one-line note on what tends to move the number (e.g. A bike second half).

### 6.4 Backtest

At startup, predict every 2025 finisher from 2023–2024 at each checkpoint
(and 2024 from 2023+2025) and store median absolute error and the share
within ±25 min, per division and checkpoint. Displayed in the explanation.
A unit test asserts the backtest runs and errors are finite.

## 7. Pages

All pages are Japanese, mobile-first (390 px design width), light and dark
themes via ai-tri tokens, footer "Powered by AI TRI+" linking to
https://ai-triathlon-result.teraren.com/ .

| Route | Content |
|-------|---------|
| `/` | Friend list. Search by bib or name (server-side `q`), add to bookmarks (localStorage), `?bibs=1,2` for sharing. Cards per mock screen 1. Weather panel. Bell with unread badge; panel per screen 2. |
| `/athletes/[bib]` | Header, position bar, current ranks (division / sex / age), discipline table, prediction with "?" explanation, course-position strip with 5 age-group neighbours ahead and behind by estimated position, rank-progression chart, split table, past results (all matching years), small AI TRI+ athlete link (`/athletes/<name with ASCII space>`), bookmark toggle. |
| `/divisions/[div]` | Tabs A/B/RA/RB, discipline tabs swim/bike/run/total, age-group select, table rank/name/AG/time/pace/diff, 50 per page. `?bib=` highlights that athlete and makes diffs relative to them; if absent from the table, a banner states their current position. |
| `/map` | Whole-field strip: X = course axis, Y = **field order** (§7.3, top = leading). Views: division (dense dots, friends labelled), age group (rows with names), friends only. Tap a dot for name, field order and cumulative rank → detail. |

### 7.3 Field order (the `/map` Y axis)

Cumulative rank is defined only within `P(div, cp)`, and `cp` differs per
athlete, so ranks at different checkpoints are not comparable. `/map` needs a
single total order over everyone still racing. Field order sorts by:

1. index of the athlete's latest checkpoint in the division's course,
   descending (further along the course is ahead);
2. elapsed at that checkpoint, ascending (faster to reach it is ahead).

Finished athletes take the top slots ordered by total time. `dns_suspected`,
`not_started` and DNF athletes are excluded. The Y position is the field-order
index; the number shown next to a labelled dot is the athlete's own cumulative
rank at their latest checkpoint (`201/412`), because that is the figure they
see everywhere else. The tooltip shows both, labelled.

### 7.1 Design system

Copy ai-tri's `app/globals.css` semantic tokens (oklch, `.dark` class),
`tailwind.config.ts` font families (Inter, Noto Sans JP) and brand colours,
shadcn/ui new-york components, lucide icons, sport classes `.swim` (blue),
`.bike` (green), `.run` (orange). Faster diffs green, slower red, highlighted
row yellow. Unread badge `destructive`; friend highlight brand cyan. Charts
with Apache ECharts (chart-1 blue = division, red = sex, green = age group).
No hard-coded neutral palette classes.

### 7.2 Number formatting (single module, unit-tested)

| Kind | Format | Example |
|------|--------|---------|
| Duration | `h:mm:ss`, hours unpadded, truncate ms | `4:12:34` |
| Clock time | `HH:MM:SS` JST 24 h; `HH:MM` where space is tight | `10:12:34` |
| Swim pace | `m:ss /100m` | `2:05 /100m` |
| Bike speed | one decimal `km/h` | `32.1 km/h` |
| Run pace | `m:ss /km` | `4:38 /km` |
| Rank | `rank/of` | `201/412` |
| Deviation | integer | `54` |
| Estimated km | integer for bike, one decimal for swim/run | `約 132 km`, `約 15.6 km` |
| Diff | signed `±m:ss` or `±h:mm:ss` | `+3:41`, `−0:35` |

Rounding rule for the duration formatter is decided by the reference check
in §9.1 (truncate vs round) and then frozen in a test.

## 8. API (HAL, `_links` on every resource)

Race data: `Cache-Control: no-cache` on responses, and every client fetch
carries `?v=<fetchedAt>` so a refetch after a snapshot change can never be
served a stale body from the browser cache. Weather: `max-age=300`. This is a
correctness rule, not a performance one: a 15-second-stale body under a fresh
`fetchedAt` would show numbers that disagree with the header's update time.

| Endpoint | Returns |
|----------|---------|
| `GET /api/race` | `{ year, fetchedAt, stale, counts: {div: {cp: n}}, _links }` |
| `GET /api/athletes?q=&bibs=` | athlete summaries with stats; `q` matches bib prefix or normalized name substring, max 50 |
| `GET /api/athletes/{bib}` | full stats, splits, rank history, position, prediction + explanation, neighbours, past results, `_links.self`, `_links.division`, `_links.aiTri` |
| `GET /api/divisions/{div}/rankings?discipline=&ageGroup=&page=&per=` | rows + `Link` header (`next`/`prev`/`first`/`last`) + `_links` |
| `GET /api/map?div=&ageGroup=&bibs=` | `[ {bib, name, rank, lastKm, lastAt, speedKmh, capKm, discipline, status} ]` |
| `GET /api/weather` | forecast rows + observation |

Query params validated with zod; invalid input → 400 with a message. Unknown
bib → 404. Division ids other than A/B/RA/RB → 404.

## 9. Verification of numbers (mandatory)

### 9.1 Reference checks against the source

1. **Total time**: for every row with `総合記録` in 2023–2025, our
   `finish − start` formatted as duration must equal the column. Test fails
   on any mismatch; decides truncate-vs-round.
2. **Populations**: `https://systemway.jp/25sado/summary` lists 通過 counts
   per checkpoint per division. Our `P(div, cp)` sizes for 2025 must match.
   Implemented as an integration test over a downloaded copy of the summary
   page kept in `tests/fixtures` (HTML, no personal data).
3. **Ordering**: a script (`just verify-ranking`) fetches the source page
   sorted by a checkpoint (`sk`, `sv`, `di`) and compares the first 200
   bibs with our ranking. Run manually before race day; not part of CI.

### 9.2 Unit-test matrix for `lib/compute`

Synthetic fixtures with fictional names cover: ties, missing checkpoints,
DNF mid-race, relay rows without sex/age, B athletes lacking `ｽｲﾑL` and run
> 19 km, athletes not started, cap logic in position estimate, deviation with
n < 5 and sd = 0, prediction fallback path, event derivation with late data.

### 9.3 Fixture policy

Real CSVs contain about 1,900 real names per year and are **not committed**
to this public repository. Tests use synthesized CSVs (`tests/fixtures/*.csv`)
generated by a script from the real files with names replaced and bibs
shuffled, preserving timing distributions. Real files are fetched at runtime
into `/app/data/history/` and, for local development, into `.data/` (git-
ignored).

## 10. Error handling

- CSV fetch or parse failure: keep last snapshot, `stale: true`, UI shows
  "最終更新 hh:mm:ss（再取得中）". Retried on the next tick.
- Unknown header: logged once, ignored. Row with empty bib: dropped.
- Timestamp unparsable: treated as missing, logged with bib and header.
- History fetch failure at startup: app starts without past results and with
  the fallback predictor; a banner states that history is unavailable.
- Weather failure: panel shows "取得できません", nothing else changes.
- All caught errors go through one logger; no `console.log` in app code.

## 11. Testing and tooling

- Vitest: unit (compute, csv, format, config normalization), integration
  (route handlers against a fixture snapshot, HAL shape, Link headers).
- Playwright E2E in replay mode: add a friend and see the card, open the
  bell and see unread → read, athlete page renders chart and "?" toggle,
  division page pagination and highlight, map renders dots, data refresh
  without reload (advance replay clock and assert DOM change).
- Biome for lint/format; `bun run typecheck`; `justfile` targets: `dev`
  (via tmux), `test`, `e2e`, `lint`, `typecheck`, `fetch-history`,
  `make-fixtures`, `verify-ranking`, `build`, `docker-build`.
- Coverage target 80 % on `src/lib`.

## 12. Deployment

- Dockerfile: `oven/bun` stage installs and runs `next build`
  (`output: "standalone"`); `node:24-alpine` runtime stage. `EXPOSE 3000`,
  healthcheck `GET /api/race`.
- Coolify application on server `gmk`, project `sado-tracker-2026`, domain
  `sado-tracker-2026.teraren.com`, auto-deploy from `main`, volume
  `/app/data`. Env: `RACE_YEAR=2026`, `TZ=Asia/Tokyo`, optional
  `REPLAY_*`.
- Rollout order: deploy with `RACE_YEAR=2025` first to verify against the
  finished 2025 race, then switch to 2026 (per the issue).

## 13. Out of scope

Web Push (replaced by in-page notifications), geographic map, accounts,
server-side bookmark storage, editing distances from the UI.
