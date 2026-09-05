# Sado Tracker 2026

A live tracker for supporters following friends in the
[Sado International Triathlon](https://www.scsf.jp/triathlon/). The official
timing site publishes raw checkpoint times; this reads them and answers the
questions a supporter actually has: where is my friend right now, how are they
doing against their division and age group, and when will they finish.

Race day: 6 September 2026. Type A starts at 06:00 JST, Type B at 07:30.

Live at [sado-tracker-2026.teraren.com](https://sado-tracker-2026.teraren.com/).

## What it shows

- **Bookmarks** — follow athletes by bib or name. Bookmarks live in the
  browser only; nothing about who a person follows leaves their device.
  Each card separates what the timing system measured from what the app
  estimated: recorded splits and ranks on one side, position on the course and
  predicted finish on the other.
- **In-page notifications** — a bell counts checkpoint passes the reader has
  not seen. Unread is tracked per checkpoint, not by timestamp, so a pass that
  the timing site publishes late still counts as new.
- **Leaderboard** — the front of each division, ordered by how far along the
  course each athlete is, since ranks taken at different checkpoints are not
  comparable.
- **Athlete detail** — discipline table, every timing point on the course
  whether reached or not, prediction with a collapsible explanation of how it
  was computed and how accurate the method has been,
  the athlete's place among age-group rivals on a course strip, rank
  progression, every split, and results from past years matched by name.
- **Division rankings** — swim, bike, run and total, filterable by age group,
  with differences relative to a chosen athlete.
- **Field map** — every athlete's estimated position across the course,
  ordered by how far along they are.
- **Weather** — Open-Meteo forecast for the finish area and the latest JMA
  AMeDAS observation from Aikawa on Sado.
- **Help** — where the data comes from, what a rank's denominator means, how
  far the prediction can be trusted, and where to report a problem.

## How the numbers are produced

The timing site exposes a CSV export holding every athlete in every division,
so no page scraping is needed. The server downloads it once a minute, decodes
Shift_JIS, merges each timing column with the millisecond column that follows
it, and recomputes the whole field. Pages poll a small endpoint and refetch
only when the update time changes, so nothing reloads under the reader.

Correctness is checked against the source rather than asserted:

- Every finisher's `FINISH − START` must reproduce the published 総合記録.
  3,820 rows from 2023 to 2025 match exactly, which is what fixes the
  rounding rule as truncation.
- Ranks always carry the size of the population they were taken against, and
  that population is the exact set of athletes measured at the same checkpoint.

**Position** advances from the last recorded checkpoint at the athlete's own
recent speed, falls back to the live field median, then a historical median.
It is capped just short of the next timing point, because passing it would
have produced a record.

**Finish prediction** finds the twenty past finishers whose pace pattern at the
same checkpoint most resembles the athlete and adds the median of what they
had left to run, reporting the quartile range. A backtest predicts a held-out
year from the others; the resulting median error is shown to the reader, since
a prediction from the bike is worth much less than one from 30 km into the run.

| Checkpoint | Median error | Within 25 min |
|---|---|---|
| A 住吉 (bike 100 km) | 26 min | 49 % |
| A ランS (run start) | 24 min | 52 % |
| A ラン20km | 9 min | 92 % |
| A ラン34km | 3 min | 100 % |
| B ランS (run start) | 24 min | 54 % |
| B ラン14km | 3 min | 100 % |

Distances are configured per year and per division. The 2025 B swim was
shortened to 1.35 km, so for the B division the swim enters the prediction as
a within-year percentile rather than an absolute pace.

## Running it

Tool versions come from `mise.toml` (Node 24, Bun 1.4).

```sh
mise install
bun install
mise run replay     # replay the finished 2025 race at 60x on :3111
mise run dev        # follow the live 2026 feed
mise run test
mise run accuracy   # print the prediction backtest table
```

Replay mode reveals a past race gradually, which is how the live code paths
are exercised before race day.

### Showing it to someone else

Use a production build, not `mise run dev`. The dev server refuses to serve
its own client bundle to any host it does not recognise, so opening it through
a LAN address or a Tailscale name returns HTML that never hydrates and looks
like a broken page.

```sh
mise run serve-replay   # builds, then serves on 0.0.0.0:3111
```

Over Tailscale, `tailscale serve --bg --https=443 http://127.0.0.1:3111`
publishes it at `https://<host>.<tailnet>.ts.net/` for the tailnet only.

### Environment

| Variable | Meaning |
|---|---|
| `RACE_YEAR` | Race to display, default 2026 |
| `DATA_DIR` | Where past exports and the snapshot are cached, default `.data` |
| `POLL_INTERVAL_MS` | How often the field is recomputed, default 60000 |
| `FETCH_FROM_HOUR` | First hour of race day the timing site is asked, default 7 |
| `FETCH_TO_HOUR` | Hour it stops, exclusive, default 23 |
| `FETCH_WINDOW` | `off` to poll around the clock |
| `REFRESH_TOKEN` | Required by `POST /api/refresh` when set |
| `NEXT_PUBLIC_GA_ID` | GA4 measurement id, e.g. `G-XXXXXXXXXX`. Analytics is off when unset |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for Open Graph tags, default the production domain |
| `REPLAY_START` | Virtual start time; set to enable replay mode |
| `REPLAY_SPEED` | Replay multiplier, default 60 |
| `REPLAY_HOURS` | Race hours covered before looping, default 14 |

Production runs with `RACE_YEAR`, `TZ` and `DATA_DIR` only. Setting any
`REPLAY_*` variable switches the server to a past race, so they must be absent
on race day.

`NEXT_PUBLIC_GA_ID` is read at build time, not at run time, so it has to be a
build variable wherever this is deployed. Setting it after a build has no
effect until the next one.

The timing site is only asked between 07:00 and 23:00 Tokyo time on the race
date itself: before and after that the file cannot have changed, and polling it
is load on someone else's server for nothing. A start-up always fetches once
whatever the hour, so a server brought up the night before still serves the
entry list, and `POST /api/refresh` fetches on demand.

## Data

Timing data comes from [systemway.jp](https://systemway.jp/26sado?di=1).
Test fixtures are anonymized copies of the real exports: every timestamp is
preserved, names and bibs are replaced, so no athlete's name enters this
repository.

Powered by [AI TRI+](https://ai-triathlon-result.teraren.com/).
