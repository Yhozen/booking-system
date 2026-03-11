"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { WeekView, getStartOfWeek } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const formatRange = (start: Date, end: Date) =>
  `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start)} - ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(addDays(end, -1))}`;

export function BookingCalendar() {
  const [weekStart, setWeekStart] = useState(() => getStartOfWeek(new Date()));
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const weekQuery = api.booking.getWeek.useQuery({
    startDate: weekStart.toISOString(),
    endDate: weekEnd.toISOString(),
  });

  const statusCounts = useMemo(() => {
    return (weekQuery.data ?? []).reduce(
      (acc, booking) => {
        acc.total += 1;
        if (booking.status === "confirmed") acc.confirmed += 1;
        if (booking.status === "pending") acc.pending += 1;
        if (booking.status === "cancelled") acc.cancelled += 1;
        return acc;
      },
      { total: 0, confirmed: 0, pending: 0, cancelled: 0 },
    );
  }, [weekQuery.data]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-8">
      <header className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bookings Week View</h1>
          <p className="text-sm text-muted-foreground" data-testid="week-range-label">
            {formatRange(weekStart, weekEnd)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            data-testid="week-nav-prev"
            onClick={() => setWeekStart((previous) => addDays(previous, -7))}
          >
            <ChevronLeft />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-testid="week-nav-today"
            onClick={() => setWeekStart(getStartOfWeek(new Date()))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-testid="week-nav-next"
            onClick={() => setWeekStart((previous) => addDays(previous, 7))}
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      </header>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 text-sm md:grid-cols-4">
        <p>
          Total: <span className="font-semibold" data-testid="stat-total">{statusCounts.total}</span>
        </p>
        <p>
          Confirmed: <span className="font-semibold" data-testid="stat-confirmed">{statusCounts.confirmed}</span>
        </p>
        <p>
          Pending: <span className="font-semibold" data-testid="stat-pending">{statusCounts.pending}</span>
        </p>
        <p>
          Cancelled: <span className="font-semibold" data-testid="stat-cancelled">{statusCounts.cancelled}</span>
        </p>
      </div>

      {weekQuery.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load bookings: {weekQuery.error.message}
        </div>
      ) : null}

      {weekQuery.isLoading ? (
        <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
          Loading week bookings...
        </div>
      ) : null}

      {weekQuery.data ? <WeekView weekStart={weekStart} bookings={weekQuery.data} /> : null}
    </div>
  );
}
