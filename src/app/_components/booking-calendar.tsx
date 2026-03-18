"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMinutes } from "date-fns";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { WeekView, getStartOfWeek } from "@/components/week-view";
import { addDays } from "@/lib/week-date-utils";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

const formatRange = (start: Date, end: Date) =>
  `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start)} - ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(addDays(end, -1))}`;

const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "no_show"] as const;

const toDateInputValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toReadableTime = (value: Date) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(value);

export function BookingCalendar() {
  const [weekStart, setWeekStart] = useState(() => getStartOfWeek(new Date()));
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const [selectedProviderUserId, setSelectedProviderUserId] = useState<number>();
  const [selectedServiceId, setSelectedServiceId] = useState<number>();
  const [customerName, setCustomerName] = useState("");
  const [slotDate, setSlotDate] = useState(() => toDateInputValue(new Date()));
  const [slotTime, setSlotTime] = useState("09:00");
  const [bookingStatus, setBookingStatus] =
    useState<(typeof BOOKING_STATUSES)[number]>("pending");
  const [ensureAvailabilityWindow, setEnsureAvailabilityWindow] = useState(true);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const utils = api.useUtils();
  const weekQuery = api.booking.getWeek.useQuery({
    startDate: weekStart.toISOString(),
    endDate: weekEnd.toISOString(),
  }, {
    placeholderData: (previousData) => previousData,
  });
  const formOptionsQuery = api.booking.getFormOptions.useQuery();
  const createBookingMutation = api.booking.createFromUi.useMutation();

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

  const providers = useMemo(() => formOptionsQuery.data ?? [], [formOptionsQuery.data]);
  const selectedProvider = useMemo(
    () =>
      providers.find(
        (provider) => provider.providerUserId === selectedProviderUserId,
      ),
    [providers, selectedProviderUserId],
  );

  const selectedService = useMemo(
    () =>
      selectedProvider?.services.find(
        (service) => service.serviceId === selectedServiceId,
      ),
    [selectedProvider?.services, selectedServiceId],
  );

  const previewSlotEnd = useMemo(() => {
    if (!selectedService) return null;
    const slotStart = new Date(`${slotDate}T${slotTime}:00`);
    if (Number.isNaN(slotStart.getTime())) return null;
    return addMinutes(slotStart, selectedService.durationMinutes);
  }, [selectedService, slotDate, slotTime]);

  useEffect(() => {
    if (providers.length === 0) return;
    setSelectedProviderUserId((current) => current ?? providers[0]!.providerUserId);
  }, [providers]);

  useEffect(() => {
    if (!selectedProvider || selectedProvider.services.length === 0) {
      setSelectedServiceId(undefined);
      return;
    }

    setSelectedServiceId((current) => {
      if (
        current &&
        selectedProvider.services.some((service) => service.serviceId === current)
      ) {
        return current;
      }
      return selectedProvider.services[0]!.serviceId;
    });
  }, [selectedProvider]);

  const handleCreateBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionFeedback(null);

    if (!selectedProviderUserId || !selectedServiceId) {
      setSubmissionFeedback({
        type: "error",
        message: "Please select a provider and service.",
      });
      return;
    }

    if (!customerName.trim()) {
      setSubmissionFeedback({
        type: "error",
        message: "Customer name is required.",
      });
      return;
    }

    const slotStart = new Date(`${slotDate}T${slotTime}:00`);
    if (Number.isNaN(slotStart.getTime())) {
      setSubmissionFeedback({
        type: "error",
        message: "Please choose a valid date and time.",
      });
      return;
    }

    try {
      const result = await createBookingMutation.mutateAsync({
        providerUserId: selectedProviderUserId,
        serviceId: selectedServiceId,
        customerName: customerName.trim(),
        slotStart: slotStart.toISOString(),
        status: bookingStatus,
        ensureAvailabilityWindow,
      });

      setWeekStart(getStartOfWeek(slotStart));
      setCustomerName("");
      setSubmissionFeedback({
        type: "success",
        message: `Booking #${result.bookingId} created successfully.`,
      });
      await utils.booking.getWeek.invalidate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setSubmissionFeedback({
        type: "error",
        message: `Could not create booking: ${message}`,
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-8">
      <header className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bookings Week View</h1>
          <p
            className="text-muted-foreground text-sm"
            data-testid="week-range-label"
          >
            {formatRange(weekStart, weekEnd)}
          </p>
          {weekQuery.isFetching ? (
            <p className="text-muted-foreground mt-1 text-xs">Refreshing…</p>
          ) : null}
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

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="border-border bg-card grid gap-3 rounded-xl border p-4 text-sm md:grid-cols-4">
          <p>
            Total:{" "}
            <span className="font-semibold" data-testid="stat-total">
              {statusCounts.total}
            </span>
          </p>
          <p>
            Confirmed:{" "}
            <span className="font-semibold" data-testid="stat-confirmed">
              {statusCounts.confirmed}
            </span>
          </p>
          <p>
            Pending:{" "}
            <span className="font-semibold" data-testid="stat-pending">
              {statusCounts.pending}
            </span>
          </p>
          <p>
            Cancelled:{" "}
            <span className="font-semibold" data-testid="stat-cancelled">
              {statusCounts.cancelled}
            </span>
          </p>
        </div>

        <section
          className="border-border bg-card rounded-xl border p-4"
          data-testid="create-booking-form"
        >
          <h2 className="text-base font-semibold">Create booking</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Choose a provider, service, and slot. The calendar refreshes
            automatically after creation.
          </p>

          <form className="mt-4 grid gap-3" onSubmit={handleCreateBooking}>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Provider</span>
              <select
                className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
                data-testid="create-provider"
                value={selectedProviderUserId ?? ""}
                onChange={(event) =>
                  setSelectedProviderUserId(Number(event.target.value))
                }
                disabled={formOptionsQuery.isLoading || providers.length === 0}
              >
                {providers.length === 0 ? (
                  <option value="">No providers available</option>
                ) : null}
                {providers.map((provider) => (
                  <option
                    key={provider.providerUserId}
                    value={provider.providerUserId}
                  >
                    {provider.providerName}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Service</span>
              <select
                className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
                data-testid="create-service"
                value={selectedServiceId ?? ""}
                onChange={(event) => setSelectedServiceId(Number(event.target.value))}
                disabled={
                  !selectedProvider || selectedProvider.services.length === 0
                }
              >
                {selectedProvider?.services.length ? null : (
                  <option value="">No services available</option>
                )}
                {selectedProvider?.services.map((service) => (
                  <option key={service.serviceId} value={service.serviceId}>
                    {service.serviceName} ({service.durationMinutes}m)
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Customer name</span>
              <input
                className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
                data-testid="create-customer-name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Walk-in customer"
                maxLength={120}
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground text-xs">Date</span>
                <input
                  type="date"
                  className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
                  data-testid="create-slot-date"
                  value={slotDate}
                  onChange={(event) => setSlotDate(event.target.value)}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground text-xs">Start time</span>
                <input
                  type="time"
                  step={1800}
                  className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
                  data-testid="create-slot-time"
                  value={slotTime}
                  onChange={(event) => setSlotTime(event.target.value)}
                  required
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Status</span>
              <select
                className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
                data-testid="create-status"
                value={bookingStatus}
                onChange={(event) =>
                  setBookingStatus(
                    event.target.value as (typeof BOOKING_STATUSES)[number],
                  )
                }
              >
                {BOOKING_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={ensureAvailabilityWindow}
                onChange={(event) =>
                  setEnsureAvailabilityWindow(event.target.checked)
                }
              />
              Auto-create a manual availability window for this slot
            </label>

            <Button
              type="submit"
              className="w-full"
              data-testid="create-booking-submit"
              disabled={createBookingMutation.isPending || providers.length === 0}
            >
              {createBookingMutation.isPending ? "Creating..." : "Create booking"}
            </Button>
          </form>

          <p className="text-muted-foreground mt-2 text-xs">
            End time preview:{" "}
            <span className="font-medium">
              {previewSlotEnd ? toReadableTime(previewSlotEnd) : "—"}
            </span>
          </p>

          {submissionFeedback ? (
            <p
              className={`mt-2 text-xs ${
                submissionFeedback.type === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              }`}
              data-testid="create-booking-feedback"
            >
              {submissionFeedback.message}
            </p>
          ) : null}
        </section>
      </div>

      {weekQuery.isError ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
          Failed to load bookings: {weekQuery.error.message}
        </div>
      ) : null}

      {weekQuery.isLoading ? (
        <div className="border-border text-muted-foreground rounded-lg border p-6 text-sm">
          Loading week bookings...
        </div>
      ) : null}

      {weekQuery.data ? (
        <WeekView weekStart={weekStart} bookings={weekQuery.data} />
      ) : null}
    </div>
  );
}
