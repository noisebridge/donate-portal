import { expect, test } from "./fixtures";

const availableTickets = {
  capacity: 150,
  sold: 25,
  claimed: 25,
  remaining: 125,
};

test.describe("Afterparty checkout", () => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 667, height: 375 },
  ]) {
    test(`keeps checkout reachable at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.route("**/afterparty/availability", async (route) => {
        await route.fulfill({ json: availableTickets });
      });

      await page.goto("/afterparty");
      const submit = page.locator(".ticket-submit");
      await expect(submit).toBeEnabled();
      await submit.scrollIntoViewIfNeeded();
      await page.keyboard.press("End");
      await expect(submit).toBeInViewport({ ratio: 1 });
    });
  }
});
