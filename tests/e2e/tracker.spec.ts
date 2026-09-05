import { expect, test } from "@playwright/test";

/** A bib that is racing at the replayed moment; resolved once per run. */
async function racingBib(request: {
  get: (url: string) => Promise<{ json: () => Promise<unknown> }>;
}) {
  const response = await request.get("/api/map?div=A");
  const body = (await response.json()) as {
    entries: { bib: string; position: { discipline: string } }[];
  };
  const onBike = body.entries.find((entry) => entry.position.discipline === "bike");
  return onBike?.bib ?? (body.entries[0]?.bib as string);
}

test.describe("friend dashboard", () => {
  test("adds a friend, shows their card, and keeps them after a reload", async ({
    page,
    request,
  }) => {
    const bib = await racingBib(request);

    await page.goto("/bookmarks");
    await expect(page.getByRole("heading", { name: /ブックマーク/ })).toBeVisible();

    await page.getByLabel("ゼッケン番号か名前で選手を検索").fill(bib);

    // Suggestions appear as the reader types; picking one adds the athlete.
    const suggestion = page.getByRole("option").first();
    await expect(suggestion).toBeVisible();
    await suggestion.click();

    await expect(page.getByText(`#${bib}`)).toBeVisible();
    // The list is private to the browser and deliberately not put in the URL.
    await expect(page).not.toHaveURL(/bibs=/);

    await page.reload();
    await expect(page.getByText(`#${bib}`)).toBeVisible();
  });

  test("accepts a list handed over in a link but does not keep it in the URL", async ({
    page,
    request,
  }) => {
    const bib = await racingBib(request);
    await page.goto(`/bookmarks?bibs=${bib}`);
    await expect(page.getByText(`#${bib}`)).toBeVisible();
    await expect(page).not.toHaveURL(/bibs=/);
  });

  test("opens the notification panel from the header on any page", async ({ page, request }) => {
    const bib = await racingBib(request);

    // The bell is global, so it works from the leaderboard as well.
    await page.goto(`/bookmarks?bibs=${bib}`);
    await expect(page.getByText(`#${bib}`)).toBeVisible();
    await page.goto("/");

    const bell = page.getByRole("button", { name: /通知/ });
    await expect(bell).toBeVisible();
    await bell.click();

    await expect(page.getByRole("heading", { name: /通知 · ブックマーク/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "すべて既読にする" })).toBeVisible();
  });

  test("refreshes in place without a navigation", async ({ page, request }) => {
    const bib = await racingBib(request);
    await page.goto(`/bookmarks?bibs=${bib}`);
    await expect(page.getByText(`#${bib}`)).toBeVisible();

    let navigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations += 1;
    });

    // The replay runs at 30x, so a checkpoint or two lands inside this window.
    await page.waitForTimeout(20_000);
    expect(navigations).toBe(0);
    await expect(page.getByText(/最終更新/)).toBeVisible();
  });
});

test.describe("athlete detail", () => {
  test("shows ranks, splits and a prediction whose explanation starts collapsed", async ({
    page,
    request,
  }) => {
    const bib = await racingBib(request);
    await page.goto(`/athletes/${bib}`);

    await expect(page.getByText(`#${bib}`)).toBeVisible();
    await expect(page.getByRole("heading", { name: /^種目/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^スプリット/ })).toBeVisible();

    const help = page.getByRole("button", { name: /計算|説明|\?/ }).first();
    await expect(help).toBeVisible();
    await expect(help).toHaveAttribute("aria-expanded", "false");
    await help.click();
    await expect(help).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/近傍|外挿/).first()).toBeVisible();
  });

  test("links to the external athlete page", async ({ page, request }) => {
    const bib = await racingBib(request);
    await page.goto(`/athletes/${bib}`);
    const link = page.getByRole("link", { name: /AI TRI\+ の選手ページ/ });
    await expect(link).toHaveAttribute("href", /ai-triathlon-result\.teraren\.com\/athletes\//);
  });
});

test.describe("division rankings", () => {
  test("lists a ranked table and pages through it", async ({ page }) => {
    await page.goto("/divisions/A?discipline=swim");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText(/名中/)).toBeVisible();

    const firstRankBefore = await page.getByRole("row").nth(1).innerText();
    const next = page.getByRole("button", { name: /次へ/ });
    if (await next.isEnabled()) {
      await next.click();
      await expect(page.getByRole("row").nth(1)).not.toHaveText(firstRankBefore);
    }
  });
});

test.describe("field map", () => {
  test("draws the field", async ({ page }) => {
    await page.goto("/map");
    await expect(page.locator("svg").first()).toBeVisible();
    await expect(page.getByText(/名 · 上が速い/)).toBeVisible();
  });
});

test.describe("every page", () => {
  test("carries the AI TRI+ footer", async ({ page }) => {
    for (const path of ["/", "/bookmarks", "/map", "/divisions/A"]) {
      await page.goto(path);
      await expect(
        page.getByRole("contentinfo").getByRole("link", { name: "AI TRI+", exact: true }),
      ).toBeVisible();
    }
  });
});

test.describe("leaderboard", () => {
  test("opens on the front of the field and links to the friend list", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "総合トップ" })).toBeVisible();
    await expect(page.getByText(/先頭順/)).toBeVisible();

    // The menu lives in the header and leads to the other views.
    await page.getByRole("button", { name: /メニューを開く/ }).click();
    await expect(page.getByRole("link", { name: "ブックマーク" })).toBeVisible();
    await page.getByRole("link", { name: "ブックマーク" }).click();
    await expect(page).toHaveURL(/\/bookmarks/);
  });

  test("shows the race clock, which in replay is not the device clock", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("リプレイ")).toBeVisible();
    await expect(page.getByText(/現在 · 最終更新/)).toBeVisible();
  });
});

test.describe("search", () => {
  test("suggests athletes as the reader types", async ({ page }) => {
    await page.goto("/bookmarks");
    await page.getByLabel("ゼッケン番号か名前で選手を検索").fill("1");
    await expect(page.getByRole("listbox")).toBeVisible();
    expect(await page.getByRole("option").count()).toBeGreaterThan(1);
  });
});

test.describe("athlete splits", () => {
  test("lists every timing point, including the ones not yet reached", async ({
    page,
    request,
  }) => {
    const bib = await racingBib(request);
    await page.goto(`/athletes/${bib}`);
    await expect(page.getByRole("heading", { name: /^スプリット/ })).toBeVisible();
    // A racing athlete has points ahead of them, shown as pending rows.
    await expect(page.getByText("未通過").first()).toBeVisible();
  });
});
