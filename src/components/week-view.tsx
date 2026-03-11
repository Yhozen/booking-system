"use client";

import { cn } from "@/lib/utils";

const DAYS_IN_WEEK = 7;
const HOUR_HEIGHT = 56;
const TIME_AXIS_WIDTH = 72;
const MIN_BOOKING_HEIGHT = 24;

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

type BookingStatus = string;

export type WeekViewBooking = {
  id: string;
  providerName: string;
  serviceName: string;
  status: BookingStatus;
  slotStart: string;
  slotEnd: string;
};

type WeekViewProps = {
  weekStart: Date;
  bookings: WeekViewBooking[];
  className?: string;
};

type BookingSegment = WeekViewBooking & {
  start: Date;
  end: Date;
  dayIndex: number;
  lane: number;
  laneCount: number;
  top: number;
  height: number;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "border-amber-400/60 bg-amber-500/15 text-amber-900 dark:text-amber-100",
  confirmed:
    "border-emerald-500/60 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
  cancelled: "border-rose-500/60 bg-rose-500/15 text-rose-900 dark:text-rose-100",
  no_show: "border-slate-500/60 bg-slate-500/15 text-slate-900 dark:text-slate-100",
};

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const getStartOfWeek = (value: Date, weekStartsOn = 1) => {
  const base = startOfDay(value);
  const delta = (base.getDay() - weekStartsOn + 7) % 7;
  return addDays(base, -delta);
};

const formatDayLabel = (value: Date) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(value);

const formatDayNumber = (value: Date) =>
  new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(value);

const formatHourLabel = (hour: number) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: true,
  }).format(new Date(2026, 0, 1, hour));

const formatTime = (value: Date) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(value);

const formatRange = (start: Date, end: Date) =>
  `${formatTime(start)} - ${formatTime(end)}`;

const toMinutesFromDayStart = (value: Date) =>
  value.getHours() * 60 + value.getMinutes();

const getWeekDays = (weekStart: Date) =>
  Array.from({ length: DAYS_IN_WEEK }, (_, index) => addDays(weekStart, index));

const buildBookingSegments = (
  bookings: WeekViewBooking[],
  weekStart: Date,
): BookingSegment[] => {
  const segmentsByDay = new Map<number, BookingSegment[]>();

  for (let dayIndex = 0; dayIndex < DAYS_IN_WEEK; dayIndex += 1) {
    segmentsByDay.set(dayIndex, []);
  }

  for (const booking of bookings) {
    const bookingStart = new Date(booking.slotStart);
    const bookingEnd = new Date(booking.slotEnd);

    if (
      Number.isNaN(bookingStart.getTime()) ||
      Number.isNaN(bookingEnd.getTime()) ||
      bookingEnd <= bookingStart
    ) {
      continue;
    }

    for (let dayIndex = 0; dayIndex < DAYS_IN_WEEK; dayIndex += 1) {
      const dayStart = addDays(weekStart, dayIndex);
      const dayEnd = addDays(dayStart, 1);

      if (bookingStart >= dayEnd || bookingEnd <= dayStart) {
        continue;
      }

      const clippedStart = bookingStart > dayStart ? bookingStart : dayStart;
      const clippedEnd = bookingEnd < dayEnd ? bookingEnd : dayEnd;
      const minutesStart = toMinutesFromDayStart(clippedStart);
      const minutesEnd =
        clippedEnd.getTime() === dayEnd.getTime()
          ? 24 * 60
          : toMinutesFromDayStart(clippedEnd);
      const top = (minutesStart / 60) * HOUR_HEIGHT;
      const height = Math.max(
        ((minutesEnd - minutesStart) / 60) * HOUR_HEIGHT,
        MIN_BOOKING_HEIGHT,
      );

      segmentsByDay.get(dayIndex)?.push({
        ...booking,
        start: clippedStart,
        end: clippedEnd,
        dayIndex,
        lane: 0,
        laneCount: 1,
        top,
        height,
      });
    }
  }

  const result: BookingSegment[] = [];

  for (let dayIndex = 0; dayIndex < DAYS_IN_WEEK; dayIndex += 1) {
    const daySegments = segmentsByDay.get(dayIndex) ?? [];

    daySegments.sort((a, b) => {
      const startDiff = a.start.getTime() - b.start.getTime();
      if (startDiff !== 0) return startDiff;
      return a.end.getTime() - b.end.getTime();
    });

    const laneEnds: Date[] = [];
    let dayLaneCount = 1;

    for (const segment of daySegments) {
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= segment.start);

      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(segment.end);
      } else {
        laneEnds[lane] = segment.end;
      }

      dayLaneCount = Math.max(dayLaneCount, laneEnds.length);
      segment.lane = lane;
    }

    for (const segment of daySegments) {
      segment.laneCount = dayLaneCount;
      result.push(segment);
    }
  }

  return result;
};

export function WeekView({ weekStart, bookings, className }: WeekViewProps) {
  const weekDays = getWeekDays(weekStart);
  const segments = buildBookingSegments(bookings, weekStart);
  const weekEnd = addDays(weekStart, DAYS_IN_WEEK);
  const now = new Date();
  const isNowInWeek = now >= weekStart && now < weekEnd;
  const nowDayIndex = isNowInWeek
    ? Math.floor((startOfDay(now).getTime() - weekStart.getTime()) / 86400000)
    : -1;
  const nowTop = (toMinutesFromDayStart(now) / 60) * HOUR_HEIGHT;
  const dayHeight = HOUR_HEIGHT * 24;

  return (
    <section
      data-testid="week-view"
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card text-card-foreground",
        className,
      )}
    >
      <div
        className="grid border-b border-border bg-muted/40"
        style={{ gridTemplateColumns: `${TIME_AXIS_WIDTH}px repeat(7, minmax(0, 1fr))` }}
      >
        <div className="border-r border-border p-2 text-right text-xs text-muted-foreground">
          Local
        </div>
        {weekDays.map((day) => (
          <div key={day.toISOString()} className="border-r border-border p-2 last:border-r-0">
            <p className="text-xs text-muted-foreground">{formatDayLabel(day)}</p>
            <p className="text-sm font-semibold">{formatDayNumber(day)}</p>
          </div>
        ))}
      </div>

      <div className="max-h-[72vh] overflow-auto" data-testid="week-view-scroll">
        <div
          className="grid"
          style={{ gridTemplateColumns: `${TIME_AXIS_WIDTH}px repeat(7, minmax(0, 1fr))` }}
        >
          <div className="border-r border-border bg-muted/20">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="border-b border-border/70 pr-2 text-right text-xs text-muted-foreground"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                <span className="-translate-y-2 inline-block bg-card px-1">
                  {formatHourLabel(hour)}
                </span>
              </div>
            ))}
          </div>

          {weekDays.map((day, dayIndex) => {
            const daySegments = segments.filter((segment) => segment.dayIndex === dayIndex);
            return (
              <div
                key={day.toISOString()}
                className="relative border-r border-border/70 bg-background last:border-r-0"
                style={{ height: `${dayHeight}px` }}
              >
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-border/60"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                  />
                ))}

                {daySegments.map((segment) => {
                  const width = 100 / segment.laneCount;
                  const left = width * segment.lane;
                  return (
                    <article
                      key={`${segment.id}-${segment.start.toISOString()}`}
                      data-testid="booking-card"
                      className={cn(
                        "absolute z-10 overflow-hidden rounded-md border px-2 py-1 shadow-sm",
                        STATUS_STYLES[segment.status] ??
                          "border-blue-500/60 bg-blue-500/15 text-blue-900 dark:text-blue-100",
                      )}
                      style={{
                        top: `${segment.top}px`,
                        left: `calc(${left}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                        height: `${segment.height}px`,
                      }}
                      title={`${segment.serviceName} (${segment.status})`}
                    >
                      <p className="truncate text-xs font-semibold">{segment.serviceName}</p>
                      <p className="truncate text-[11px] opacity-90">
                        {segment.status.replaceAll("_", " ")}
                      </p>
                      <p className="truncate text-[10px] opacity-80">
                        {formatRange(segment.start, segment.end)}
                      </p>
                    </article>
                  );
                })}

                {isNowInWeek && dayIndex === nowDayIndex ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500"
                    style={{ top: `${nowTop}px` }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {bookings.length === 0 ? (
        <p
          className="border-t border-border p-3 text-sm text-muted-foreground"
          data-testid="week-empty"
        >
          No bookings in this week.
        </p>
      ) : null}
    </section>
  );
}
