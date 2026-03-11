import { expect, test } from "@playwright/test";

const FIXED_NOW = Date.parse("2026-03-11T12:00:00.000Z");

test.describe("booking week view", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((fixedNow) => {
      const RealDate = Date;

      class MockDate extends RealDate {
        public constructor(...args: any[]) {
          if (args.length === 0) {
            super(fixedNow);
            return;
          }
          if (args.length === 1) {
            super(args[0]);
            return;
          }
          if (args.length === 2) {
            super(args[0], args[1]);
            return;
          }
          if (args.length === 3) {
            super(args[0], args[1], args[2]);
            return;
          }
          if (args.length === 4) {
            super(args[0], args[1], args[2], args[3]);
            return;
          }
          if (args.length === 5) {
            super(args[0], args[1], args[2], args[3], args[4]);
            return;
          }
          if (args.length === 6) {
            super(args[0], args[1], args[2], args[3], args[4], args[5]);
            return;
          }
          super(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
        }

        public static now() {
          return fixedNow;
        }
      }

      MockDate.parse = RealDate.parse;
      MockDate.UTC = RealDate.UTC;
      Object.setPrototypeOf(MockDate, RealDate);
      globalThis.Date = MockDate as unknown as DateConstructor;
    }, FIXED_NOW);
  });

  test("renders seeded bookings and navigates weeks", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Bookings Week View" }),
    ).toBeVisible();

    await expect(page.getByTestId("stat-total")).toHaveText("4");
    await expect(page.getByTestId("stat-confirmed")).toHaveText("2");
    await expect(page.getByTestId("stat-pending")).toHaveText("1");
    await expect(page.getByTestId("stat-cancelled")).toHaveText("1");

    await expect(page.getByText("Haircut").first()).toBeVisible();

    const weekScroll = page.getByTestId("week-view-scroll");
    await weekScroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    await expect(page.getByText("Consultation").first()).toBeVisible();

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
    await expect(page.getByText("Haircut").first()).toBeVisible();
  });
});
