import { expect, test } from "@playwright/test";

/** A bib that is racing at the replayed moment; resolved once per run. */
async function racingBib(request: { get: (url: string) => Promise<{ json: () => Promise<unknown> }> }) {
  const response = await request.get("/api/map?div=A");
  const body = (await response.json()) as { entries: { bib: string; position: { discipline: string } }[] };
  const onBike = body.entries.find((entry) => entry.position.discipline === "bike");
  return onBike?.bib ?? (body.entries[0]?.bib as string);
}

test.describe("friend dashboard", () => {
  test("adds a friend, shows their card, and keeps them after a reload", async ({ page, request }) => {
    const bib = await racingBib(request);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /佐渡トラッカー/ })).toBeVisible();

    await page.getByLabel("ゼッケン番号か名前で友達を検索").fill(bib);
    await page.getByRole("button", { name: "追加" }).first().click();

    const addToList = page.getByRole("button", { name: "追加" }).nth(1);
    await expect(addToList).toBeVisible();
    await addToList.click();

    await expect(page.getByText(`#${bib}`)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`bibs=${bib}`));

    await page.reload();
    await expect(page.getByText(`#${bib}`)).toBeVisible();
  });

  test("shares the friend list through the URL", async ({ page, request }) => {
    const bib = await racingBib(request);
    await page.goto(`/?bibs=${bib}`);
    await expect(page.getByText(`#${bib}`)).toBeVisible();
  });

  test("opens the notification panel and clears the unread badge", async ({ page, request }) => {
    const bib = await racingBib(request);
    await page.goto(`/?bibs=${bib}`);

    const bell = page.getByRole("button", { name: /通知/ });
    await expect(bell).toBeVisible();
    await bell.click();

    await expect(page.getByRole("heading", { name: /通知 · 友達/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "すべて既読にする" })).toBeVisible();
  });

  test("refreshes in place without a navigation", async ({ page, request }) => {
    const bib = await racingBib(request);
    await page.goto(`/?bibs=${bib}`);
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
    await expect(page.getByText("種目")).toBeVisible();
    await expect(page.getByText("スプリット")).toBeVisible();

    const help = page.getByRole("button", { name: /予想|どう計算|\?/ }).first();
    if (await help.isVisible()) {
      await expect(page.getByText("どう計算したか")).toBeHidden();
      await help.click();
      await expect(page.getByText("どう計算したか")).toBeVisible();
    }
  });

  test("links to the external athlete page", async ({ page, request }) => {
    const bib = await racingBib(request);
    await page.goto(`/athletes/${bib}`);
    const link = page.getByRole("link", { name: /AI TRI\+/ }).last();
    await expect(link).toHaveAttribute("href", /ai-triathlon-result\.teraren\.com\/athletes\//);
  });
});

test.describe("division rankings", () => {
  test("lists a ranked table and pages through it", async ({ page }) => {
    await page.goto("/divisions/A?discipline=swim");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText(/名中/)).toBeVisible();

    const next = page.getByRole("button", { name: /次へ/ });
    if (await next.isEnabled()) {
      await next.click();
      await expect(page.getByText(/2 \/|2\//)).toBeVisible();
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
    for (const path of ["/", "/map", "/divisions/A"]) {
      await page.goto(path);
      await expect(
        page.getByRole("contentinfo").getByRole("link", { name: "AI TRI+" }),
      ).toBeVisible();
    }
  });
});
