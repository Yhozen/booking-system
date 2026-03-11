import { expect, test } from "@playwright/test";

test.describe("booking week view", () => {
  test("renders seeded bookings and navigates weeks", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Bookings Week View" }),
    ).toBeVisible();

    await expect(page.getByTestId("stat-total")).toHaveText("4");
    await expect(page.getByTestId("stat-confirmed")).toHaveText("2");
    await expect(page.getByTestId("stat-pending")).toHaveText("1");
    await expect(page.getByTestId("stat-cancelled")).toHaveText("1");

    await expect(page.getByText("Alice Johnson")).toBeVisible();

    const weekScroll = page.getByTestId("week-view-scroll");
    await weekScroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    await expect(page.getByText("Ben Carter")).toBeVisible();
    await expect(page.getByText("Jane Doe")).toBeVisible();
    await expect(page.getByText("Mia Lopez")).toBeVisible();

    await page.getByTestId("week-nav-next").click();

    await expect(page.getByTestId("stat-total")).toHaveText("0");
    await expect(page.getByTestId("stat-confirmed")).toHaveText("0");
    await expect(page.getByTestId("stat-pending")).toHaveText("0");
    await expect(page.getByTestId("stat-cancelled")).toHaveText("0");
    await expect(page.getByTestId("week-empty")).toBeVisible();

    await page.getByTestId("week-nav-prev").click();

    await expect(page.getByTestId("stat-total")).toHaveText("4");
    await weekScroll.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(page.getByText("Alice Johnson")).toBeVisible();
  });
});
