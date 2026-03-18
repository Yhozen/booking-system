import { expect, test } from "@playwright/test";

test.describe("booking week view", () => {
  test("renders seeded bookings, creates booking, and navigates weeks", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Bookings Week View" }),
    ).toBeVisible();

    await expect(page.getByTestId("stat-total")).toHaveText("4");
    await expect(page.getByTestId("stat-confirmed")).toHaveText("2");
    await expect(page.getByTestId("stat-pending")).toHaveText("1");
    await expect(page.getByTestId("stat-cancelled")).toHaveText("1");

    await expect(page.getByText("Alice Johnson")).toBeVisible();

    await page.getByTestId("create-customer-name").fill("E2E Booker");
    await page.getByTestId("create-slot-time").fill("10:30");
    await page.getByTestId("create-status").selectOption("confirmed");
    await page.getByTestId("create-booking-submit").click();

    await expect(page.getByTestId("create-booking-feedback")).toContainText(
      "created successfully",
    );
    await expect(page.getByTestId("stat-total")).toHaveText("5");
    await expect(page.getByText("E2E Booker")).toBeVisible();

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

    await expect(page.getByTestId("stat-total")).toHaveText("5");
    await weekScroll.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(page.getByText("E2E Booker")).toBeVisible();
  });
});
