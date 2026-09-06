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
    await expect(page.getByText(/現在 · 更新/)).toBeVisible();
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

    // The menu lives in the header and leads to the other views. The footer
    // lists the same destinations, so the menu is named to keep them apart.
    await page.getByRole("button", { name: /メニューを開く/ }).click();
    const menu = page.getByRole("navigation", { name: "メインメニュー" });
    await expect(menu.getByRole("link", { name: "ブックマーク" })).toBeVisible();
    await menu.getByRole("link", { name: "ブックマーク" }).click();
    await expect(page).toHaveURL(/\/bookmarks/);
  });

  test("narrows the field to a name and keeps each athlete's place in it", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/先頭順/)).toBeVisible();

    const rows = page.locator('main a[href^="/athletes/"]');
    const leader = (await rows.first().innerText()).split("\n")[0] as string;
    const family = leader.split(" ")[0] as string;

    await page.getByLabel("名前かゼッケン番号で一覧を絞り込む").fill(family);
    await expect(page.getByText(new RegExp(`「${family}」に一致`))).toBeVisible();

    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      expect(await rows.nth(i).innerText()).toContain(family);
    }
  });

  test("says so when nothing matches, and restores the field when cleared", async ({ page }) => {
    await page.goto("/");
    const box = page.getByLabel("名前かゼッケン番号で一覧を絞り込む");

    await box.fill("該当者のいない文字列");
    await expect(page.getByText(/に一致する選手はいません/)).toBeVisible();

    await page.getByLabel("絞り込みを解除").click();
    await expect(page.getByText(/エントリー/)).toBeVisible();
    expect(await page.locator('main a[href^="/athletes/"]').count()).toBeGreaterThan(1);
  });

  test("shows the race clock, which in replay is not the device clock", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("リプレイ")).toBeVisible();
    await expect(page.getByText(/現在 · 更新/)).toBeVisible();
  });
});

test.describe("search", () => {
  test("suggests athletes as the reader types", async ({ page }) => {
    await page.goto("/bookmarks");
    // The refresh control only renders once the client has hydrated; typing
    // before that sets the value without firing the handler that opens the list.
    await expect(page.getByRole("checkbox", { name: "自動更新" })).toBeVisible();
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

test.describe("help", () => {
  test("explains where the data comes from and how often it updates", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "ヘルプ" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "データの取得" })).toBeVisible();
    await expect(page.getByText(/秒.*ごとに全選手のデータを取得/)).toBeVisible();
  });

  test("links to the issue tracker and the repository", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("link", { name: /GitHub Issues/ })).toHaveAttribute(
      "href",
      "https://github.com/matsubo/sado-tracker-2026/issues",
    );
    await expect(page.getByRole("link", { name: /matsubo\/sado-tracker-2026/ })).toHaveAttribute(
      "href",
      "https://github.com/matsubo/sado-tracker-2026",
    );
  });

  test("is reachable from the menu on any page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /メニューを開く/ }).click();
    await page
      .getByRole("navigation", { name: "メインメニュー" })
      .getByRole("link", { name: "ヘルプ", exact: true })
      .click();
    await expect(page).toHaveURL(/\/help/);
  });

  test("is reachable from the footer without opening the menu", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "サイト内のページ" })
      .getByRole("link", { name: "ヘルプ", exact: true })
      .click();
    await expect(page).toHaveURL(/\/help/);
  });
});

test.describe("manual refresh", () => {
  test("fetches on demand, whatever the hour", async ({ request }) => {
    const response = await request.post("/api/refresh");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { refreshed: boolean; year: number };
    expect(body.refreshed).toBe(true);
    expect(body.year).toBeGreaterThan(2000);
  });
});

test.describe("refresh control", () => {
  test("turns the automatic refresh off and back on, and remembers the choice", async ({
    page,
  }) => {
    await page.goto("/");
    const auto = page.getByRole("checkbox", { name: "自動更新" });
    await expect(auto).toBeChecked();

    await auto.uncheck();
    await expect(auto).not.toBeChecked();

    await page.reload();
    await expect(page.getByRole("checkbox", { name: "自動更新" })).not.toBeChecked();

    await page.getByRole("checkbox", { name: "自動更新" }).check();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "自動更新" })).toBeChecked();
  });

  test("refreshes on demand while automatic refresh is off", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("checkbox", { name: "自動更新" }).uncheck();
    await page.getByRole("button", { name: "いま更新する" }).click();
    await expect(page.getByText(/現在 · 更新/)).toBeVisible();
  });
});

test.describe("social card", () => {
  test("renders an Open Graph image and points the tags at it", async ({ page, request }) => {
    const image = await request.get("/opengraph-image");
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");

    await page.goto("/");
    const og = page.locator('meta[property="og:image"]');
    await expect(og).toHaveAttribute("content", /opengraph-image/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /佐渡トラッカー/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
  });
});

test.describe("touch keyboards", () => {
  /**
   * Safari on iOS zooms the page in when a text field's font is under 16px,
   * and it never zooms back out when the field is left. The reader is then
   * stuck at the wrong scale until they pinch out by hand, so no field on a
   * touch device may go below that size.
   */
  const SMALLEST_WITHOUT_ZOOM = 16;

  for (const path of ["/", "/bookmarks", "/divisions/A"]) {
    test(`keeps every field at 16px or more on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("banner").or(page.locator("main"))).toBeVisible();

      const sizes = await page.evaluate(() => {
        const fields = document.querySelectorAll<HTMLElement>(
          'input:not([type="checkbox"]):not([type="radio"]), select, textarea',
        );
        return [...fields].map((field) => ({
          tag: field.tagName.toLowerCase(),
          label: field.getAttribute("aria-label") ?? field.id,
          px: Number.parseFloat(getComputedStyle(field).fontSize),
        }));
      });

      expect(sizes.length).toBeGreaterThan(0);
      for (const field of sizes) {
        expect(field.px, `${field.tag} "${field.label}" is ${field.px}px`).toBeGreaterThanOrEqual(
          SMALLEST_WITHOUT_ZOOM,
        );
      }
    });
  }
});
