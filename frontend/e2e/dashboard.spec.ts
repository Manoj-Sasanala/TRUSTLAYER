import { expect, test, type Page } from "@playwright/test";

async function openLive(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Live API" }).click();
}

test("dashboard loads against the live API", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await openLive(page);
  await expect(page.getByRole("heading", { name: "Mandate Editor" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Attack Lab" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save my rules" })).toBeVisible();
  await expect(page.getByText("No attack run yet")).toBeVisible();

  expect(errors, errors.join("\n")).toEqual([]);
});

test("saving the mandate confirms and persists", async ({ page }) => {
  await openLive(page);

  await page.locator("#budget-input").fill("150.00");
  await page.getByRole("button", { name: "Save my rules" }).click();

  await expect(page.locator(".rules-saved-badge")).toBeVisible();
});

test("asking the agent returns a real decision", async ({ page }) => {
  await openLive(page);

  // Own mandate, so the decision does not depend on what another test saved.
  await page.locator("#budget-input").fill("500.00");
  await page.getByRole("button", { name: "Save my rules" }).click();
  await expect(page.locator(".rules-saved-badge")).toBeVisible();

  await expect(page.getByText("No request yet")).toBeVisible();

  await page.locator("#spend-request").fill("cheap headphones");
  await page.getByRole("button", { name: "Ask the agent" }).click();

  await expect(page.locator(".spend-decision")).toHaveText(
    /Decision: (APPROVE|ESCALATE|BLOCK)/,
    { timeout: 30_000 },
  );
  await expect(page.locator(".spend-amount")).toHaveText(/^\$\d+\.\d{2}$/, { timeout: 30_000 });
  // The test server has no PayPal credentials, so it must say so, not invent a link.
  await expect(page.getByText("No PayPal order for this request.")).toBeVisible();
});

for (const [label, rule] of [
  ["Over Cap", "R1"],
  ["Over Budget", "R2"],
  ["Wrong Payee", "R7"],
  ["Injection", "R9"],
] as const) {
  test(`attack lab blocks ${label} with ${rule}`, async ({ page }) => {
    await openLive(page);
    await page.getByRole("button", { name: new RegExp(label) }).click();

    const outcome = page.locator(".attack-outcome-card .outcome-meta-line");
    await expect(page.getByText(/Decision:\s*BLOCK/).first()).toBeVisible({ timeout: 30_000 });
    await expect(outcome).toContainText(rule);
  });
}

test("audit verification reports a real record count", async ({ page }) => {
  await openLive(page);

  await expect(page.getByText("Not verified yet")).toBeVisible();
  await page.getByRole("button", { name: "Verify audit records integrity" }).click();
  await expect(page.locator(".status-banner-headline")).toHaveText(/OK, \d+ records verified/, {
    timeout: 15_000,
  });
  await expect(page.getByText("Hash chain is intact.")).toBeVisible();
});
