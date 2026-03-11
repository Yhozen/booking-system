import type { BookingDb } from "@/server/services/booking/booking-db";

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "no_show",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type CreateBookingInput = {
  providerUserId: number;
  serviceId: number;
  customerName: string;
  slotStart: Date;
  slotEnd: Date;
  status?: BookingStatus;
};

export type MaterializeAvailabilityWindowsInput = {
  startDate: Date;
  endDate: Date;
};

const toDateOnly = (value: Date) => value.toISOString().slice(0, 10);

export class BookingService {
  public constructor(private readonly db: BookingDb) {}

  public async createBooking(input: CreateBookingInput): Promise<number> {
    const status = input.status ?? "pending";

    const result = await this.db.query<{
      booking_id: bigint | number | string;
    }>(
      `select create_booking(
         $1::bigint,
         $2::bigint,
         $3::text,
         tstzrange($4::timestamptz, $5::timestamptz, '[)'),
         $6::text
       ) as booking_id`,
      [
        input.providerUserId,
        input.serviceId,
        input.customerName,
        input.slotStart,
        input.slotEnd,
        status,
      ],
    );

    const rawId = result.rows[0]?.booking_id;
    const bookingId = Number(rawId);

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      throw new Error("create_booking did not return a valid id");
    }

    return bookingId;
  }

  public async materializeAvailabilityWindows(
    input: MaterializeAvailabilityWindowsInput,
  ): Promise<void> {
    await this.db.execute(
      `select materialize_availability_windows($1::date, $2::date)`,
      [toDateOnly(input.startDate), toDateOnly(input.endDate)],
    );
  }
}
